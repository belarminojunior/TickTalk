/**
 * Rooms: each table gets its own short code, and phones join that code. One server can run
 * many games at once (for example when it is deployed on the internet); messages never
 * cross from one room to another.
 */
import { randomBytes, randomInt } from 'node:crypto';
import { PROTOCOL_VERSION, Relay, SERVER_ID, envelope, type Connection } from './relay';

/** No I or O, so codes read aloud or typed on a phone are not confused with 1 and 0. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
export const ROOM_CODE_LENGTH = 4;
const CODE_PATTERN = new RegExp(`^[${ALPHABET}]{${ROOM_CODE_LENGTH}}$`);
const SECRET_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;

/** A phone asked for a room that does not exist (wrong code, or the table hasn't opened it). */
export const CLOSE_NO_ROOM = 4004;
/** The room already has the maximum number of phones. */
export const CLOSE_ROOM_FULL = 4005;

/** Uppercases and checks a code typed by a person ("kqtr" → "KQTR"); null if invalid. */
export function normalizeRoomCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const code = raw.trim().toUpperCase();
  return CODE_PATTERN.test(code) ? code : null;
}

export interface Room {
  readonly code: string;
  readonly relay: Relay;
}

interface RoomState extends Room {
  /** Only the table that holds it can take the room back (after a reload or a new connection). */
  secret: string;
  /** When the last connection left (null while someone is connected). */
  emptySince: number | null;
}

export interface RoomsOptions {
  maxRooms?: number;
  maxPhonesPerRoom?: number;
  /** How long an empty room is kept, so the table can come back to the same code. */
  idleMs?: number;
  newCode?: () => string;
  newSecret?: () => string;
}

export class Rooms {
  private rooms = new Map<string, RoomState>();
  private readonly maxRooms: number;
  private readonly maxPhones: number;
  private readonly idleMs: number;
  private readonly newCode: () => string;
  private readonly newSecret: () => string;

  constructor(options: RoomsOptions = {}) {
    this.maxRooms = options.maxRooms ?? 2000;
    this.maxPhones = options.maxPhonesPerRoom ?? 40;
    this.idleMs = options.idleMs ?? 6 * 60 * 60 * 1000;
    this.newCode = options.newCode ?? (() => Array.from({ length: ROOM_CODE_LENGTH }, () => ALPHABET[randomInt(ALPHABET.length)]).join(''));
    this.newSecret = options.newSecret ?? (() => randomBytes(18).toString('base64url'));
  }

  get count(): number {
    return this.rooms.size;
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  /**
   * A table connects. With the code and secret it had, it gets its room back (or the room
   * is recreated after a server restart, if nobody took the code meanwhile); otherwise it
   * gets a new room. The table is told its code and secret. Returns null if the server is full.
   */
  hostJoin(conn: Connection, wanted: { code: unknown; secret: unknown } | null): Room | null {
    const code = normalizeRoomCode(wanted?.code);
    const secret = typeof wanted?.secret === 'string' && SECRET_PATTERN.test(wanted.secret) ? wanted.secret : null;
    let room = code && secret ? this.rooms.get(code) : undefined;
    if (room && room.secret !== secret) room = undefined;
    if (!room && code && secret && !this.rooms.has(code) && this.rooms.size < this.maxRooms) {
      room = this.create(code, secret);
    }
    if (!room) {
      const fresh = this.freeCode();
      if (!fresh) return null;
      room = this.create(fresh, this.newSecret());
    }
    room.emptySince = null;
    room.relay.addHost(conn);
    conn.send(envelope(SERVER_ID, { v: PROTOCOL_VERSION, kind: 'room', code: room.code, secret: room.secret }));
    return room;
  }

  /** A phone joins a room by its code. Returns null (and closes the connection) if it can't. */
  describerJoin(rawCode: unknown, id: string, conn: Connection): Room | null {
    const code = normalizeRoomCode(rawCode);
    const room = code ? this.rooms.get(code) : undefined;
    if (!room) {
      conn.close(CLOSE_NO_ROOM, 'no room');
      return null;
    }
    if (room.relay.describerCount >= this.maxPhones && !room.relay.hasDescriber(id)) {
      conn.close(CLOSE_ROOM_FULL, 'room full');
      return null;
    }
    room.emptySince = null;
    room.relay.addDescriber(id, conn);
    return room;
  }

  hostLeft(room: Room, conn: Connection, now: number): void {
    room.relay.removeHost(conn);
    this.markIfEmpty(room, now);
  }

  describerLeft(room: Room, id: string, conn: Connection, now: number): void {
    room.relay.removeDescriber(id, conn);
    this.markIfEmpty(room, now);
  }

  /** Forgets rooms that have been empty for a long time. */
  sweep(now: number): void {
    for (const [code, room] of this.rooms) {
      if (room.emptySince !== null && now - room.emptySince > this.idleMs) this.rooms.delete(code);
    }
  }

  private markIfEmpty(room: Room, now: number): void {
    const state = this.rooms.get(room.code);
    if (state && state.relay === room.relay && state.relay.isEmpty) state.emptySince = now;
  }

  private create(code: string, secret: string): RoomState {
    const room: RoomState = { code, secret, relay: new Relay(), emptySince: null };
    this.rooms.set(code, room);
    return room;
  }

  private freeCode(): string | null {
    if (this.rooms.size >= this.maxRooms) return null;
    for (let i = 0; i < 50; i++) {
      const code = this.newCode();
      if (!this.rooms.has(code)) return code;
    }
    return null;
  }
}
