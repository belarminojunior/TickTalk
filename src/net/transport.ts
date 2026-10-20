/** Identificador do anfitrião (a mesa) em todos os transportes. */
export const HOST_ID = 'host';
/** Remetente das notificações do servidor WebSocket. */
export const SERVER_ID = 'server';

export type TransportKind = 'local' | 'broadcast' | 'websocket';
/** "replaced": outra página com o mesmo papel tomou o lugar desta (não volta a ligar sozinha). */
export type LinkStatus = 'connecting' | 'open' | 'closed' | 'replaced';

export type MessageHandler = (from: string, body: unknown) => void;
export type StatusHandler = (status: LinkStatus) => void;
export type Unsubscribe = () => void;

/**
 * Um ponto de ligação. O anfitrião usa o id "host"; cada tela de quem explica tem o seu id.
 * As mensagens levam sempre destino; cada implementação entrega só a quem se destinam.
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

/** Base comum: gere os ouvintes e o estado da ligação. */
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

/** Id estável por separador, para a tela de quem explica se reconhecer depois de recarregar. */
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
