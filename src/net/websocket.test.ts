import { WebSocketTransport } from './websocket';

/** WebSocket falso: guarda as instâncias para o teste as abrir e fechar. */
class FakeSocket {
  static OPEN = 1;
  static instances: FakeSocket[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: ((e: { code: number }) => void) | null = null;
  onerror: (() => void) | null = null;
  sent: string[] = [];
  constructor(readonly url: string) {
    FakeSocket.instances.push(this);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.serverClose(1000);
  }
  open() {
    this.readyState = FakeSocket.OPEN;
    this.onopen?.();
  }
  serverClose(code: number) {
    this.readyState = 3;
    this.onclose?.({ code });
  }
}

describe('WebSocketTransport', () => {
  const RealWebSocket = globalThis.WebSocket;
  beforeEach(() => {
    FakeSocket.instances = [];
    globalThis.WebSocket = FakeSocket as unknown as typeof WebSocket;
    vi.useFakeTimers();
  });
  afterEach(() => {
    globalThis.WebSocket = RealWebSocket;
    vi.useRealTimers();
  });

  it('volta a ligar sozinho quando a ligação cai', () => {
    const t = new WebSocketTransport('host', 'host', 'ws://test/ws');
    FakeSocket.instances[0].open();
    FakeSocket.instances[0].serverClose(1006);
    expect(t.status).toBe('connecting');
    vi.advanceTimersByTime(5000);
    expect(FakeSocket.instances).toHaveLength(2);
    t.close();
  });

  it('não volta a ligar quando outra página fica com o lugar (sem ping-pong entre mesas)', () => {
    const t = new WebSocketTransport('host', 'host', 'ws://test/ws');
    FakeSocket.instances[0].open();
    FakeSocket.instances[0].serverClose(4000);
    expect(t.status).toBe('replaced');
    vi.advanceTimersByTime(60_000);
    expect(FakeSocket.instances).toHaveLength(1);
    t.reconnectNow();
    expect(FakeSocket.instances).toHaveLength(1);

    t.takeOver();
    expect(FakeSocket.instances).toHaveLength(2);
    FakeSocket.instances[1].open();
    expect(t.status).toBe('open');
    t.close();
  });

  it('o mesmo para um separador de quem explica duplicado', () => {
    const t = new WebSocketTransport('describer', 'c-1', 'ws://test/ws');
    FakeSocket.instances[0].open();
    FakeSocket.instances[0].serverClose(4001);
    expect(t.status).toBe('replaced');
    vi.advanceTimersByTime(60_000);
    expect(FakeSocket.instances).toHaveLength(1);
    t.close();
  });
});
