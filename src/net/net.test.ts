import { DescriberHub } from './hub';
import { LocalBus, LocalTransport } from './local';
import { msg, parseClientMessage, parseHostMessage } from './protocol';
import { HOST_ID, SERVER_ID } from './transport';

describe('protocolo', () => {
  it('ignora mensagens inválidas ou de outra versão', () => {
    expect(parseClientMessage(null)).toBeNull();
    expect(parseClientMessage('hello')).toBeNull();
    expect(parseClientMessage({ kind: 'hello' })).toBeNull();
    expect(parseClientMessage({ v: 2, kind: 'hello' })).toBeNull();
    expect(parseClientMessage({ v: 1, kind: 'dance' })).toBeNull();
    expect(parseClientMessage({ v: 1, kind: 'command', command: { type: 'TOGGLE_WORD', index: 7 } })).toBeNull();
    expect(parseClientMessage({ v: 1, kind: 'command', command: { type: 'TOGGLE_WORD', index: 1.5 } })).toBeNull();
    expect(parseClientMessage({ v: 1, kind: 'command', command: { type: 'RESET' } })).toBeNull();
    expect(parseHostMessage({ v: 1, kind: 'state', view: 'x' })).toBeNull();
  });

  it('aceita mensagens válidas', () => {
    expect(parseClientMessage(msg.hello())).toEqual({ v: 1, kind: 'hello' });
    expect(parseClientMessage(msg.command({ type: 'TOGGLE_WORD', index: 4 }))).toEqual({
      v: 1,
      kind: 'command',
      command: { type: 'TOGGLE_WORD', index: 4 },
    });
    expect(parseHostMessage(msg.busy('pt'))).toEqual({ v: 1, kind: 'busy', language: 'pt' });
  });
});

describe('DescriberHub', () => {
  it('aceita o primeiro explicador e recusa um segundo', () => {
    const hub = new DescriberHub();
    expect(hub.receive('a', msg.hello(), 0)).toContainEqual({ type: 'accepted', id: 'a' });
    expect(hub.receive('b', msg.hello(), 0)).toContainEqual({ type: 'rejected', id: 'b' });
    expect(hub.activeId).toBe('a');
    expect(hub.connectedCount).toBe(2);
  });

  it('ignora comandos de quem não é o explicador ativo', () => {
    const hub = new DescriberHub();
    hub.receive('a', msg.hello(), 0);
    const events = hub.receive('b', msg.command({ type: 'END_EARLY' }), 0);
    expect(events.some((e) => e.type === 'command')).toBe(false);
    expect(hub.receive('a', msg.command({ type: 'END_EARLY' }), 0)).toContainEqual({
      type: 'command',
      id: 'a',
      command: { type: 'END_EARLY' },
    });
  });

  it('ignora lixo', () => {
    const hub = new DescriberHub();
    expect(hub.receive('a', { v: 1, kind: 'nope' }, 0)).toEqual([]);
    expect(hub.receive('a', 42, 0)).toEqual([]);
    expect(hub.connectedCount).toBe(0);
  });

  it('avisa quando o explicador se desliga (bye, servidor ou silêncio) e liberta o lugar', () => {
    const hub = new DescriberHub(5000);
    hub.receive('a', msg.hello(), 0);
    expect(hub.receive('a', msg.bye(), 10)).toContainEqual({ type: 'describer-lost', id: 'a' });
    expect(hub.activeId).toBeNull();

    hub.receive('b', msg.hello(), 0);
    expect(hub.receive(SERVER_ID, { v: 1, kind: 'peer-left', id: 'b' }, 1)).toContainEqual({
      type: 'describer-lost',
      id: 'b',
    });

    hub.receive('c', msg.hello(), 0);
    expect(hub.sweep(4000)).toEqual([]);
    hub.receive('c', msg.ping(), 4000);
    expect(hub.sweep(8000)).toEqual([]);
    expect(hub.sweep(9500)).toContainEqual({ type: 'describer-lost', id: 'c' });
  });

  it('um telemóvel à espera fica com o lugar quando o ativo sai', () => {
    const hub = new DescriberHub();
    hub.receive('a', msg.hello(), 0);
    hub.receive('b', msg.hello(), 0);
    hub.receive('a', msg.bye(), 1);
    expect(hub.receive('b', msg.ping(), 2)).toContainEqual({ type: 'accepted', id: 'b' });
  });
});

describe('LocalTransport', () => {
  it('entrega só ao destinatário, de forma assíncrona e com cópia', async () => {
    const bus = new LocalBus();
    const host = new LocalTransport(bus, HOST_ID);
    const a = new LocalTransport(bus, 'a');
    const b = new LocalTransport(bus, 'b');
    const got: [string, string, unknown][] = [];
    host.onMessage((from, body) => got.push(['host', from, body]));
    a.onMessage((from, body) => got.push(['a', from, body]));
    b.onMessage((from, body) => got.push(['b', from, body]));
    const body = { x: 1 };
    a.send(HOST_ID, body);
    host.send('b', { y: 2 });
    expect(got).toEqual([]);
    await Promise.resolve();
    expect(got).toEqual([
      ['host', 'a', { x: 1 }],
      ['b', 'host', { y: 2 }],
    ]);
    expect(got[0][2]).not.toBe(body);
  });
});
