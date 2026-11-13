import { createInitialState, gameReducer, type GameAction } from '../game/reducer';
import { mayPlayerCommand, playerPhoneView, type Lobby, type PlayerPhone } from '../game/selectors';
import type { GameState } from '../game/types';
import { TEST_CARDS, settings } from '../test/fixtures';
import { msg, parseClientMessage } from './protocol';
import { PlayerHub } from './playerHub';

const TEAMS = ['t1', 't2'];
const me = (key: string, name: string, team: string | null = null) => msg.me({ key, name, team });

describe('protocol (one phone per person)', () => {
  it('carries who the phone is, and cleans or rejects bad names', () => {
    expect(parseClientMessage(me('key-1', '  Ana   Rita ', 't1'))).toEqual({
      v: 1,
      kind: 'me',
      player: { key: 'key-1', name: 'Ana Rita', team: 't1' },
    });
    expect(parseClientMessage(msg.me(null))).toEqual({ v: 1, kind: 'me', player: null });
    expect(parseClientMessage(me('key-1', '   '))).toBeNull();
    expect(parseClientMessage(me('key-1', 'x'.repeat(25)))).toBeNull();
    expect(parseClientMessage(me('../x', 'Ana'))).toBeNull();
    // A bad player on a heartbeat is dropped, the heartbeat still counts.
    expect(parseClientMessage({ v: 1, kind: 'ping', player: { key: 'k', name: 'Ana', team: null } })).toEqual({ v: 1, kind: 'ping' });
    expect(parseClientMessage(msg.ping(undefined, { key: 'key-1', name: 'Ana', team: 't2' }))).toEqual({
      v: 1,
      kind: 'ping',
      player: { key: 'key-1', name: 'Ana', team: 't2' },
    });
  });
});

