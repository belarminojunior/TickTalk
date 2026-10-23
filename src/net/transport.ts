/** Id of the host (the table) on every transport. */
export const HOST_ID = 'host';
/** Sender of WebSocket server notices. */
export const SERVER_ID = 'server';

export type TransportKind = 'local' | 'broadcast' | 'websocket';
/** "replaced": another page with the same role took this one's place (no automatic reconnect). */
export type LinkStatus = 'connecting' | 'open' | 'closed' | 'replaced';

export type MessageHandler = (from: string, body: unknown) => void;
export type StatusHandler = (status: LinkStatus) => void;
export type Unsubscribe = () => void;

/**
 * One endpoint. The host uses the id "host"; each describer screen has its own id.
 * Messages always carry a recipient; each implementation delivers only to that recipient.
 */
export interface Transport {
  readonly kind: TransportKind;
  readonly id: string;
  readonly status: LinkStatus;
  send(to: string, body: unknown): void;
  onMessage(handler: MessageHandler): Unsubscribe;
  onStatus(handler: StatusHandler): Unsubscribe;
  close(): void;
}

/** Shared base: manages listeners and the link status. */
export abstract class BaseTransport implements Transport {
  abstract readonly kind: TransportKind;
  private messageHandlers = new Set<MessageHandler>();
  private statusHandlers = new Set<StatusHandler>();
  private _status: LinkStatus = 'connecting';

  constructor(readonly id: string) {}

  get status(): LinkStatus {
    return this._status;
  }

  abstract send(to: string, body: unknown): void;
  abstract close(): void;

  onMessage(handler: MessageHandler): Unsubscribe {
    this.messageHandlers.add(handler);
    return () => {
      this.messageHandlers.delete(handler);
    };
  }

  onStatus(handler: StatusHandler): Unsubscribe {
    this.statusHandlers.add(handler);
    handler(this._status);
    return () => {
      this.statusHandlers.delete(handler);
    };
  }

  protected emitMessage(from: string, body: unknown): void {
    for (const h of [...this.messageHandlers]) h(from, body);
  }

  protected setStatus(status: LinkStatus): void {
    if (status === this._status) return;
    this._status = status;
    for (const h of [...this.statusHandlers]) h(status);
  }
}

/** Stable per-tab id, so a describer screen is recognised after a reload. */
export function stableClientId(): string {
  const key = 'ticktalk.clientId';
  const fresh = () => `c-${Math.random().toString(36).slice(2, 10)}`;
  try {
    const existing = window.sessionStorage.getItem(key);
    if (existing) return existing;
    const id = fresh();
    window.sessionStorage.setItem(key, id);
    return id;
  } catch {
    return fresh();
  }
}
