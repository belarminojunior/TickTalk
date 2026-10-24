import { createInitialState, gameReducer, type GameAction } from './reducer';
import { describerView, tableView, teamSequence, projection, nextDescriber, provisionalPosition } from './selectors';
import type { GameState, Settings, Side, TeamSetup } from './types';
import { TEST_CARDS, TWO_TEAMS, settings, teamsOf } from '../test/fixtures';
import { clearSavedGame, loadGame, saveGame, SAVE_KEY } from './storage';
import { validateSetup } from './setup';

function run(state: GameState, ...actions: GameAction[]): GameState {
  return actions.reduce(gameReducer, state);
}

function start(overrides: Partial<Settings> = {}, teams: TeamSetup[] = TWO_TEAMS): GameState {
  return gameReducer(createInitialState(), {
    type: 'SETUP',
    settings: settings(overrides),
    teams,
    cards: TEST_CARDS,
    seed: 123,
  });
}

interface TurnPlan {
  /** Word indices to mark, in order. Each mark turns the card over, so they alternate sides. */
  marks?: number[];
  annul?: [Side, number][];
  die?: number;
}

/** Plays a whole turn to the end (moving phase, settled). */
function playTurn(state: GameState, plan: TurnPlan = {}): GameState {
  let s = run(state, { type: 'READY' }, { type: 'START_TURN', now: 0 });
  for (const i of plan.marks ?? []) s = gameReducer(s, { type: 'TOGGLE_WORD', index: i, now: 1000 });
  if (s.phase === 'describing') s = gameReducer(s, { type: 'TICK', now: 60_000 });
  s = gameReducer(s, { type: 'BEGIN_VALIDATION' });
  for (const [side, index] of plan.annul ?? []) s = gameReducer(s, { type: 'SET_VALIDATION', side, index, annulled: true });
  if (s.phase === 'validating') s = gameReducer(s, { type: 'CONFIRM_VALIDATION' });
  if (s.phase === 'rolling') s = run(s, { type: 'ROLL_DIE', value: plan.die ?? 0 }, { type: 'APPLY_MOVE' });
  return gameReducer(s, { type: 'DIE_RETURNED' });
}

/** Words on the side the turn started on. */
function words(state: GameState): string[] {
  return state.turn!.card![state.turn!.side].words;
}

function bothSides(state: GameState): Record<Side, string[]> {
  return { blue: state.turn!.card!.blue.words, yellow: state.turn!.card!.yellow.words };
}

describe('setup', () => {
  it('puts the teams on the start and begins with the first one in handoff', () => {
    const s = start();
    expect(s.phase).toBe('handoff');
    expect(s.teams.map((t) => t.position)).toEqual([0, 0]);
    expect(s.turn?.describer).toBe('Ana');
    expect(s.turn?.side).toBe('blue');
  });

  it('validates teams, players and packs', () => {
    const ok = [
      { name: 'A', color: 'red' as const, players: 'Ana, Rui' },
      { name: 'B', color: 'green' as const, players: 'Tó, Zé' },
    ];
    expect(validateSetup(ok, ['things'], 10)).toEqual([]);
    expect(validateSetup(ok.slice(0, 1), ['things'], 10)).toContainEqual({ kind: 'tooFewTeams' });
    expect(validateSetup([ok[0], { ...ok[1], players: 'Só' }], ['things'], 10)).toContainEqual({ kind: 'teamPlayers', team: 1 });
    expect(validateSetup([{ ...ok[0], name: ' ' }, ok[1]], ['things'], 10)).toContainEqual({ kind: 'teamName', team: 0 });
    expect(validateSetup(ok, [], 10)).toContainEqual({ kind: 'noPacks' });
  });
});