describe('PlayerHub', () => {
  it('each phone writes a name and picks a team; the roster keeps the order people joined their team', () => {
    const hub = new PlayerHub();
    expect(hub.receive('a', msg.hello(), 0, TEAMS)).toContainEqual({ type: 'sync', id: 'a' });
    expect(hub.playerOf('a')).toBeNull();
    expect(hub.receive('a', me('key-a', 'Ana'), 0, TEAMS)).toContainEqual({ type: 'roster-changed' });
    hub.receive('b', me('key-b', 'Rui', 't2'), 0, TEAMS);
    hub.receive('a', me('key-a', 'Ana', 't1'), 0, TEAMS);
    // Rui picked a team before Ana did (that order decides who describes first in a team).
    expect(hub.roster()).toEqual([
      { key: 'key-b', name: 'Rui', team: 't2', online: true },
      { key: 'key-a', name: 'Ana', team: 't1', online: true },
    ]);
    expect(hub.teamsOnline().sort()).toEqual(['t1', 't2']);
    // An unknown team counts as none.
    hub.receive('b', me('key-b', 'Rui', 't9'), 0, TEAMS);
    expect(hub.playerOf('b')?.team).toBeNull();
  });

  it('a name is refused while someone with it is connected, and taken over when they are gone', () => {
    const hub = new PlayerHub();
    hub.receive('a', me('key-a', 'Ana', 't1'), 0, TEAMS);
    hub.receive('b', me('key-b', 'ana'), 0, TEAMS);
    expect(hub.issueOf('b')).toBe('nameTaken');
    expect(hub.playerOf('b')).toBeNull();
    // A heartbeat doesn't clear the message; trying again with another name does.
    hub.receive('b', msg.ping(), 1, TEAMS);
    expect(hub.issueOf('b')).toBe('nameTaken');
    hub.receive('b', me('key-b', 'Ana B.'), 1, TEAMS);
    expect(hub.issueOf('b')).toBeNull();

    // Ana's phone goes away; the same person on a new phone takes the name and the team.
    hub.remove('a');
    hub.receive('c', me('key-c', 'Ana'), 2, TEAMS);
    expect(hub.playerOf('c')).toEqual({ key: 'key-c', name: 'Ana', team: 't1' });
    expect(hub.roster().map((p) => p.name)).toEqual(['Ana', 'Ana B.']);
  });

  it('a phone that comes back is recognised by its key, or by what it remembers if the table forgot', () => {
    const hub = new PlayerHub();
    hub.receive('a', me('key-a', 'Ana', 't1'), 0, TEAMS);
    hub.remove('a');
    expect(hub.roster()[0].online).toBe(false);
    hub.receive('a2', msg.hello(undefined, { key: 'key-a', name: 'Ana', team: 't1' }), 1, TEAMS);
    expect(hub.playerOf('a2')).toEqual({ key: 'key-a', name: 'Ana', team: 't1' });

    // The table was reloaded: a new hub learns everyone from their heartbeats.
    const fresh = new PlayerHub();
    fresh.receive('a3', msg.ping(undefined, { key: 'key-a', name: 'Ana', team: 't1' }), 0, TEAMS);
    expect(fresh.roster()).toEqual([{ key: 'key-a', name: 'Ana', team: 't1', online: true }]);
  });

  it("heartbeats don't undo the table's changes; the person's own choices do", () => {
    const hub = new PlayerHub();
    hub.receive('a', me('key-a', 'Ana', 't1'), 0, TEAMS);
    hub.assign({ t2: ['key-a'] });
    hub.receive('a', msg.ping(undefined, { key: 'key-a', name: 'Ana', team: 't1' }), 1, TEAMS);
    expect(hub.playerOf('a')?.team).toBe('t2');
    hub.receive('a', me('key-a', 'Ana', 't1'), 2, TEAMS);
    expect(hub.playerOf('a')?.team).toBe('t1');
  });

  it('the table can remove someone; their phone has to write a name again', () => {
    const hub = new PlayerHub();
    hub.receive('a', me('key-a', 'Ana', 't1'), 0, TEAMS);
    hub.kick('key-a');
    expect(hub.roster()).toEqual([]);
    expect(hub.issueOf('a')).toBe('removed');
    hub.receive('a', msg.ping(undefined, { key: 'key-a', name: 'Ana', team: 't1' }), 1, TEAMS);
    expect(hub.roster()).toEqual([]);
    hub.receive('a', me('key-a', 'Ana'), 2, TEAMS);
    expect(hub.playerOf('a')?.name).toBe('Ana');
    expect(hub.issueOf('a')).toBeNull();
  });

  it('deleting a setup row frees its players and moves the later rows up', () => {
    const hub = new PlayerHub();
    const three = ['t1', 't2', 't3'];
    hub.receive('a', me('key-a', 'Ana', 't1'), 0, three);
    hub.receive('b', me('key-b', 'Rui', 't2'), 0, three);
    hub.receive('c', me('key-c', 'Zé', 't3'), 0, three);
    hub.removeTeamAt(1);
    expect(hub.roster().map((p) => [p.name, p.team])).toEqual([
      ['Ana', 't1'],
      ['Rui', null],
      ['Zé', 't2'],
    ]);
  });

  it("commands carry the sender's name and team; phones without a player can't command", () => {
    const hub = new PlayerHub();
    hub.receive('x', msg.hello(), 0, TEAMS);
    expect(hub.receive('x', msg.command({ type: 'READY' }), 0, TEAMS)).toEqual([]);
    hub.receive('a', me('key-a', 'Ana', 't1'), 0, TEAMS);
    expect(hub.receive('a', msg.command({ type: 'READY' }), 0, TEAMS)).toEqual([
      { type: 'command', id: 'a', player: { name: 'Ana', team: 't1' }, command: { type: 'READY' } },
    ]);
  });
});

