import type { DescriberView } from '../game/selectors';
import type { Language, Side } from '../game/types';

/** Host ⇄ describer protocol version. Messages with another version are ignored. */
export const PROTOCOL_VERSION = 1;

export type DescriberCommand =
  | { type: 'READY' }
  | { type: 'START' }
  | { type: 'TOGGLE_WORD'; index: number }
  | { type: 'UNDO_HIT' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'END_EARLY' }
  | { type: 'NEXT_TEAM' }
  // One phone per team: the checking team validates on its own phone.
  | { type: 'SET_VALIDATION'; side: Side; index: number; annulled: boolean }
  | { type: 'CONFIRM_VALIDATION' };

/** Commands that only the checking team may send (never the team whose turn it is). */
export const VALIDATION_COMMANDS: readonly DescriberCommand['type'][] = ['SET_VALIDATION', 'CONFIRM_VALIDATION'];

/**
 * One phone per person: who this phone is. `key` is a random id the phone keeps, so the
 * table recognises it after a reload; `team` is a team id or null (not chosen yet).
 */
export interface PlayerInfo {
  key: string;
  name: string;
  team: string | null;
}

export const MAX_NAME_LENGTH = 24;

/** Describer → host. */
export type ClientMessage =
  // `team`: the team this phone plays for (one phone per team mode); ignored otherwise.
  // `player`: who this phone is (one phone per person mode); ignored otherwise.
  | { v: 1; kind: 'hello'; team?: string | null; player?: PlayerInfo }
  | { v: 1; kind: 'ping'; team?: string | null; player?: PlayerInfo }
  | { v: 1; kind: 'join'; team: string | null }
  // One phone per person: the person wrote their name or chose a team (null = forget me).
  | { v: 1; kind: 'me'; player: PlayerInfo | null }
  | { v: 1; kind: 'bye' }
  | { v: 1; kind: 'command'; command: DescriberCommand };

/** Host → describer. */
export type HostMessage =
  | { v: 1; kind: 'state'; view: DescriberView }
  | { v: 1; kind: 'busy'; language?: Language }
  | { v: 1; kind: 'host-bye' };

/** Messages from the WebSocket server (not the host). */
export type ServerNotice =
  | { v: 1; kind: 'peer-left'; id: string }
  | { v: 1; kind: 'host-status'; online: boolean }
  // To the table: its room code, and the secret that lets it take the room back later.
  | { v: 1; kind: 'room'; code: string; secret: string };

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function parseCommand(raw: unknown): DescriberCommand | null {
  if (!isObject(raw)) return null;
  switch (raw.type) {
    case 'READY':
    case 'START':
    case 'PAUSE':
    case 'RESUME':
    case 'END_EARLY':
    case 'UNDO_HIT':
    case 'NEXT_TEAM':
    case 'CONFIRM_VALIDATION':
      return { type: raw.type };
    case 'SET_VALIDATION': {
      const { side, index, annulled } = raw;
      if (side !== 'blue' && side !== 'yellow') return null;
      if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index > 4) return null;
      if (typeof annulled !== 'boolean') return null;
      return { type: 'SET_VALIDATION', side, index, annulled };
    }
    case 'TOGGLE_WORD': {
      const i = raw.index;
      if (typeof i !== 'number' || !Number.isInteger(i) || i < 0 || i > 4) return null;
      return { type: 'TOGGLE_WORD', index: i };
    }
    default:
      return null;
  }
}

/** A team id ("t1"…), null (no team), or undefined when missing or invalid. */
function parseTeamId(raw: unknown): string | null | undefined {
  if (raw === null) return null;
  return typeof raw === 'string' && /^[A-Za-z0-9_-]{1,16}$/.test(raw) ? raw : undefined;
}

/** Trims and collapses spaces; null if empty or too long. */
export function cleanName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const name = raw.replace(/\s+/g, ' ').trim();
  return name.length > 0 && name.length <= MAX_NAME_LENGTH ? name : null;
}