describe('turn flow', () => {
  it('handoff → ready → describing → time up', () => {
    let s = start();
    s = gameReducer(s, { type: 'START_TURN', now: 0 });
    expect(s.phase).toBe('handoff'); // not ready yet
    s = run(s, { type: 'READY' }, { type: 'START_TURN', now: 0 });
    expect(s.phase).toBe('describing');
    expect(s.turn?.card).not.toBeNull();
    s = gameReducer(s, { type: 'TICK', now: 10_000 });
    expect(s.turn?.timer.remainingMs).toBe(20_000);
    s = gameReducer(s, { type: 'TICK', now: 30_000 });
    expect(s.phase).toBe('timeUp');
    expect(s.turn?.endReason).toBe('time');
  });

  it('a correct word turns the card over to the other side', () => {
    let s = run(start(), { type: 'READY' }, { type: 'START_TURN', now: 0 });
    expect(s.turn?.up).toBe('blue');
    s = gameReducer(s, { type: 'TOGGLE_WORD', index: 3, now: 12_000 });
    expect(s.turn?.marked.blue).toEqual([false, false, false, true, false]);
    expect(s.turn?.hits).toEqual([{ side: 'blue', index: 3, atMs: 12_000 }]);
    expect(s.turn?.up).toBe('yellow');
    // The next mark applies to the yellow side, and turns the card back to blue.
    s = gameReducer(s, { type: 'TOGGLE_WORD', index: 3, now: 14_000 });
    expect(s.turn?.marked.yellow[3]).toBe(true);
    expect(s.turn?.up).toBe('blue');
  });

  it('unmarking a word on the face-up side does not turn the card', () => {
    let s = run(start(), { type: 'READY' }, { type: 'START_TURN', now: 0 });
    s = run(s, { type: 'TOGGLE_WORD', index: 0, now: 1 }, { type: 'TOGGLE_WORD', index: 1, now: 2 });
    expect(s.turn?.up).toBe('blue');
    s = gameReducer(s, { type: 'TOGGLE_WORD', index: 0, now: 3 });
    expect(s.turn?.marked.blue[0]).toBe(false);
    expect(s.turn?.up).toBe('blue');
    expect(s.turn?.hits).toEqual([{ side: 'yellow', index: 1, atMs: 2 }]);
  });

  it('undoing the last hit unmarks it and turns the card back', () => {
    let s = run(start(), { type: 'READY' }, { type: 'START_TURN', now: 0 });
    s = gameReducer(s, { type: 'TOGGLE_WORD', index: 2, now: 1 });
    expect(s.turn?.up).toBe('yellow');
    s = gameReducer(s, { type: 'UNDO_HIT', now: 2 });
    expect(s.turn?.marked.blue[2]).toBe(false);
    expect(s.turn?.up).toBe('blue');
    expect(s.turn?.hits).toEqual([]);
    expect(gameReducer(s, { type: 'UNDO_HIT', now: 3 })).toBe(s);
  });

  it('there are 10 words per turn; guessing all 10 ends it', () => {
    let s = run(start(), { type: 'READY' }, { type: 'START_TURN', now: 0 });
    for (let i = 0; i < 9; i++) s = gameReducer(s, { type: 'TOGGLE_WORD', index: Math.floor(i / 2), now: 1000 * i });
    expect(s.phase).toBe('describing');
    s = gameReducer(s, { type: 'TOGGLE_WORD', index: 4, now: 9000 });
    expect(s.phase).toBe('timeUp');
    expect(s.turn?.endReason).toBe('allWords');
    expect(s.turn?.marked).toEqual({ blue: [true, true, true, true, true], yellow: [true, true, true, true, true] });
  });

  it('ends the turn early', () => {
    let s = run(start(), { type: 'READY' }, { type: 'START_TURN', now: 0 });
    s = gameReducer(s, { type: 'END_EARLY', now: 5000 });
    expect(s.phase).toBe('timeUp');
    expect(s.turn?.endReason).toBe('early');
  });

  it('pauses and resumes without losing time', () => {
    let s = run(start(), { type: 'READY' }, { type: 'START_TURN', now: 0 });
    s = gameReducer(s, { type: 'PAUSE', now: 5000 });
    expect(s.phase).toBe('paused');
    expect(s.turn?.timer.remainingMs).toBe(25_000);
    s = gameReducer(s, { type: 'TICK', now: 60_000 });
    expect(s.phase).toBe('paused');
    s = gameReducer(s, { type: 'RESUME', now: 100_000 });
    s = gameReducer(s, { type: 'TICK', now: 110_000 });
    expect(s.turn?.timer.remainingMs).toBe(15_000);
  });

  it('a describer disconnect pauses the timer', () => {
    let s = run(start(), { type: 'READY' }, { type: 'START_TURN', now: 0 });
    s = gameReducer(s, { type: 'DESCRIBER_DISCONNECTED', now: 4000 });
    expect(s.phase).toBe('paused');
    expect(s.turn?.pauseReason).toBe('disconnected');
    expect(s.turn?.timer.running).toBe(false);
  });
});

