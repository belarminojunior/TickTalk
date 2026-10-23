import { BaseTransport, HOST_ID } from './transport';

export type WsRole = 'host' | 'describer';

/** Close codes the server uses when another page replaces this one (see server/relay.ts). */
export const REPLACED_CLOSE_CODES: readonly number[] = [4000, 4001];

const MIN_BACKOFF = 500;
const MAX_BACKOFF = 4000;

/** WebSocket URL on the same address that served the page. */
export function defaultWsUrl(role: WsRole, id: string): string {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const params = new URLSearchParams({ role, id });
  return `${proto}//${window.location.host}/ws?${params}`;
}

/**
 * PC + phone: the local server relays the messages.
 * Reconnects on its own when the connection drops (with growing back-off).
 */
export class WebSocketTransport extends BaseTransport {
  readonly kind = 'websocket' as const;
  private socket: WebSocket | null = null;
  private backoff = MIN_BACKOFF;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;
  private outbox: string[] = [];
  private url: string;

  constructor(readonly role: WsRole, id: string = HOST_ID, url?: string) {
    super(id);
    this.url = url ?? defaultWsUrl(role, id);
    this.connect();
  }

  private connect(): void {
    if (this.closed) return;
    this.setStatus('connecting');
    let socket: WebSocket;
    try {
      socket = new WebSocket(this.url);
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
      this.setStatus('connecting');
      this.scheduleReconnect();
    };
    socket.onerror = () => socket.close();
  }

  private scheduleReconnect(): void {
    if (this.closed || this.retryTimer) return;
    const delay = this.backoff;
    this.backoff = Math.min(MAX_BACKOFF, this.backoff * 2);
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
