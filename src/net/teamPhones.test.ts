import { createInitialState, gameReducer, type GameAction } from '../game/reducer';
import { mayCommand, phoneView } from '../game/selectors';
import type { GameState } from '../game/types';
import { TEST_CARDS, TWO_TEAMS, settings, teamsOf } from '../test/fixtures';
import { msg, parseClientMessage } from './protocol';
import { TeamHub } from './teamHub';

const TEAMS = ['t1', 't2'];

describe('protocol (one phone per team)', () => {
  it('carries the team in hello/ping/join and validates validation commands', () => {
    expect(parseClientMessage(msg.hello('t1'))).toEqual({ v: 1, kind: 'hello', team: 't1' });
    expect(parseClientMessage(msg.join(null))).toEqual({ v: 1, kind: 'join', team: null });
    expect(parseClientMessage({ v: 1, kind: 'join', team: '../x' })).toBeNull();
    expect(parseClientMessage(msg.command({ type: 'SET_VALIDATION', side: 'blue', index: 2, annulled: true }))).toEqual({
      v: 1,
      kind: 'command',
      command: { type: 'SET_VALIDATION', side: 'blue', index: 2, annulled: true },
    });
    expect(parseClientMessage({ v: 1, kind: 'command', command: { type: 'SET_VALIDATION', side: 'red', index: 2, annulled: true } })).toBeNull();
  });
});

describe('TeamHub', () => {
  it('binds one phone per team, first come first served', () => {
    const hub = new TeamHub();
    hub.receive('a', msg.join('t1'), 0, TEAMS);
    expect(hub.teamOf('a')).toBe('t1');
    hub.receive('b', msg.join('t1'), 0, TEAMS);
    expect(hub.teamOf('b')).toBeNull();
    expect(hub.refusedOf('b')).toBe('t1');
    hub.receive('b', msg.join('t2'), 0, TEAMS);
    expect(hub.teamOf('b')).toBe('t2');
    expect(hub.takenTeams().sort()).toEqual(['t1', 't2']);
  });

  it('re-binds a phone from its hello after a reload, and drops unknown teams', () => {
    const hub = new TeamHub();
    expect(hub.receive('a', msg.hello('t2'), 0, TEAMS)).toContainEqual({ type: 'sync', id: 'a' });
    expect(hub.teamOf('a')).toBe('t2');
    hub.receive('c', msg.hello('t9'), 0, TEAMS);
    expect(hub.teamOf('c')).toBeNull();
  });

  it('tags commands with the team, ignores phones without a team, and reports who left', () => {
    const hub = new TeamHub(5000);
    hub.receive('a', msg.join('t1'), 0, TEAMS);
    expect(hub.receive('a', msg.command({ type: 'READY' }), 1, TEAMS)).toContainEqual({
      type: 'command',
      id: 'a',
      team: 't1',
      command: { type: 'READY' },
    });
    hub.receive('x', msg.hello(), 0, TEAMS);
    expect(hub.receive('x', msg.command({ type: 'READY' }), 1, TEAMS).some((e) => e.type === 'command')).toBe(false);
    expect(hub.sweep(7000)).toContainEqual({ type: 'left', id: 'a', team: 't1' });
    expect(hub.takenTeams()).toEqual([]);
  });
});

function play(...actions: GameAction[]): GameState {
  return [
    { type: 'SETUP', settings: settings({ screenMode: 'teamPhones' }), teams: TWO_TEAMS, cards: TEST_CARDS, seed: 1 } as GameAction,
    ...actions,
  ].reduce(gameReducer, createInitialState());
}

const phone = (teamId: string | null) => ({ teamId, refusedTeam: null, takenTeams: ['t1', 't2'] });

