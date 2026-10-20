/**
 * Reencaminhador de mensagens entre a mesa (anfitrião) e as telas de quem explica.
 * Não conhece as regras do jogo: só entrega envelopes {to, body} e avisa quando alguém sai.
 */

export const PROTOCOL_VERSION = 1;
export const HOST_ID = 'host';
export const SERVER_ID = 'server';

export interface Connection {
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_MESSAGE_BYTES = 64 * 1024;

export function isValidClientId(id: unknown): id is string {
  return typeof id === 'string' && ID_PATTERN.test(id) && id !== HOST_ID && id !== SERVER_ID;
}

function envelope(from: string, body: unknown): string {
  return JSON.stringify({ from, body });
}

function parse(data: string): { to: string; body: unknown } | null {
  if (data.length > MAX_MESSAGE_BYTES) return null;
  try {
    const value = JSON.parse(data) as { to?: unknown; body?: unknown };
    if (!value || typeof value !== 'object' || typeof value.to !== 'string') return null;
    return { to: value.to, body: value.body };
  } catch {
    return null;
  }
}

/** Ligação fechada porque outra página ficou com o mesmo papel (o cliente não volta a ligar sozinho). */
export const CLOSE_HOST_REPLACED = 4000;
export const CLOSE_DESCRIBER_REPLACED = 4001;

export class Relay {
  private host: Connection | null = null;
  private describers = new Map<string, Connection>();

  get describerCount(): number {
    return this.describers.size;
  }

  get hasHost(): boolean {
    return this.host !== null;
  }

  /** Uma nova mesa substitui a anterior (por exemplo, depois de recarregar a página). */
  addHost(conn: Connection): void {
    if (this.host && this.host !== conn) this.host.close(CLOSE_HOST_REPLACED, 'replaced');
    this.host = conn;
    this.broadcastHostStatus(true);
  }

  addDescriber(id: string, conn: Connection): void {
    const previous = this.describers.get(id);
    if (previous && previous !== conn) previous.close(CLOSE_DESCRIBER_REPLACED, 'replaced');
    this.describers.set(id, conn);
    conn.send(envelope(SERVER_ID, { v: PROTOCOL_VERSION, kind: 'host-status', online: this.host !== null }));
  }

  fromHost(conn: Connection, data: string): void {
    if (conn !== this.host) return;
    const msg = parse(data);
    if (!msg) return;
    this.describers.get(msg.to)?.send(envelope(HOST_ID, msg.body));
  }

  fromDescriber(id: string, conn: Connection, data: string): void {
    if (this.describers.get(id) !== conn) return;
    const msg = parse(data);
    if (!msg || msg.to !== HOST_ID) return;
    this.host?.send(envelope(id, msg.body));
  }

  removeHost(conn: Connection): void {
    if (this.host !== conn) return;
    this.host = null;
    this.broadcastHostStatus(false);
  }

  removeDescriber(id: string, conn: Connection): void {
    if (this.describers.get(id) !== conn) return;
    this.describers.delete(id);
    this.host?.send(envelope(SERVER_ID, { v: PROTOCOL_VERSION, kind: 'peer-left', id }));
  }

  private broadcastHostStatus(online: boolean): void {
    const data = envelope(SERVER_ID, { v: PROTOCOL_VERSION, kind: 'host-status', online });
    for (const conn of this.describers.values()) conn.send(data);
  }
}
