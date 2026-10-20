import { BaseTransport } from './transport';

/** Barramento em memória partilhado pelos pontos da mesma janela. */
export class LocalBus {
  private endpoints = new Map<string, LocalTransport>();

  register(endpoint: LocalTransport): void {
    this.endpoints.set(endpoint.id, endpoint);
  }

  unregister(endpoint: LocalTransport): void {
    if (this.endpoints.get(endpoint.id) === endpoint) this.endpoints.delete(endpoint.id);
  }

  deliver(from: string, to: string, body: unknown): void {
    // Entrega assíncrona, como numa rede: evita reentrância dentro de um render ou dispatch.
    queueMicrotask(() => this.endpoints.get(to)?.receive(from, body));
  }
}

/** Um só ecrã: a mesa e a tela de quem explica vivem na mesma janela. */
export class LocalTransport extends BaseTransport {
  readonly kind = 'local' as const;
  private closed = false;

  constructor(private bus: LocalBus, id: string) {
    super(id);
    bus.register(this);
    this.setStatus('open');
  }

  send(to: string, body: unknown): void {
    if (this.closed) return;
    // Copia como faria a rede, para ninguém partilhar objetos por engano.
    this.bus.deliver(this.id, to, JSON.parse(JSON.stringify(body ?? null)));
  }

  receive(from: string, body: unknown): void {
    if (!this.closed) this.emitMessage(from, body);
  }

  close(): void {
    this.closed = true;
    this.bus.unregister(this);
    this.setStatus('closed');
  }
}
