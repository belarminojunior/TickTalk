// @vitest-environment node
import { CLOSE_NO_ROOM, CLOSE_ROOM_FULL, Rooms, normalizeRoomCode } from './rooms';
import type { Connection } from './relay';

function fake(): Connection & { sent: { from: string; body: Record<string, unknown> }[]; closed: number | null } {
  const c = {
    sent: [] as { from: string; body: Record<string, unknown> }[],
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

function codes(...list: string[]) {
  let i = 0;
  return () => list[i++ % list.length];
}

const SECRET = 'secret-0123456789abcdef';
const roomNotice = (c: ReturnType<typeof fake>) => c.sent.find((m) => m.from === 'server' && m.body.kind === 'room')?.body;

describe('Rooms', () => {
  it('gives each table its own code, and tells it the code and its secret', () => {
    const rooms = new Rooms({ newCode: codes('KQTR', 'BXYZ'), newSecret: () => SECRET });
    const table = fake();
    const room = rooms.hostJoin(table, null)!;
    expect(room.code).toBe('KQTR');
    expect(roomNotice(table)).toEqual({ v: 1, kind: 'room', code: 'KQTR', secret: SECRET });
    expect(rooms.hostJoin(fake(), null)!.code).toBe('BXYZ');
    expect(rooms.count).toBe(2);
  });

  it('messages never cross rooms', () => {
    const rooms = new Rooms({ newCode: codes('KQTR', 'BXYZ') });
    const t1 = fake();
    const t2 = fake();
    const r1 = rooms.hostJoin(t1, null)!;
    const r2 = rooms.hostJoin(t2, null)!;
    const phone1 = fake();
    const phone2 = fake();
    rooms.describerJoin('kqtr', 'p1', phone1);
    rooms.describerJoin('BXYZ', 'p1', phone2);
    r1.relay.fromHost(t1, JSON.stringify({ to: 'p1', body: { secret: 1 } }));
    expect(phone1.sent).toContainEqual({ from: 'host', body: { secret: 1 } });
    expect(phone2.sent.some((m) => 'secret' in m.body)).toBe(false);
    r2.relay.fromDescriber('p1', phone2, JSON.stringify({ to: 'host', body: { hi: 2 } }));
    expect(t2.sent).toContainEqual({ from: 'p1', body: { hi: 2 } });
    expect(t1.sent.some((m) => 'hi' in m.body)).toBe(false);
  });

  it('a phone with a wrong code is turned away', () => {
    const rooms = new Rooms({ newCode: codes('KQTR') });
    rooms.hostJoin(fake(), null);
    const phone = fake();
    expect(rooms.describerJoin('ZZZZ', 'p1', phone)).toBeNull();
    expect(phone.closed).toBe(CLOSE_NO_ROOM);
    expect(rooms.describerJoin('not a code', 'p2', fake())).toBeNull();
  });

  it('the table takes its room back with its secret; without it, it gets another room', () => {
    const rooms = new Rooms({ newCode: codes('KQTR', 'BXYZ'), newSecret: () => SECRET });
    const first = fake();
    rooms.hostJoin(first, null);
    const phone = fake();
    rooms.describerJoin('KQTR', 'p1', phone);

    const reloaded = fake();
    expect(rooms.hostJoin(reloaded, { code: 'KQTR', secret: SECRET })!.code).toBe('KQTR');
    expect(first.closed).toBe(4000);

    const intruder = fake();
    expect(rooms.hostJoin(intruder, { code: 'KQTR', secret: 'someone-elses-secret-xyz' })!.code).toBe('BXYZ');
    expect(reloaded.closed).toBeNull();
  });

  it('after a server restart the table recreates its room at the same code', () => {
    const rooms = new Rooms({ newCode: codes('BXYZ') });
    expect(rooms.hostJoin(fake(), { code: 'KQTR', secret: SECRET })!.code).toBe('KQTR');
    expect(rooms.describerJoin('KQTR', 'p1', fake())).not.toBeNull();
  });

  it('caps the phones per room and the number of rooms', () => {
    const rooms = new Rooms({ newCode: codes('KQTR', 'BXYZ'), maxPhonesPerRoom: 2, maxRooms: 1 });
    rooms.hostJoin(fake(), null);
    rooms.describerJoin('KQTR', 'p1', fake());
    rooms.describerJoin('KQTR', 'p2', fake());
    const third = fake();
    expect(rooms.describerJoin('KQTR', 'p3', third)).toBeNull();
    expect(third.closed).toBe(CLOSE_ROOM_FULL);
    // The same phone reconnecting is not a new phone.
    expect(rooms.describerJoin('KQTR', 'p2', fake())).not.toBeNull();
    expect(rooms.hostJoin(fake(), null)).toBeNull();
  });

  it('forgets rooms that stayed empty for too long', () => {
    const rooms = new Rooms({ newCode: codes('KQTR'), idleMs: 1000 });
    const table = fake();
    const room = rooms.hostJoin(table, null)!;
    const phone = fake();
    rooms.describerJoin('KQTR', 'p1', phone);
    rooms.hostLeft(room, table, 0);
    rooms.sweep(5000);
    expect(rooms.count).toBe(1); // a phone is still there
    rooms.describerLeft(room, 'p1', phone, 10_000);
    rooms.sweep(10_500);
    expect(rooms.count).toBe(1);
    rooms.sweep(11_500);
    expect(rooms.count).toBe(0);
  });

  it('room codes: 4 letters, no I or O, any case', () => {
    expect(normalizeRoomCode(' kqtr ')).toBe('KQTR');
    expect(normalizeRoomCode('KQT')).toBeNull();
    expect(normalizeRoomCode('KOTR')).toBeNull();
    expect(normalizeRoomCode(null)).toBeNull();
  });
});
