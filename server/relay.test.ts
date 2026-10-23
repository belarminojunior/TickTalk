// @vitest-environment node
import { Relay, isValidClientId, type Connection } from './relay';

function fake(): Connection & { sent: unknown[]; closed: number | null } {
  const c = {
    sent: [] as unknown[],
    closed: null as number | null,
    send(data: string) {
      c.sent.push(JSON.parse(data));
    },
    close(code?: number) {
      c.closed = code ?? 1000;
    },
  };
  return c;
}

describe('Relay', () => {
  it('relays phone → table, and table → only the right phone', () => {
    const relay = new Relay();
    const host = fake();
    const a = fake();
    const b = fake();
    relay.addHost(host);
    relay.addDescriber('a', a);
    relay.addDescriber('b', b);
    relay.fromDescriber('a', a, JSON.stringify({ to: 'host', body: { v: 1, kind: 'hello' } }));
    expect(host.sent).toContainEqual({ from: 'a', body: { v: 1, kind: 'hello' } });
    relay.fromHost(host, JSON.stringify({ to: 'b', body: { secret: 1 } }));
    expect(b.sent).toContainEqual({ from: 'host', body: { secret: 1 } });
    expect(a.sent.some((m) => JSON.stringify(m).includes('secret'))).toBe(false);
  });

  it('ignores garbage and messages not addressed to the table', () => {
    const relay = new Relay();
    const host = fake();
    const a = fake();
    relay.addHost(host);
    relay.addDescriber('a', a);
    relay.fromDescriber('a', a, 'not json');
    relay.fromDescriber('a', a, JSON.stringify({ to: 'b', body: 1 }));
    relay.fromDescriber('a', a, JSON.stringify({ body: 1 }));
    expect(host.sent).toEqual([]);
  });

  it('tells the table when a phone leaves, and the phones when the table leaves', () => {
    const relay = new Relay();
    const host = fake();
    const a = fake();
    relay.addDescriber('a', a);
    expect(a.sent).toContainEqual({ from: 'server', body: { v: 1, kind: 'host-status', online: false } });
    relay.addHost(host);
    expect(a.sent).toContainEqual({ from: 'server', body: { v: 1, kind: 'host-status', online: true } });
    relay.removeDescriber('a', a);
    expect(host.sent).toContainEqual({ from: 'server', body: { v: 1, kind: 'peer-left', id: 'a' } });
  });

  it('a new connection with the same id replaces the old one', () => {
    const relay = new Relay();
    const host = fake();
    const old = fake();
    const fresh = fake();
    relay.addHost(host);
    relay.addDescriber('a', old);
    relay.addDescriber('a', fresh);
    expect(old.closed).toBe(4001);
    relay.removeDescriber('a', old); // the old socket's late close must not remove the new one
    expect(relay.describerCount).toBe(1);
    expect(host.sent).not.toContainEqual({ from: 'server', body: { v: 1, kind: 'peer-left', id: 'a' } });
  });

  it('validates ids', () => {
    expect(isValidClientId('c-abc123')).toBe(true);
    expect(isValidClientId('host')).toBe(false);
    expect(isValidClientId('../x')).toBe(false);
    expect(isValidClientId(null)).toBe(false);
  });
});