describe('views and privacy', () => {
  it('tableView never contains the words in handoff/describing/paused/timeUp', () => {
    let s = run(start(), { type: 'READY' });
    expect(JSON.stringify(tableView(s))).not.toMatch(/Yellow\d|Blue\d/);
    s = gameReducer(s, { type: 'START_TURN', now: 0 });
    const secret = [...bothSides(s).blue, ...bothSides(s).yellow];
    const check = (st: GameState) => {
      const json = JSON.stringify(tableView(st));
      for (const w of secret) expect(json).not.toContain(w);
      expect(tableView(st).turn?.words).toBeNull();
    };
    check(s);
    s = gameReducer(s, { type: 'TOGGLE_WORD', index: 0, now: 1000 });
    check(s);
    s = gameReducer(s, { type: 'PAUSE', now: 2000 });
    check(s);
    s = gameReducer(s, { type: 'END_EARLY', now: 2000 });
    check(s);
    s = gameReducer(s, { type: 'BEGIN_VALIDATION' });
    expect(s.phase).toBe('validating');
    expect(tableView(s).turn?.words).toEqual(bothSides(s));
  });

  it('describerView has the words during the turn', () => {
    let s = run(start(), { type: 'READY' });
    expect(describerView(s, 0).words).toBeNull();
    s = gameReducer(s, { type: 'START_TURN', now: 0 });
    expect(describerView(s, 0).words).toEqual(bothSides(s));
    expect(describerView(s, 10_000).timer.remainingMs).toBe(20_000);
  });

  it('the pawn advances one square per correct word, then lands after the die', () => {
    let s = run(start(), { type: 'READY' });
    expect(provisionalPosition(tableView(s))).toBeNull();
    s = gameReducer(s, { type: 'START_TURN', now: 0 });
    expect(provisionalPosition(tableView(s))).toBe(0);
    s = run(s, { type: 'TOGGLE_WORD', index: 0, now: 1 }, { type: 'TOGGLE_WORD', index: 0, now: 2 }, { type: 'TOGGLE_WORD', index: 1, now: 3 });
    expect(provisionalPosition(tableView(s))).toBe(3);
    s = run(s, { type: 'UNDO_HIT', now: 4 });
    expect(provisionalPosition(tableView(s))).toBe(2);
    s = run(s, { type: 'TOGGLE_WORD', index: 1, now: 5 }, { type: 'END_EARLY', now: 6 }, { type: 'BEGIN_VALIDATION' });
    expect(provisionalPosition(tableView(s))).toBe(3);
    // Cancelling a word takes it off straight away.
    s = gameReducer(s, { type: 'SET_VALIDATION', side: 'yellow', index: 0, annulled: true });
    expect(provisionalPosition(tableView(s))).toBe(2);
    s = run(s, { type: 'CONFIRM_VALIDATION' }, { type: 'ROLL_DIE', value: 1 });
    expect(provisionalPosition(tableView(s))).toBe(2);
    // Moving: the hop starts from start + valid (2) and lands on start + valid − die (1).
    s = gameReducer(s, { type: 'APPLY_MOVE' });
    expect(provisionalPosition(tableView(s))).toBe(2);
    expect(s.teams[0].position).toBe(1);
    // The provisional square never goes past the finish.
    const near = { ...tableView(s), phase: 'describing' as const, teams: s.teams.map((t) => ({ ...t, position: 35 })) };
    expect(provisionalPosition(near)).toBe(36);
  });

  it('projection: die 0/1/2 and no die', () => {
    expect(projection(3, 'die')).toEqual([
      { die: 0, advance: 3 },
      { die: 1, advance: 2 },
      { die: 2, advance: 1 },
    ]);
    expect(projection(1, 'die')[2].advance).toBe(0);
    expect(projection(3, 'noDie')).toEqual([{ die: null, advance: 3 }]);
  });
});

