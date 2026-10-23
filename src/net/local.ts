import { BaseTransport } from './transport';

/** In-memory bus shared by the endpoints in one window. */
export class LocalBus {
  private endpoints = new Map<string, LocalTransport>();

  register(endpoint: LocalTransport): void {
    this.endpoints.set(endpoint.id, endpoint);
  }

  unregister(endpoint: LocalTransport): void {
    if (this.endpoints.get(endpoint.id) === endpoint) this.endpoints.delete(endpoint.id);
  }

  deliver(from: string, to: string, body: unknown): void {
    // Deliver asynchronously, like a network: avoids re-entrancy inside a render or dispatch.
    queueMicrotask(() => this.endpoints.get(to)?.receive(from, body));
  }
}

/** One screen: the table and the describer screen live in the same window. */
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
    // Copy as a network would, so nobody shares objects by accident.
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
