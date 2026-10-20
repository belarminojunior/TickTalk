import { BaseTransport } from './transport';

export const CHANNEL_NAME = 'ticktalk-v1';

interface Envelope {
  from: string;
  to: string;
  body: unknown;
}

function isEnvelope(x: unknown): x is Envelope {
  if (typeof x !== 'object' || x === null) return false;
  const e = x as Partial<Envelope>;
  return typeof e.from === 'string' && typeof e.to === 'string';
}

/** Duas janelas no mesmo PC (e no mesmo browser): BroadcastChannel. */
export class BroadcastChannelTransport extends BaseTransport {
  readonly kind = 'broadcast' as const;
  private channel: BroadcastChannel;

  constructor(id: string, channelName = CHANNEL_NAME) {
    super(id);
    this.channel = new BroadcastChannel(channelName);
    this.channel.onmessage = (event: MessageEvent) => {
      const data: unknown = event.data;
      if (!isEnvelope(data) || data.to !== this.id) return;
      this.emitMessage(data.from, data.body);
    };
    this.setStatus('open');
  }

  send(to: string, body: unknown): void {
    if (this.status === 'closed') return;
    const envelope: Envelope = { from: this.id, to, body };
    this.channel.postMessage(envelope);
  }

  close(): void {
    this.channel.close();
    this.setStatus('closed');
  }

  static isSupported(): boolean {
    return typeof BroadcastChannel !== 'undefined';
  }
}