describe('validation', () => {
  function atValidation(marks: number[]): GameState {
    let s = run(start(), { type: 'READY' }, { type: 'START_TURN', now: 0 });
    for (const i of marks) s = gameReducer(s, { type: 'TOGGLE_WORD', index: i, now: 100 });
    return run(s, { type: 'END_EARLY', now: 200 }, { type: 'BEGIN_VALIDATION' });
  }

  it('valid = marked − cancelled', () => {
    // Marks alternate sides: blue 0, yellow 2, blue 3.
    let s = atValidation([0, 2, 3]);
    s = gameReducer(s, { type: 'SET_VALIDATION', side: 'yellow', index: 2, annulled: true });
    const t = tableView(s).turn!;
    expect(t.annulled.yellow).toEqual([false, false, true, false, false]);
    expect(t.annulled.blue).toEqual([false, false, false, false, false]);
    s = run(s, { type: 'CONFIRM_VALIDATION' }, { type: 'ROLL_DIE', value: 0 }, { type: 'APPLY_MOVE' });
    expect(s.turn?.move).toEqual({ from: 0, to: 2, steps: 2 });
  });

  it('an unmarked word cannot be cancelled', () => {
    const s = atValidation([0]);
    expect(gameReducer(s, { type: 'SET_VALIDATION', side: 'blue', index: 1, annulled: true })).toBe(s);
    expect(gameReducer(s, { type: 'SET_VALIDATION', side: 'yellow', index: 0, annulled: true })).toBe(s);
  });

  it('"No checking" skips the phase', () => {
    let s = start({ validation: 'none' });
    s = run(s, { type: 'READY' }, { type: 'START_TURN', now: 0 }, { type: 'TOGGLE_WORD', index: 0, now: 1 });
    s = run(s, { type: 'END_EARLY', now: 2 }, { type: 'BEGIN_VALIDATION' });
    expect(s.phase).toBe('rolling');
  });
});

describe('die and movement', () => {
  it('with die: advance = max(0, valid − die)', () => {
    const s = playTurn(start(), { marks: [0, 1, 2], annul: [['yellow', 1]], die: 1 });
    expect(s.teams[0].position).toBe(1);
    expect(s.lastDie).toBe(1);
    const t = playTurn(start(), { marks: [0], die: 2 });
    expect(t.teams[0].position).toBe(0); // never behind the start
  });

  it('no die: advance = valid and there is never a rolling phase', () => {
    let s = start({ scoring: 'noDie' });
    const phases: string[] = [];
    s = run(s, { type: 'READY' }, { type: 'START_TURN', now: 0 });
    for (const i of [0, 1, 2]) s = gameReducer(s, { type: 'TOGGLE_WORD', index: i, now: 10 });
    s = run(s, { type: 'END_EARLY', now: 20 }, { type: 'BEGIN_VALIDATION' }, { type: 'SET_VALIDATION', side: 'blue', index: 0, annulled: true });
    s = gameReducer(s, { type: 'CONFIRM_VALIDATION' });
    phases.push(s.phase);
    expect(phases).not.toContain('rolling');
    expect(s.phase).toBe('moving');
    expect(s.turn?.move).toEqual({ from: 0, to: 2, steps: 2 });
    // ROLL_DIE is ignored without the die
    expect(gameReducer(s, { type: 'ROLL_DIE', value: 2 })).toBe(s);
    expect(s.lastDie).toBeNull();
  });

  it('the card side follows the square colour and flips when the colour changes', () => {
    // Lions: 2 valid − 1 = square 1 (blue) → stays blue
    let s = playTurn(start(), { marks: [0, 1, 2], annul: [['blue', 0]], die: 1 });
    expect(s.teams[0].position).toBe(1);
    s = gameReducer(s, { type: 'NEXT_TEAM' });
    s = gameReducer(playTurn(s, {}), { type: 'NEXT_TEAM' }); // Gazelas
    expect(s.turn?.side).toBe('blue');
    s = run(s, { type: 'READY' }, { type: 'START_TURN', now: 0 });
    expect(s.turn?.card?.blue.words).toEqual(words(s));
    expect(describerView(s, 0).flipped).toBe(false);

    // Now +1 square → square 2 (yellow) → the next card comes from the yellow side
    s = run(s, { type: 'TOGGLE_WORD', index: 0, now: 1 }, { type: 'END_EARLY', now: 2 }, { type: 'BEGIN_VALIDATION' });
    s = run(s, { type: 'CONFIRM_VALIDATION' }, { type: 'ROLL_DIE', value: 0 }, { type: 'APPLY_MOVE' }, { type: 'DIE_RETURNED' });
    expect(s.teams[0].position).toBe(2);
    s = gameReducer(s, { type: 'NEXT_TEAM' });
    s = gameReducer(playTurn(s, {}), { type: 'NEXT_TEAM' });
    expect(s.turn?.side).toBe('yellow');
    expect(describerView(s, 0).flipped).toBe(true);
    s = run(s, { type: 'READY' }, { type: 'START_TURN', now: 0 });
    expect(words(s)).toEqual(s.turn?.card?.yellow.words);
  });

  it('reaching or passing square 36 wins', () => {
    let s = start({ scoring: 'noDie' });
    s = { ...s, teams: s.teams.map((t, i) => (i === 0 ? { ...t, position: 34 } : t)) };
    s = { ...s, turn: { ...s.turn!, side: 'yellow' } };
    s = playTurn(s, { marks: [0, 1, 2] });
    expect(s.phase).toBe('won');
    expect(s.winnerId).toBe('t1');
    expect(s.teams[0].position).toBe(36);
  });
});