describe('phone views (one phone per person)', () => {
  const LOBBY: Lobby = {
    teams: [
      { id: 't1', name: 'Os Leões', color: 'red' },
      { id: 't2', name: 'As Gazelas', color: 'green' },
    ],
    roster: [
      { name: 'Ana', team: 't1', online: true },
      { name: 'Pedro', team: 't1', online: true },
      { name: 'Tomás', team: 't2', online: true },
      { name: 'Rita', team: 't2', online: false },
    ],
    language: 'pt',
  };
  const phone = (name: string | null, team: string | null = null): PlayerPhone => ({
    player: name ? { name, team } : null,
    issue: null,
  });

  function game(...actions: GameAction[]): GameState {
    return [
      {
        type: 'SETUP',
        settings: settings({ screenMode: 'playerPhones' }),
        teams: [
          { name: 'Os Leões', color: 'red', players: ['Ana', 'Pedro'] },
          { name: 'As Gazelas', color: 'green', players: ['Tomás', 'Rita'] },
        ],
        cards: TEST_CARDS,
        seed: 1,
      } as GameAction,
      ...actions,
    ].reduce(gameReducer, createInitialState());
  }

  it('before the game: the setup rows with who is in each', () => {
    const view = playerPhoneView(createInitialState(), 0, phone('Ana', 't1'), LOBBY);
    expect(view.mode).toBe('playerPhones');
    expect(view.you).toMatchObject({ name: 'Ana', teamId: 't1' });
    expect(view.teamsList.map((t) => t.members)).toEqual([
      ['Ana', 'Pedro'],
      ['Tomás', 'Rita'],
    ]);
  });

  it('during the turn only the describer has the words; teammates and others follow without them', () => {
    const s = game({ type: 'READY' }, { type: 'START_TURN', now: 0 });
    const ana = playerPhoneView(s, 0, phone('Ana', 't1'), LOBBY);
    const pedro = playerPhoneView(s, 0, phone('Pedro', 't1'), LOBBY);
    const tomas = playerPhoneView(s, 0, phone('Tomás', 't2'), LOBBY);
    expect(ana.you.role).toBe('describer');
    expect(ana.words).not.toBeNull();
    expect(pedro.you.role).toBe('guesser');
    expect(tomas.you.role).toBe('spectator');
    for (const v of [pedro, tomas]) expect(JSON.stringify(v)).not.toMatch(/Yellow\d|Blue\d/);
  });

  it('the whole checking team gets the card to validate', () => {
    const s = game({ type: 'READY' }, { type: 'START_TURN', now: 0 }, { type: 'TOGGLE_WORD', index: 0, now: 1 }, { type: 'END_EARLY', now: 2 }, { type: 'BEGIN_VALIDATION' });
    for (const name of ['Tomás', 'Rita']) {
      const view = playerPhoneView(s, 0, phone(name, 't2'), LOBBY);
      expect(view.you.role).toBe('validator');
      expect(view.validation?.marked.blue[0]).toBe(true);
    }
    expect(playerPhoneView(s, 0, phone('Pedro', 't1'), LOBBY).validation).toBeNull();
  });

  it("a phone that isn't one of the game's players gets the list to pick from", () => {
    const s = game();
    const view = playerPhoneView(s, 0, phone(null), LOBBY);
    expect(view.you.teamId).toBeNull();
    expect(view.claimable).toContainEqual({ team: 't2', name: 'Rita', online: false });
    expect(view.claimable).toContainEqual({ team: 't1', name: 'Ana', online: true });
    // Someone with a name that isn't in the game is treated the same way.
    expect(playerPhoneView(s, 0, phone('Zé', 't1'), LOBBY).claimable).toHaveLength(4);
  });

  it('only the describer runs the turn; anyone in the checking team validates', () => {
    let s = game();
    const ana = { name: 'Ana', team: 't1' };
    const pedro = { name: 'Pedro', team: 't1' };
    const rita = { name: 'Rita', team: 't2' };
    expect(mayPlayerCommand(s, ana, { type: 'READY' })).toBe(true);
    expect(mayPlayerCommand(s, pedro, { type: 'READY' })).toBe(false);
    expect(mayPlayerCommand(s, rita, { type: 'READY' })).toBe(false);
    s = [{ type: 'READY' }, { type: 'START_TURN', now: 0 }, { type: 'END_EARLY', now: 1 }, { type: 'BEGIN_VALIDATION' }].reduce(
      (st, a) => gameReducer(st, a as GameAction),
      s,
    );
    expect(mayPlayerCommand(s, rita, { type: 'CONFIRM_VALIDATION' })).toBe(true);
    expect(mayPlayerCommand(s, ana, { type: 'CONFIRM_VALIDATION' })).toBe(false);
    expect(mayPlayerCommand(s, pedro, { type: 'SET_VALIDATION' })).toBe(false);
  });
});
