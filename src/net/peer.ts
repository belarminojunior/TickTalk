import { iceServers } from './iceServers';
import { PROTOCOL_VERSION } from './protocol';
import { BaseTransport, HOST_ID, SERVER_ID } from './transport';

/**
 * Rooms without a server of our own: the table and the phones talk browser to browser
 * (WebRTC data channels, through PeerJS). The table registers its room code with PeerJS's
 * free public matchmaking service and phones dial that code; the game itself then goes
 * directly between the devices (or through PeerJS's relay when a network blocks that).
 *
 * The transport reports the same notices the rest of the game already understands, as if
 * they came from a server: the table's room ("room"), a phone that left ("peer-left"), and,
 * to a phone, whether the table is there ("host-status").
 */

export type PeerRole = 'host' | 'describer';

/** Room codes: 4 letters, without I or O (so they aren't confused with 1 and 0). */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

export function randomRoomCode(random: () => number = Math.random): string {
  return Array.from({ length: 4 }, () => ALPHABET[Math.floor(random() * ALPHABET.length)]).join('');
}

/** The PeerJS id for a room (prefixed, so other apps on the same service don't collide). */
export function peerIdFor(code: string): string {
  return `ticktalk-${code}`;
}

/** The bits of a PeerJS DataConnection this transport uses (so tests can fake it). */
export interface ConnLike {
  readonly peer: string;
  readonly metadata?: unknown;
  readonly open: boolean;
  on(event: string, listener: (...args: any[]) => void): unknown;
  send(data: unknown): void;
  close(): void;
}

/** The bits of a PeerJS Peer this transport uses. */
export interface PeerLike {
  readonly destroyed: boolean;
  readonly disconnected: boolean;
  on(event: string, listener: (...args: any[]) => void): unknown;
  connect(id: string, options: { reliable: boolean; serialization: 'json'; metadata: unknown }): ConnLike;
  reconnect(): void;
  destroy(): void;
}

export type CreatePeer = (id?: string) => Promise<PeerLike>;

/** Loads PeerJS only when needed (it is a browser-only library). */
const createRealPeer: CreatePeer = async (id) => {
  const { Peer } = await import('peerjs');
  // Our own STUN/TURN list: PeerJS's built-in relays no longer answer.
  const options = { debug: 0 as const, config: { iceServers: iceServers() } };
  return (id ? new Peer(id, options) : new Peer(options)) as unknown as PeerLike;
};

export interface PeerTransportOptions {
  /** Table: the room it had (to keep the same code after a reload). Phone: the room to join. */
  room?: string | null;
  /** Table: the room is open, with this code. */
  onRoom?: (code: string) => void;
  createPeer?: CreatePeer;
  newCode?: () => string;
}

const CLIENT_ID = /^[A-Za-z0-9_-]{1,64}$/;
/** Phone: a call to the table that hasn't connected by now is tried again. */
const DIAL_TIMEOUT = 12_000;
/** Phone: the room isn't there (wrong code, or the table isn't open): try again now and then. */
const NO_ROOM_RETRY = 4000;
/** Phone: nothing heard from the table for this long means the link is probably dead. */
const SILENT_LINK = 8000;
/** Table: tries to get its old code back (a reloaded page may still hold it for a moment). */
const SAME_CODE_TRIES = 4;
/** Phone: after this many calls that found the table but couldn't connect, the network is to blame. */
const BLOCKED_AFTER = 2;
const MAX_BACKOFF = 8000;

const notice = (body: Record<string, unknown>) => ({ v: PROTOCOL_VERSION, ...body });

export class PeerTransport extends BaseTransport {
  readonly kind = 'peer' as const;
  private peer: PeerLike | null = null;
  /** Table: one connection per phone (by its stable id). Phone: the table, under HOST_ID. */
  private conns = new Map<string, ConnLike>();
  private code: string | null;
  /** Table: the code came from storage (keep trying it), or was just drawn (draw another if taken). */
  private remembered: boolean;
  private takenTries = 0;
  private backoff = 1000;
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private dialTimer: ReturnType<typeof setTimeout> | null = null;
  private outbox: unknown[] = [];
  private lastHeard = 0;
  /** Phone: calls in a row that reached the table but never opened (a network that blocks it). */
  private failedDials = 0;
  private closed = false;
  private readonly createPeer: CreatePeer;
  private readonly newCode: () => string;
  private readonly onPageHide = () => this.peer?.destroy();