describe('team and describer order', () => {
  it('the describer rotates within the team', () => {
    let s = start();
    const describers: string[] = [];
    for (let i = 0; i < 6; i++) {
      describers.push(s.turn!.describer);
      s = gameReducer(playTurn(s), { type: 'NEXT_TEAM' });
    }
    expect(describers).toEqual(['Ana', 'Tomás', 'Pedro', 'Rita', 'Lúcia', 'Tomás']);
  });

  it('the round goes up when play returns to the first team', () => {
    let s = start();
    expect(s.round).toBe(1);
    s = gameReducer(playTurn(s), { type: 'NEXT_TEAM' });
    expect(s.round).toBe(1);
    s = gameReducer(playTurn(s), { type: 'NEXT_TEAM' });
    expect(s.round).toBe(2);
  });

  it.each([2, 6])('the team sequence rotates with %i teams (with and without die)', (n) => {
    for (const scoring of ['die', 'noDie'] as const) {
      let s = start({ scoring }, teamsOf(n));
      for (let turn = 0; turn < n + 1; turn++) {
        s = playTurn(s);
        const seq = teamSequence(s);
        expect(seq).toHaveLength(n);
        expect(seq[0]).toMatchObject({ team: s.teams[turn % n], label: 'justPlayed' });
        expect(seq[1]).toMatchObject({ team: s.teams[(turn + 1) % n], label: 'next' });
        expect(seq.slice(2).every((x) => x.label === 'later')).toBe(true);
        expect(nextDescriber(s).team.id).toBe(s.teams[(turn + 1) % n].id);
        s = gameReducer(s, { type: 'NEXT_TEAM' });
        expect(s.currentTeam).toBe((turn + 1) % n);
      }
    }
  });

  it('the turn can only be passed once the pawn has landed', () => {
    let s = run(start(), { type: 'READY' }, { type: 'START_TURN', now: 0 }, { type: 'END_EARLY', now: 1 });
    s = run(s, { type: 'BEGIN_VALIDATION' }, { type: 'CONFIRM_VALIDATION' }, { type: 'ROLL_DIE', value: 0 }, { type: 'APPLY_MOVE' });
    expect(s.phase).toBe('moving');
    expect(gameReducer(s, { type: 'NEXT_TEAM' })).toBe(s);
    s = gameReducer(s, { type: 'DIE_RETURNED' });
    expect(gameReducer(s, { type: 'NEXT_TEAM' }).phase).toBe('handoff');
  });

  it('describerView tells the describer who plays next at the end of the turn', () => {
    let s = run(start(), { type: 'READY' }, { type: 'START_TURN', now: 0 }, { type: 'TOGGLE_WORD', index: 0, now: 1 });
    expect(describerView(s, 0).endOfTurn).toBeNull();
    s = run(s, { type: 'END_EARLY', now: 2 }, { type: 'BEGIN_VALIDATION' }, { type: 'CONFIRM_VALIDATION' });
    s = run(s, { type: 'ROLL_DIE', value: 0 }, { type: 'APPLY_MOVE' });
    expect(describerView(s, 0).endOfTurn).toEqual({ steps: 1, to: 1, settled: false, nextPlayer: 'Tomás', nextTeam: 'As Gazelas' });
    s = gameReducer(s, { type: 'DIE_RETURNED' });
    expect(describerView(s, 0).endOfTurn?.settled).toBe(true);
  });

  it('changes describer during handoff', () => {
    const s = gameReducer(start(), { type: 'HANDOFF', skipDescriber: true });
    expect(s.turn?.describer).toBe('Pedro');
  });
});