describe('phone views (one phone per team)', () => {
  it('only the playing team gets the words during the turn', () => {
    const s = play({ type: 'READY' }, { type: 'START_TURN', now: 0 }, { type: 'TOGGLE_WORD', index: 0, now: 1 });
    const playing = phoneView(s, 0, phone('t1'));
    const other = phoneView(s, 0, phone('t2'));
    const none = phoneView(s, 0, phone(null));
    expect(playing.you.role).toBe('describer');
    expect(playing.words).not.toBeNull();
    for (const v of [other, none]) {
      expect(v.you.role).toBe('spectator');
      expect(v.words).toBeNull();
      expect(v.validation).toBeNull();
      expect(JSON.stringify(v)).not.toMatch(/Yellow\d|Blue\d/);
    }
    // Spectators still see the live count.
    expect(other.marked.blue[0]).toBe(true);
  });

  it('the checking team gets the card to validate — only while validating', () => {
    let s = play({ type: 'READY' }, { type: 'START_TURN', now: 0 }, { type: 'TOGGLE_WORD', index: 0, now: 1 }, { type: 'END_EARLY', now: 2 });
    expect(phoneView(s, 0, phone('t2')).validation).toBeNull();
    s = gameReducer(s, { type: 'BEGIN_VALIDATION' });
    const checking = phoneView(s, 0, phone('t2'));
    expect(checking.you.role).toBe('validator');
    expect(checking.validation?.words.blue).toHaveLength(5);
    expect(checking.validation?.marked.blue[0]).toBe(true);
    expect(phoneView(s, 0, phone('t1')).validation).toBeNull();
  });

  it('lists the teams for the picker, marking those that already have a phone', () => {
    const s = play();
    const v = phoneView(s, 0, { teamId: null, refusedTeam: null, takenTeams: ['t1'] });
    expect(v.teamsList.map((t) => [t.id, t.taken])).toEqual([
      ['t1', true],
      ['t2', false],
    ]);
  });

  it('in the other modes it is the plain describer view', () => {
    const s = [
      { type: 'SETUP', settings: settings({ screenMode: 'phone' }), teams: TWO_TEAMS, cards: TEST_CARDS, seed: 1 } as GameAction,
    ].reduce(gameReducer, createInitialState());
    expect(phoneView(s, 0, phone('t2')).you.role).toBe('describer');
  });
});

describe('who may do what (one phone per team)', () => {
  it('the playing team runs its turn; only the checking team validates', () => {
    let s = play({ type: 'READY' });
    expect(mayCommand(s, 't1', { type: 'START' })).toBe(true);
    expect(mayCommand(s, 't2', { type: 'START' })).toBe(false);
    s = play({ type: 'READY' }, { type: 'START_TURN', now: 0 }, { type: 'TOGGLE_WORD', index: 0, now: 1 }, { type: 'END_EARLY', now: 2 }, { type: 'BEGIN_VALIDATION' });
    expect(mayCommand(s, 't2', { type: 'SET_VALIDATION' })).toBe(true);
    expect(mayCommand(s, 't2', { type: 'CONFIRM_VALIDATION' })).toBe(true);
    expect(mayCommand(s, 't1', { type: 'SET_VALIDATION' })).toBe(false); // never your own turn
  });

  it('with three teams, the third team can neither play nor validate', () => {
    const s = [
      { type: 'SETUP', settings: settings({ screenMode: 'teamPhones' }), teams: teamsOf(3), cards: TEST_CARDS, seed: 1 } as GameAction,
      { type: 'READY' } as GameAction,
      { type: 'START_TURN', now: 0 } as GameAction,
      { type: 'END_EARLY', now: 1 } as GameAction,
      { type: 'BEGIN_VALIDATION' } as GameAction,
    ].reduce(gameReducer, createInitialState());
    expect(mayCommand(s, 't3', { type: 'CONFIRM_VALIDATION' })).toBe(false);
    expect(mayCommand(s, 't3', { type: 'NEXT_TEAM' })).toBe(false);
    expect(phoneView(s, 0, { teamId: 't3', refusedTeam: null, takenTeams: [] }).you.role).toBe('spectator');
  });
});
