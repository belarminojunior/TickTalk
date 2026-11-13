import { PeerTransport, peerIdFor, randomRoomCode, type ConnLike, type PeerLike } from './peer';
import { HOST_ID, SERVER_ID } from './transport';

type Listener = (...args: any[]) => void;

class Emitter {
  private listeners = new Map<string, Listener[]>();
  on(event: string, listener: Listener) {
    this.listeners.set(event, [...(this.listeners.get(event) ?? []), listener]);
    return this;
  }
  emit(event: string, ...args: unknown[]) {
    for (const l of this.listeners.get(event) ?? []) l(...args);
  }
}

class FakeConn extends Emitter implements ConnLike {
  open = false;
  closed = false;
  other: FakeConn | null = null;
  constructor(
    readonly peer: string,
    readonly metadata?: unknown,
  ) {
    super();
  }
  send(data: unknown) {
    this.other?.emit('data', JSON.parse(JSON.stringify(data)));
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    this.open = false;
    this.emit('close');
    this.other?.close();
  }
}

class FakePeer extends Emitter implements PeerLike {
  destroyed = false;
  disconnected = false;
  dials: FakeConn[] = [];
  constructor(readonly id: string) {
    super();
  }
  connect(_target: string, options: { metadata: unknown }) {
    const conn = new FakeConn(_target, options.metadata);
    this.dials.push(conn);
    return conn;
  }
  reconnect() {}
  destroy() {
    this.destroyed = true;
  }
}

function broker() {
  const peers: FakePeer[] = [];
  let n = 0;
  return {
    peers,
    createPeer: async (id?: string) => {
      const peer = new FakePeer(id ?? `random-${n++}`);
      peers.push(peer);
      return peer;
    },
    /** Connects a phone's dial to the table, as PeerJS would. */
    link(dial: FakeConn, table: FakePeer) {
      const there = new FakeConn('phone-peer', dial.metadata);
      dial.other = there;
      there.other = dial;
      table.emit('connection', there);
      there.open = true;
      dial.open = true;
      there.emit('open');
      dial.emit('open');
      return there;
    },
  };
}

const flush = () => vi.advanceTimersByTimeAsync(0);

function received(t: PeerTransport) {
  const log: { from: string; body: any }[] = [];
  t.onMessage((from, body) => log.push({ from, body }));
  return log;
}

