import { parseClientMessage, parseServerNotice, type DescriberCommand } from './protocol';
import { SERVER_ID } from './transport';

/** Tempo sem notícias até se considerar que a tela de quem explica caiu. */
export const PEER_TIMEOUT_MS = 6000;

export type HubEvent =
  | { type: 'accepted'; id: string }
  | { type: 'rejected'; id: string }
  | { type: 'command'; id: string; command: DescriberCommand }
  | { type: 'describer-lost'; id: string }
  | { type: 'peers-changed'; count: number };

/**
 * Do lado do anfitrião: decide quem é o explicador ativo (só um de cada vez),
 * ignora mensagens inválidas e deteta quedas de ligação.
 */
export class DescriberHub {
  private peers = new Map<string, number>();
  private active: string | null = null;

  constructor(private timeoutMs = PEER_TIMEOUT_MS) {}

  get activeId(): string | null {
    return this.active;
  }

  get connectedCount(): number {
    return this.peers.size;
  }

  receive(from: string, raw: unknown, now: number): HubEvent[] {
    if (from === SERVER_ID) {
      const notice = parseServerNotice(raw);
      return notice?.kind === 'peer-left' ? this.remove(notice.id) : [];
    }
    const message = parseClientMessage(raw);
    if (!message) return [];

    if (message.kind === 'bye') return this.remove(from);

    const events: HubEvent[] = [];
    const isNew = !this.peers.has(from);
    this.peers.set(from, now);
    if (isNew) events.push({ type: 'peers-changed', count: this.peers.size });

    const canClaim = this.active === null || this.active === from;
    if (!canClaim) {
      events.push({ type: 'rejected', id: from });
      return events;
    }
    this.active = from;
    if (message.kind === 'command') {
      events.push({ type: 'command', id: from, command: message.command });
    } else {
      events.push({ type: 'accepted', id: from });
    }
    return events;
  }

  /** O servidor avisou que o cliente saiu, ou chegou um "bye". */
  remove(id: string): HubEvent[] {
    if (!this.peers.has(id) && this.active !== id) return [];
    this.peers.delete(id);
    const events: HubEvent[] = [];
    if (this.active === id) {
      this.active = null;
      events.push({ type: 'describer-lost', id });
    }
    events.push({ type: 'peers-changed', count: this.peers.size });
    return events;
  }

  /** Chamar com regularidade: remove quem deixou de dar sinal. */
  sweep(now: number): HubEvent[] {
    const events: HubEvent[] = [];
    for (const [id, lastSeen] of [...this.peers]) {
      if (now - lastSeen > this.timeoutMs) events.push(...this.remove(id));
    }
    return events;
  }

  /** Liberta o lugar de explicador (para outro telemóvel poder entrar). */
  release(): void {
    this.active = null;
  }
}