describe('undo', () => {
  it('returns to the state before validation', () => {
    let s = run(start(), { type: 'READY' }, { type: 'START_TURN', now: 0 });
    s = run(s, { type: 'TOGGLE_WORD', index: 0, now: 1 }, { type: 'TOGGLE_WORD', index: 1, now: 2 });
    s = run(s, { type: 'END_EARLY', now: 3 }, { type: 'BEGIN_VALIDATION' }, { type: 'SET_VALIDATION', side: 'yellow', index: 1, annulled: true });
    const before = s;
    s = run(s, { type: 'CONFIRM_VALIDATION' }, { type: 'ROLL_DIE', value: 0 }, { type: 'APPLY_MOVE' }, { type: 'DIE_RETURNED' });
    expect(s.teams[0].position).toBe(1);
    s = gameReducer(s, { type: 'UNDO_TURN' });
    expect(s).toEqual({ ...before, undo: null });
    expect(s.phase).toBe('validating');
    expect(s.teams[0].position).toBe(0);
    expect(gameReducer(s, { type: 'UNDO_TURN' })).toBe(s); // one level only
  });

  it('cannot undo after passing the turn', () => {
    const s = gameReducer(playTurn(start(), { marks: [0] }), { type: 'NEXT_TEAM' });
    expect(gameReducer(s, { type: 'UNDO_TURN' })).toBe(s);
  });
});

describe('save and resume', () => {
  afterEach(() => clearSavedGame());

  it('saves and resumes; a turn in progress comes back paused', () => {
    const s = run(start(), { type: 'READY' }, { type: 'START_TURN', now: 0 }, { type: 'TICK', now: 4000 });
    saveGame(s);
    const loaded = loadGame();
    expect(loaded?.state.teams).toEqual(s.teams);
    const resumed = gameReducer(createInitialState(), { type: 'LOAD', state: loaded!.state });
    expect(resumed.phase).toBe('paused');
    expect(resumed.turn?.timer.remainingMs).toBe(26_000);
    expect(resumed.turn?.timer.running).toBe(false);
  });

  it('ignores an old schema or corrupt data', () => {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({ schema: 0, state: start() }));
    expect(loadGame()).toBeNull();
    window.localStorage.setItem(SAVE_KEY, '{nope');
    expect(loadGame()).toBeNull();
  });

  it('migrates a schema-1 save (Portuguese pack ids) instead of dropping it', () => {
    const old = JSON.parse(JSON.stringify(start({ packs: ['things', 'places'] })).replace(/"things"/g, '"coisas"').replace(/"places"/g, '"lugares"'));
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({ schema: 1, savedAt: 1, state: old }));
    const loaded = loadGame();
    expect(loaded?.state.settings.packs).toEqual(['things', 'places']);
    expect(loaded?.state.deck.cards[0].yellow.pack).toBe('things');
    expect(loaded?.state.deck.cards[0].blue.pack).toBe('places');
  });

  it('migrates a schema-2 save (one side of marks) to the two-sided turn', () => {
    const s = run(start(), { type: 'READY' }, { type: 'START_TURN', now: 0 }, { type: 'END_EARLY', now: 1 });
    const { up: _up, ...rest } = s.turn!;
    const oldTurn = { ...rest, marked: [true, false, true, false, false], annulled: [false, false, true, false, false], hits: [{ index: 0, atMs: 5 }] };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({ schema: 2, savedAt: 1, state: { ...s, turn: oldTurn } }));
    const turn = loadGame()!.state.turn!;
    expect(turn.up).toBe('blue');
    expect(turn.marked).toEqual({ blue: [true, false, true, false, false], yellow: [false, false, false, false, false] });
    expect(turn.annulled.blue[2]).toBe(true);
    expect(turn.hits).toEqual([{ side: 'blue', index: 0, atMs: 5 }]);
  });

  it('REMATCH restarts with the same teams', () => {
    const s = gameReducer(playTurn(start(), { marks: [0, 1] }), { type: 'REMATCH', seed: 9 });
    expect(s.phase).toBe('handoff');
    expect(s.teams.map((t) => t.position)).toEqual([0, 0]);
    expect(s.teams[0].name).toBe('Os Leões');
  });
});