describe('PeerTransport (rooms without a server)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('a table opens its room under the code and says so', async () => {
    const b = broker();
    const onRoom = vi.fn();
    const table = new PeerTransport('host', HOST_ID, { createPeer: b.createPeer, newCode: () => 'KQTR', onRoom });
    const log = received(table);
    await flush();
    expect(b.peers[0].id).toBe(peerIdFor('KQTR'));
    expect(table.room).toBeNull(); // not open yet
    b.peers[0].emit('open');
    expect(table.status).toBe('open');
    expect(table.room).toBe('KQTR');
    expect(onRoom).toHaveBeenCalledWith('KQTR');
    expect(log).toContainEqual({ from: SERVER_ID, body: { v: 1, kind: 'room', code: 'KQTR', secret: '' } });
    table.close();
  });

  it('phone and table talk directly; the table knows the phone by its stable id, and when it leaves', async () => {
    const b = broker();
    const table = new PeerTransport('host', HOST_ID, { createPeer: b.createPeer, newCode: () => 'KQTR' });
    const tableLog = received(table);
    await flush();
    b.peers[0].emit('open');

    const phone = new PeerTransport('describer', 'c-1', { createPeer: b.createPeer, room: 'KQTR' });
    const phoneLog = received(phone);
    phone.send(HOST_ID, { hello: 1 }); // before the link is up: kept and sent once it is
    await flush();
    b.peers[1].emit('open');
    expect(b.peers[1].dials).toHaveLength(1);
    b.link(b.peers[1].dials[0], b.peers[0]);

    expect(phone.status).toBe('open');
    expect(phoneLog).toContainEqual({ from: SERVER_ID, body: { v: 1, kind: 'host-status', online: true } });
    expect(tableLog).toContainEqual({ from: 'c-1', body: { hello: 1 } });
    table.send('c-1', { view: 2 });
    expect(phoneLog).toContainEqual({ from: HOST_ID, body: { view: 2 } });

    phone.close();
    expect(tableLog).toContainEqual({ from: SERVER_ID, body: { v: 1, kind: 'peer-left', id: 'c-1' } });
    table.close();
  });

  it('a wrong code: the phone says there is no room, and keeps trying in case the table opens', async () => {
    const b = broker();
    const phone = new PeerTransport('describer', 'c-1', { createPeer: b.createPeer, room: 'ZZZZ' });
    await flush();
    b.peers[0].emit('open');
    b.peers[0].emit('error', { type: 'peer-unavailable' });
    expect(phone.status).toBe('noRoom');
    await vi.advanceTimersByTimeAsync(4100);
    expect(b.peers[0].dials).toHaveLength(2);
    expect(phone.status).toBe('noRoom');
    phone.close();
  });

  it('when the phone loses the table it calls again', async () => {
    const b = broker();
    const table = new PeerTransport('host', HOST_ID, { createPeer: b.createPeer, newCode: () => 'KQTR' });
    await flush();
    b.peers[0].emit('open');
    const phone = new PeerTransport('describer', 'c-1', { createPeer: b.createPeer, room: 'KQTR' });
    const phoneLog = received(phone);
    await flush();
    b.peers[1].emit('open');
    const there = b.link(b.peers[1].dials[0], b.peers[0]);
    there.close();
    expect(phoneLog).toContainEqual({ from: SERVER_ID, body: { v: 1, kind: 'host-status', online: false } });
    expect(phone.status).toBe('connecting');
    await vi.advanceTimersByTimeAsync(1100);
    expect(b.peers[1].dials).toHaveLength(2);
    phone.close();
    table.close();
  });

  it('a reloaded table waits for its old code; if another window keeps it, it says so, and can open a new room', async () => {
    const b = broker();
    const codes = ['BXYZ'];
    const table = new PeerTransport('host', HOST_ID, { createPeer: b.createPeer, room: 'KQTR', newCode: () => codes.shift()! });
    await flush();
    for (let i = 0; i < 5; i++) {
      b.peers[i].emit('error', { type: 'unavailable-id' });
      await vi.advanceTimersByTimeAsync(1600);
    }
    expect(b.peers.slice(0, 5).every((p) => p.id === peerIdFor('KQTR'))).toBe(true);
    expect(table.status).toBe('replaced');
    table.takeOver();
    await flush();
    expect(b.peers.at(-1)!.id).toBe(peerIdFor('BXYZ'));
    b.peers.at(-1)!.emit('open');
    expect(table.room).toBe('BXYZ');
    table.close();
  });

  it('a new table whose drawn code is taken just draws another', async () => {
    const b = broker();
    const codes = ['KQTR', 'BXYZ'];
    const table = new PeerTransport('host', HOST_ID, { createPeer: b.createPeer, newCode: () => codes.shift()! });
    await flush();
    b.peers[0].emit('error', { type: 'unavailable-id' });
    await flush();
    expect(b.peers[1].id).toBe(peerIdFor('BXYZ'));
    table.close();
  });

  it('refuses connections that do not say which phone they are', async () => {
    const b = broker();
    const table = new PeerTransport('host', HOST_ID, { createPeer: b.createPeer, newCode: () => 'KQTR' });
    await flush();
    b.peers[0].emit('open');
    const stranger = new FakeConn('x', { id: '../bad' });
    b.peers[0].emit('connection', stranger);
    expect(stranger.closed).toBe(true);
    table.close();
  });

  it('room codes are 4 letters without I or O', () => {
    for (let i = 0; i < 200; i++) expect(randomRoomCode()).toMatch(/^[A-HJ-NP-Z]{4}$/);
  });
});