function parsePlayer(raw: unknown): PlayerInfo | undefined {
  if (!isObject(raw)) return undefined;
  const { key } = raw;
  const name = cleanName(raw.name);
  const team = parseTeamId(raw.team);
  if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{4,40}$/.test(key) || !name || team === undefined) return undefined;
  return { key, name, team };
}

export function parseClientMessage(raw: unknown): ClientMessage | null {
  if (!isObject(raw) || raw.v !== PROTOCOL_VERSION) return null;
  switch (raw.kind) {
    case 'hello':
    case 'ping': {
      const team = parseTeamId(raw.team);
      const player = parsePlayer(raw.player);
      return {
        v: 1,
        kind: raw.kind,
        ...(team === undefined ? {} : { team }),
        ...(player === undefined ? {} : { player }),
      };
    }
    case 'me': {
      if (raw.player === null) return { v: 1, kind: 'me', player: null };
      const player = parsePlayer(raw.player);
      return player ? { v: 1, kind: 'me', player } : null;
    }
    case 'join': {
      const team = parseTeamId(raw.team);
      return team === undefined ? null : { v: 1, kind: 'join', team };
    }
    case 'bye':
      return { v: 1, kind: 'bye' };
    case 'command': {
      const command = parseCommand(raw.command);
      return command ? { v: 1, kind: 'command', command } : null;
    }
    default:
      return null;
  }
}

export function parseHostMessage(raw: unknown): HostMessage | null {
  if (!isObject(raw) || raw.v !== PROTOCOL_VERSION) return null;
  switch (raw.kind) {
    case 'busy':
      return { v: 1, kind: 'busy', language: raw.language === 'en' ? 'en' : raw.language === 'pt' ? 'pt' : undefined };
    case 'host-bye':
      return { v: 1, kind: 'host-bye' };
    case 'state': {
      const view = raw.view;
      if (!isObject(view) || typeof view.phase !== 'string' || !isObject(view.timer)) return null;
      return { v: 1, kind: 'state', view: view as unknown as DescriberView };
    }
    default:
      return null;
  }
}

export function parseServerNotice(raw: unknown): ServerNotice | null {
  if (!isObject(raw) || raw.v !== PROTOCOL_VERSION) return null;
  if (raw.kind === 'peer-left' && typeof raw.id === 'string') return { v: 1, kind: 'peer-left', id: raw.id };
  if (raw.kind === 'host-status' && typeof raw.online === 'boolean') {
    return { v: 1, kind: 'host-status', online: raw.online };
  }
  if (raw.kind === 'room' && typeof raw.code === 'string' && typeof raw.secret === 'string') {
    return { v: 1, kind: 'room', code: raw.code, secret: raw.secret };
  }
  return null;
}

export const msg = {
  hello: (team?: string | null, player?: PlayerInfo | null): ClientMessage => ({
    v: 1,
    kind: 'hello',
    ...(team === undefined ? {} : { team }),
    ...(player ? { player } : {}),
  }),
  ping: (team?: string | null, player?: PlayerInfo | null): ClientMessage => ({
    v: 1,
    kind: 'ping',
    ...(team === undefined ? {} : { team }),
    ...(player ? { player } : {}),
  }),
  me: (player: PlayerInfo | null): ClientMessage => ({ v: 1, kind: 'me', player }),
  join: (team: string | null): ClientMessage => ({ v: 1, kind: 'join', team }),
  bye: (): ClientMessage => ({ v: 1, kind: 'bye' }),
  command: (command: DescriberCommand): ClientMessage => ({ v: 1, kind: 'command', command }),
  state: (view: DescriberView): HostMessage => ({ v: 1, kind: 'state', view }),
  busy: (language?: Language): HostMessage => ({ v: 1, kind: 'busy', language }),
  hostBye: (): HostMessage => ({ v: 1, kind: 'host-bye' }),
};
