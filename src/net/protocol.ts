import type { DescriberView } from '../game/selectors';
import type { Language } from '../game/types';

/** Versão do protocolo anfitrião ⇄ quem explica. Mensagens de outra versão são ignoradas. */
export const PROTOCOL_VERSION = 1;

export type DescriberCommand =
  | { type: 'READY' }
  | { type: 'START' }
  | { type: 'TOGGLE_WORD'; index: number }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'END_EARLY' };

/** Quem explica → anfitrião. */
export type ClientMessage =
  | { v: 1; kind: 'hello' }
  | { v: 1; kind: 'ping' }
  | { v: 1; kind: 'bye' }
  | { v: 1; kind: 'command'; command: DescriberCommand };

/** Anfitrião → quem explica. */
export type HostMessage =
  | { v: 1; kind: 'state'; view: DescriberView }
  | { v: 1; kind: 'busy'; language?: Language }
  | { v: 1; kind: 'host-bye' };

/** Mensagens do servidor WebSocket (não do anfitrião). */
export type ServerNotice =
  | { v: 1; kind: 'peer-left'; id: string }
  | { v: 1; kind: 'host-status'; online: boolean };

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
      return { type: raw.type };
    case 'TOGGLE_WORD': {
      const i = raw.index;
      if (typeof i !== 'number' || !Number.isInteger(i) || i < 0 || i > 4) return null;
      return { type: 'TOGGLE_WORD', index: i };
    }
    default:
      return null;
  }
}

export function parseClientMessage(raw: unknown): ClientMessage | null {
  if (!isObject(raw) || raw.v !== PROTOCOL_VERSION) return null;
  switch (raw.kind) {
    case 'hello':
    case 'ping':
    case 'bye':
      return { v: 1, kind: raw.kind };
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
  return null;
}

export const msg = {
  hello: (): ClientMessage => ({ v: 1, kind: 'hello' }),
  ping: (): ClientMessage => ({ v: 1, kind: 'ping' }),
  bye: (): ClientMessage => ({ v: 1, kind: 'bye' }),
  command: (command: DescriberCommand): ClientMessage => ({ v: 1, kind: 'command', command }),
  state: (view: DescriberView): HostMessage => ({ v: 1, kind: 'state', view }),
  busy: (language?: Language): HostMessage => ({ v: 1, kind: 'busy', language }),
  hostBye: (): HostMessage => ({ v: 1, kind: 'host-bye' }),
};
