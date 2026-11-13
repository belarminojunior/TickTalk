import { WebSocketTransport, serverAddress } from './websocket';

/** Fake WebSocket: keeps its instances so the test can open and close them. */
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

  it('reconnects on its own when the connection drops', () => {
    const t = new WebSocketTransport('host', 'host', { url: 'ws://test/ws' });
    FakeSocket.instances[0].open();
    FakeSocket.instances[0].serverClose(1006);
    expect(t.status).toBe('connecting');
    vi.advanceTimersByTime(5000);
    expect(FakeSocket.instances).toHaveLength(2);
    t.close();
  });

  it('does not reconnect when another page takes its place (no ping-pong between tables)', () => {
    const t = new WebSocketTransport('host', 'host', { url: 'ws://test/ws' });
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

  it('same for a duplicated describer tab', () => {
    const t = new WebSocketTransport('describer', 'c-1', { url: 'ws://test/ws' });
    FakeSocket.instances[0].open();
    FakeSocket.instances[0].serverClose(4001);
    expect(t.status).toBe('replaced');
    vi.advanceTimersByTime(60_000);
    expect(FakeSocket.instances).toHaveLength(1);
    t.close();
  });

  it('a table remembers the room the server gave it and asks for it again when it reconnects', () => {
    const onRoom = vi.fn();
    const t = new WebSocketTransport('host', 'host', { onRoom });
    expect(FakeSocket.instances[0].url).not.toContain('room=');
    FakeSocket.instances[0].open();
    const secret = 'abcdefghijklmnopqrstuvwx';
    FakeSocket.instances[0].onmessage?.({ data: JSON.stringify({ from: 'server', body: { v: 1, kind: 'room', code: 'KQTR', secret } }) });
    expect(onRoom).toHaveBeenCalledWith({ code: 'KQTR', secret });
    expect(t.room).toBe('KQTR');
    FakeSocket.instances[0].serverClose(1006);
    vi.advanceTimersByTime(5000);
    expect(FakeSocket.instances[1].url).toContain(`room=KQTR&secret=${secret}`);
    t.close();
  });

  it('a phone with a wrong room code says so, and keeps trying in case the table opens it', () => {
    const t = new WebSocketTransport('describer', 'c-1', { room: 'ZZZZ' });
    expect(FakeSocket.instances[0].url).toContain('room=ZZZZ');
    FakeSocket.instances[0].serverClose(4004);
    expect(t.status).toBe('noRoom');
    vi.advanceTimersByTime(4100);
    expect(FakeSocket.instances).toHaveLength(2);
    // Still "no room" while retrying (no flicker to "connecting").
    expect(t.status).toBe('noRoom');
    FakeSocket.instances[1].open();
    expect(t.status).toBe('open');
    t.close();
  });
});

describe('serverAddress', () => {
  it('uses the configured game server (pages hosted elsewhere), or else this page’s address', () => {
    expect(serverAddress('https://tick-talk.onrender.com')).toEqual({ secure: true, host: 'tick-talk.onrender.com' });
    expect(serverAddress('http://192.168.0.5:5174')).toEqual({ secure: false, host: '192.168.0.5:5174' });
    expect(serverAddress(undefined)).toEqual({ secure: window.location.protocol === 'https:', host: window.location.host });
    expect(serverAddress('not a url')).toEqual({ secure: window.location.protocol === 'https:', host: window.location.host });
  });
});
