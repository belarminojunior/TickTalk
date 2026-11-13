import { parseServerNotice } from './protocol';
import { BaseTransport, HOST_ID, SERVER_ID } from './transport';

export type WsRole = 'host' | 'describer';

/** Close codes the server uses when another page replaces this one (see server/relay.ts). */
export const REPLACED_CLOSE_CODES: readonly number[] = [4000, 4001];
/** The room doesn't exist (see server/rooms.ts). */
export const NO_ROOM_CLOSE_CODE = 4004;

const MIN_BACKOFF = 500;
const MAX_BACKOFF = 4000;
/** A wrong room code: try again now and then, in case the table opens it. */
const NO_ROOM_RETRY = 4000;

/** A table's room: the code everyone sees, and the secret only the table keeps. */
export interface RoomKey {
  code: string;
  secret: string;
}

export interface WebSocketOptions {
  /** Phones: the room code to join. Tables: the room they had (to take it back). */
  room?: string | RoomKey | null;
  /** Tables: the server assigned (or confirmed) the room. */
  onRoom?: (room: RoomKey) => void;
  /** Tests: a fixed URL. */
  url?: string;
}

/**
 * Where the game server is. Normally the same address that served the page; when the pages
 * are hosted somewhere that can't run it (e.g. Vercel), the build sets VITE_SERVER_URL to the
 * server's address (e.g. https://tick-talk.onrender.com).
 */
export function serverAddress(configured: string | undefined = import.meta.env.VITE_SERVER_URL): { secure: boolean; host: string } {
  if (configured) {
    try {
      const url = new URL(configured);
      return { secure: url.protocol === 'https:' || url.protocol === 'wss:', host: url.host };
    } catch {
      /* fall back to this page's address */
    }
  }
  return { secure: window.location.protocol === 'https:', host: window.location.host };
}

/** WebSocket URL of the game server. */
export function defaultWsUrl(role: WsRole, id: string, room?: string | RoomKey | null): string {
  const server = serverAddress();
  const proto = server.secure ? 'wss:' : 'ws:';
  const params = new URLSearchParams({ role, id });
  if (typeof room === 'string') params.set('room', room);
  else if (room) {
    params.set('room', room.code);
    params.set('secret', room.secret);
  }
  return `${proto}//${server.host}/ws?${params}`;
}

/**
 * The server relays the messages, within one room.
 * Reconnects on its own when the connection drops (with growing back-off).
 */
export class WebSocketTransport extends BaseTransport {
  readonly kind = 'websocket' as const;
  private socket: WebSocket | null = null;
  private backoff = MIN_BACKOFF;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;
  private outbox: string[] = [];
  private roomKey: string | RoomKey | null;

  constructor(
    readonly role: WsRole,
    id: string = HOST_ID,
    private options: WebSocketOptions = {},
  ) {
    super(id);
    this.roomKey = options.room ?? null;
    this.connect();
  }

  /** The room code (for a table: once the server has confirmed it). */
  get room(): string | null {
    return typeof this.roomKey === 'string' ? this.roomKey : this.roomKey?.code ?? null;
  }

  private connect(): void {
    if (this.closed) return;
    // While the room is missing, keep saying so between retries (no flicker to "connecting").
    if (this.status !== 'noRoom') this.setStatus('connecting');
    let socket: WebSocket;
    try {
      socket = new WebSocket(this.options.url ?? defaultWsUrl(this.role, this.id, this.roomKey));
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.socket = socket;
    socket.onopen = () => {
      this.backoff = MIN_BACKOFF;
      this.setStatus('open');
      const pending = this.outbox;
      this.outbox = [];
      for (const data of pending) socket.send(data);
    };
    socket.onmessage = (event) => {
      let data: unknown;
      try {
        data = JSON.parse(String(event.data));
      } catch {
        return;
      }
      if (typeof data !== 'object' || data === null) return;
      const { from, body } = data as { from?: unknown; body?: unknown };
      if (typeof from !== 'string') return;
      if (from === SERVER_ID && this.role === 'host') {
        const notice = parseServerNotice(body);
        if (notice?.kind === 'room') {
          // Reconnections ask for this room again.
          this.roomKey = { code: notice.code, secret: notice.secret };
          this.options.onRoom?.(this.roomKey);
        }
      }
      this.emitMessage(from, body);
    };
    socket.onclose = (event) => {
      if (this.socket === socket) this.socket = null;
      if (this.closed) return;
      if (REPLACED_CLOSE_CODES.includes(event.code)) {
        // Another page took our place. Reconnecting on our own would make the two pages
        // kick each other out forever; wait for takeOver() instead.
        this.setStatus('replaced');
        return;
      }
      if (event.code === NO_ROOM_CLOSE_CODE) {
        this.setStatus('noRoom');
        this.scheduleReconnect(NO_ROOM_RETRY);
        return;
      }
      this.setStatus('connecting');
      this.scheduleReconnect();
    };
    socket.onerror = () => socket.close();
  }

  private scheduleReconnect(fixedDelay?: number): void {
    if (this.closed || this.retryTimer) return;
    const delay = fixedDelay ?? this.backoff;
    if (fixedDelay === undefined) this.backoff = Math.min(MAX_BACKOFF, this.backoff * 2);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.connect();
    }, delay);
  }

  /** Forces a reconnect now (e.g. when the phone comes back from the lock screen). */
  reconnectNow(): void {
    if (this.closed || this.status === 'open' || this.status === 'replaced') return;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.backoff = MIN_BACKOFF;
    this.socket?.close();
    this.connect();
  }

  /** Reconnects after being replaced, taking the place back (the other page is the one that leaves). */
  takeOver(): void {
    if (this.closed || this.status !== 'replaced') return;
    this.backoff = MIN_BACKOFF;
    this.connect();
  }

  send(to: string, body: unknown): void {
    if (this.closed) return;
    const data = JSON.stringify({ to, body });
    if (this.socket && this.socket.readyState === WebSocket.OPEN) this.socket.send(data);
    else if (this.outbox.length < 20) this.outbox.push(data);
  }

  close(): void {
    this.closed = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.socket?.close();
    this.socket = null;
    this.setStatus('closed');
  }
}