  constructor(
    readonly role: PeerRole,
    id: string = HOST_ID,
    private options: PeerTransportOptions = {},
  ) {
    super(id);
    this.createPeer = options.createPeer ?? createRealPeer;
    this.newCode = options.newCode ?? (() => randomRoomCode());
    this.code = options.room ?? (role === 'host' ? this.newCode() : null);
    this.remembered = role === 'host' && !!options.room;
    // A table that reloads frees its code at once, so the new page gets the same room.
    if (role === 'host' && typeof window !== 'undefined') window.addEventListener('pagehide', this.onPageHide);
    void this.start();
  }

  /** The room code (a table's, once open; a phone's, the one it dials). */
  get room(): string | null {
    return this.role === 'host' && this.status !== 'open' ? null : this.code;
  }

  private later(fn: () => void, ms: number): void {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      if (!this.closed) fn();
    }, ms);
    this.timers.add(timer);
  }

  private async start(): Promise<void> {
    if (this.closed) return;
    if (!['noRoom', 'replaced', 'blocked'].includes(this.status)) this.setStatus('connecting');
    let peer: PeerLike;
    try {
      peer = await this.createPeer(this.role === 'host' && this.code ? peerIdFor(this.code) : undefined);
    } catch {
      this.retry();
      return;
    }
    if (this.closed) {
      peer.destroy();
      return;
    }
    this.peer = peer;
    peer.on('open', () => {
      if (this.peer !== peer) return;
      this.backoff = 1000;
      if (this.role === 'host') this.opened();
      else this.dial();
    });
    peer.on('connection', (conn: ConnLike) => this.accept(conn));
    // Lost the matchmaking service only: open connections keep working; rejoin it.
    peer.on('disconnected', () => {
      if (this.peer === peer && !peer.destroyed) this.later(() => !peer.destroyed && peer.disconnected && peer.reconnect(), 1000);
    });
    peer.on('error', (err: { type?: string }) => this.failed(peer, err?.type ?? ''));
  }

  /** Table: the room is open. */
  private opened(): void {
    this.takenTries = 0;
    this.remembered = true;
    this.setStatus('open');
    this.options.onRoom?.(this.code!);
    this.emitMessage(SERVER_ID, notice({ kind: 'room', code: this.code, secret: '' }));
  }

  /** Table: a phone connected. */
  private accept(conn: ConnLike): void {
    if (this.role !== 'host') {
      conn.close();
      return;
    }
    const meta = conn.metadata as { id?: unknown } | undefined;
    const id = typeof meta?.id === 'string' && CLIENT_ID.test(meta.id) && meta.id !== HOST_ID && meta.id !== SERVER_ID ? meta.id : null;
    if (!id) {
      conn.close();
      return;
    }
    conn.on('open', () => {
      // The same phone again (new connection): the old one is stale.
      const previous = this.conns.get(id);
      this.conns.set(id, conn);
      if (previous && previous !== conn) previous.close();
    });
    conn.on('data', (data: unknown) => {
      if (this.conns.get(id) === conn) this.emitMessage(id, data);
    });
    const gone = () => {
      if (this.conns.get(id) !== conn) return;
      this.conns.delete(id);
      this.emitMessage(SERVER_ID, notice({ kind: 'peer-left', id }));
    };
    conn.on('close', gone);
    conn.on('error', gone);
  }

  /** Phone: calls the table. */
  private dial(): void {
    const peer = this.peer;
    if (!peer || peer.destroyed || !this.code) return;
    const conn = peer.connect(peerIdFor(this.code), { reliable: true, serialization: 'json', metadata: { id: this.id } });
    let opened = false;
    let given = false;
    // The call never opened (timed out, or the connection failed on the way): try again, and
    // after a couple of tries say that this network doesn't let the phone reach the table.
    const notConnected = () => {
      if (opened || given || this.closed) return;
      given = true;
      this.clearDialTimer();
      conn.close();
      this.failedDials += 1;
      if (this.failedDials >= BLOCKED_AFTER && this.status !== 'noRoom') this.setStatus('blocked');
      this.redial();
    };
    this.clearDialTimer();
    this.dialTimer = setTimeout(() => {
      this.dialTimer = null;
      notConnected();
    }, DIAL_TIMEOUT);
    conn.on('open', () => {
      opened = true;
      this.failedDials = 0;
      this.clearDialTimer();
      this.conns.set(HOST_ID, conn);
      this.lastHeard = Date.now();
      this.backoff = 1000;
      this.setStatus('open');
      this.emitMessage(SERVER_ID, notice({ kind: 'host-status', online: true }));
      const pending = this.outbox;
      this.outbox = [];
      for (const body of pending) conn.send(body);
    });
    conn.on('data', (data: unknown) => {
      if (this.conns.get(HOST_ID) !== conn) return;
      this.lastHeard = Date.now();
      this.emitMessage(HOST_ID, data);
    });
    const gone = () => {
      if (!opened) {
        notConnected();
        return;
      }
      if (this.conns.get(HOST_ID) !== conn) return;
      this.conns.delete(HOST_ID);
      this.emitMessage(SERVER_ID, notice({ kind: 'host-status', online: false }));
      this.setStatus('connecting');
      this.redial();
    };
    conn.on('close', gone);
    conn.on('error', gone);
  }

  private redial(delay = this.nextBackoff()): void {
    this.later(() => {
      const peer = this.peer;
      if (!peer || peer.destroyed) void this.start();
      else if (peer.disconnected) {
        peer.reconnect();
        this.later(() => this.dial(), 1000);
      } else this.dial();
    }, delay);
  }

  private failed(peer: PeerLike, type: string): void {
    if (this.peer !== peer || this.closed) return;
    if (this.role === 'describer' && type === 'peer-unavailable') {
      // Wrong code, or the table isn't open (yet).
      this.clearDialTimer();
      this.failedDials = 0;
      this.setStatus('noRoom');
      this.redial(NO_ROOM_RETRY);
      return;
    }
    if (this.role === 'host' && type === 'unavailable-id') {
      peer.destroy();
      this.peer = null;
      this.takenTries += 1;
      if (this.remembered && this.takenTries <= SAME_CODE_TRIES) {
        // Probably this same table, just reloaded: the code frees up in a moment.
        this.later(() => void this.start(), 1500);
      } else if (this.remembered) {
        // Another window of this table is open with the code.
        this.setStatus('replaced');
      } else {
        // Someone else has this code: draw another.
        this.code = this.newCode();
        void this.start();
      }
      return;
    }
    // Network trouble, the matchmaking service down, etc.: start again in a while.
    peer.destroy();
    this.peer = null;
    this.retry();
  }

  private retry(): void {
    if (this.closed) return;
    if (this.status !== 'noRoom' && this.status !== 'blocked') this.setStatus('connecting');
    this.later(() => void this.start(), this.nextBackoff());
  }

  private nextBackoff(): number {
    const delay = this.backoff;
    this.backoff = Math.min(MAX_BACKOFF, this.backoff * 2);
    return delay;
  }

  private clearDialTimer(): void {
    if (this.dialTimer) clearTimeout(this.dialTimer);
    this.dialTimer = null;
  }

  /** Phone back from the lock screen: reconnect now if the link is down or has gone silent. */
  reconnectNow(): void {
    if (this.closed || this.role !== 'describer') return;
    const conn = this.conns.get(HOST_ID);
    if (conn && this.status === 'open' && Date.now() - this.lastHeard < SILENT_LINK) return;
    if (conn) {
      this.conns.delete(HOST_ID);
      conn.close();
    }
    this.backoff = 1000;
    this.redial(0);
  }

  /** Table: another window has this room; open a new room here instead. */
  takeOver(): void {
    if (this.closed || this.role !== 'host' || this.status !== 'replaced') return;
    this.code = this.newCode();
    this.remembered = false;
    this.takenTries = 0;
    void this.start();
  }

  send(to: string, body: unknown): void {
    if (this.closed) return;
    const conn = this.conns.get(to);
    if (conn?.open) conn.send(body);
    else if (this.role === 'describer' && to === HOST_ID && this.outbox.length < 20) this.outbox.push(body);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
    this.clearDialTimer();
    for (const conn of this.conns.values()) conn.close();
    this.conns.clear();
    this.peer?.destroy();
    this.peer = null;
    if (typeof window !== 'undefined') window.removeEventListener('pagehide', this.onPageHide);
    this.setStatus('closed');
  }
}
