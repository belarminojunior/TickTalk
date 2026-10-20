import { createInitialState, gameReducer, type GameAction } from './reducer';
import { describerView, tableView, teamSequence, projection, nextDescriber } from './selectors';
import type { GameState, Settings, TeamSetup } from './types';
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
  marks?: number[];
  annul?: number[];
  die?: number;
}

/** Joga uma vez completa até ao fim (fase moving, assente). */
function playTurn(state: GameState, plan: TurnPlan = {}): GameState {
  let s = run(state, { type: 'READY' }, { type: 'START_TURN', now: 0 });
  for (const i of plan.marks ?? []) s = gameReducer(s, { type: 'TOGGLE_WORD', index: i, now: 1000 });
  if (s.phase === 'describing') s = gameReducer(s, { type: 'TICK', now: 60_000 });
  s = gameReducer(s, { type: 'BEGIN_VALIDATION' });
  for (const i of plan.annul ?? []) s = gameReducer(s, { type: 'SET_VALIDATION', index: i, annulled: true });
  if (s.phase === 'validating') s = gameReducer(s, { type: 'CONFIRM_VALIDATION' });
  if (s.phase === 'rolling') s = run(s, { type: 'ROLL_DIE', value: plan.die ?? 0 }, { type: 'APPLY_MOVE' });
  return gameReducer(s, { type: 'DIE_RETURNED' });
}

function words(state: GameState): string[] {
  return state.turn!.card![state.turn!.side].words;
}

describe('configuração', () => {
  it('cria as equipas na Partida e começa com a primeira em handoff', () => {
    const s = start();
    expect(s.phase).toBe('handoff');
    expect(s.teams.map((t) => t.position)).toEqual([0, 0]);
    expect(s.turn?.describer).toBe('Ana');
    expect(s.turn?.side).toBe('blue');
  });

  it('valida equipas, jogadores e pacotes', () => {
    const ok = [
      { name: 'A', color: 'red' as const, players: 'Ana, Rui' },
      { name: 'B', color: 'green' as const, players: 'Tó, Zé' },
    ];
    expect(validateSetup(ok, ['coisas'], 10)).toEqual([]);
    expect(validateSetup(ok.slice(0, 1), ['coisas'], 10)).toContainEqual({ kind: 'tooFewTeams' });
    expect(validateSetup([ok[0], { ...ok[1], players: 'Só' }], ['coisas'], 10)).toContainEqual({ kind: 'teamPlayers', team: 1 });
    expect(validateSetup([{ ...ok[0], name: ' ' }, ok[1]], ['coisas'], 10)).toContainEqual({ kind: 'teamName', team: 0 });
    expect(validateSetup(ok, [], 10)).toContainEqual({ kind: 'noPacks' });
  });
});

describe('fluxo de uma vez', () => {
  it('handoff → pronta → descrever → tempo esgotado', () => {
    let s = start();
    s = gameReducer(s, { type: 'START_TURN', now: 0 });
    expect(s.phase).toBe('handoff'); // ainda não está pronta
    s = run(s, { type: 'READY' }, { type: 'START_TURN', now: 0 });
    expect(s.phase).toBe('describing');
    expect(s.turn?.card).not.toBeNull();
    s = gameReducer(s, { type: 'TICK', now: 10_000 });
    expect(s.turn?.timer.remainingMs).toBe(20_000);
    s = gameReducer(s, { type: 'TICK', now: 30_000 });
    expect(s.phase).toBe('timeUp');
    expect(s.turn?.endReason).toBe('time');
  });

  it('marcar e desmarcar palavras regista o momento do acerto', () => {
    let s = run(start(), { type: 'READY' }, { type: 'START_TURN', now: 0 });
    s = gameReducer(s, { type: 'TOGGLE_WORD', index: 3, now: 12_000 });
    expect(s.turn?.marked).toEqual([false, false, false, true, false]);
    expect(s.turn?.hits).toEqual([{ index: 3, atMs: 12_000 }]);
    s = gameReducer(s, { type: 'TOGGLE_WORD', index: 3, now: 13_000 });
    expect(s.turn?.marked[3]).toBe(false);
    expect(s.turn?.hits).toEqual([]);
  });

  it('marcar as 5 termina a vez', () => {
    let s = run(start(), { type: 'READY' }, { type: 'START_TURN', now: 0 });
    for (let i = 0; i < 5; i++) s = gameReducer(s, { type: 'TOGGLE_WORD', index: i, now: 1000 * i });
    expect(s.phase).toBe('timeUp');
    expect(s.turn?.endReason).toBe('allFive');
  });

  it('terminar a vez mais cedo', () => {
    let s = run(start(), { type: 'READY' }, { type: 'START_TURN', now: 0 });
    s = gameReducer(s, { type: 'END_EARLY', now: 5000 });
    expect(s.phase).toBe('timeUp');
    expect(s.turn?.endReason).toBe('early');
  });

  it('pausa e retoma sem perder tempo', () => {
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

  it('desligar quem explica pausa o tempo', () => {
    let s = run(start(), { type: 'READY' }, { type: 'START_TURN', now: 0 });
    s = gameReducer(s, { type: 'DESCRIBER_DISCONNECTED', now: 4000 });
    expect(s.phase).toBe('paused');
    expect(s.turn?.pauseReason).toBe('disconnected');
    expect(s.turn?.timer.running).toBe(false);
  });
});

describe('vistas e privacidade', () => {
  it('tableView nunca contém as palavras em handoff/describing/paused/timeUp', () => {
    let s = run(start(), { type: 'READY' });
    expect(JSON.stringify(tableView(s))).not.toMatch(/Amarela|Azul\d/);
    s = gameReducer(s, { type: 'START_TURN', now: 0 });
    const secret = words(s);
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
    expect(tableView(s).turn?.words).toEqual(secret);
  });

  it('describerView tem as palavras durante a vez', () => {
    let s = run(start(), { type: 'READY' });
    expect(describerView(s, 0).words).toBeNull();
    s = gameReducer(s, { type: 'START_TURN', now: 0 });
    expect(describerView(s, 0).words).toEqual(words(s));
    expect(describerView(s, 10_000).timer.remainingMs).toBe(20_000);
  });

  it('projeção: dado 0/1/2 e sem dado', () => {
    expect(projection(3, 'die')).toEqual([
      { die: 0, advance: 3 },
      { die: 1, advance: 2 },
      { die: 2, advance: 1 },
    ]);
    expect(projection(1, 'die')[2].advance).toBe(0);
    expect(projection(3, 'noDie')).toEqual([{ die: null, advance: 3 }]);
  });
});

describe('validação', () => {
  function atValidation(marks: number[]): GameState {
    let s = run(start(), { type: 'READY' }, { type: 'START_TURN', now: 0 });
    for (const i of marks) s = gameReducer(s, { type: 'TOGGLE_WORD', index: i, now: 100 });
    return run(s, { type: 'END_EARLY', now: 200 }, { type: 'BEGIN_VALIDATION' });
  }

  it('válidas = marcadas − anuladas', () => {
    let s = atValidation([0, 2, 3]);
    s = gameReducer(s, { type: 'SET_VALIDATION', index: 2, annulled: true });
    const t = tableView(s).turn!;
    expect(t.annulled).toEqual([false, false, true, false, false]);
    s = run(s, { type: 'CONFIRM_VALIDATION' }, { type: 'ROLL_DIE', value: 0 }, { type: 'APPLY_MOVE' });
    expect(s.turn?.move).toEqual({ from: 0, to: 2, steps: 2 });
  });

  it('não se pode anular uma palavra não marcada', () => {
    const s = atValidation([0]);
    const after = gameReducer(s, { type: 'SET_VALIDATION', index: 1, annulled: true });
    expect(after).toBe(s);
  });

  it('"Sem validação" salta a fase', () => {
    let s = start({ validation: 'none' });
    s = run(s, { type: 'READY' }, { type: 'START_TURN', now: 0 }, { type: 'TOGGLE_WORD', index: 0, now: 1 });
    s = run(s, { type: 'END_EARLY', now: 2 }, { type: 'BEGIN_VALIDATION' });
    expect(s.phase).toBe('rolling');
  });
});

describe('dado e movimento', () => {
  it('com dado: avanço = max(0, válidas − dado)', () => {
    const s = playTurn(start(), { marks: [0, 1, 2], annul: [1], die: 1 });
    expect(s.teams[0].position).toBe(1);
    expect(s.lastDie).toBe(1);
    const t = playTurn(start(), { marks: [0], die: 2 });
    expect(t.teams[0].position).toBe(0); // nunca antes da Partida
  });

  it('sem dado: avanço = válidas e nunca há fase rolling', () => {
    let s = start({ scoring: 'noDie' });
    const phases: string[] = [];
    s = run(s, { type: 'READY' }, { type: 'START_TURN', now: 0 });
    for (const i of [0, 1, 2]) s = gameReducer(s, { type: 'TOGGLE_WORD', index: i, now: 10 });
    s = run(s, { type: 'END_EARLY', now: 20 }, { type: 'BEGIN_VALIDATION' }, { type: 'SET_VALIDATION', index: 0, annulled: true });
    s = gameReducer(s, { type: 'CONFIRM_VALIDATION' });
    phases.push(s.phase);
    expect(phases).not.toContain('rolling');
    expect(s.phase).toBe('moving');
    expect(s.turn?.move).toEqual({ from: 0, to: 2, steps: 2 });
    // ROLL_DIE é ignorado sem dado
    expect(gameReducer(s, { type: 'ROLL_DIE', value: 2 })).toBe(s);
    expect(s.lastDie).toBeNull();
  });

  it('o lado da carta segue a cor da casa e vira quando a cor muda', () => {
    // Leões: 2 válidas − 1 = casa 1 (azul) → continua azul
    let s = playTurn(start(), { marks: [0, 1, 2], annul: [0], die: 1 });
    expect(s.teams[0].position).toBe(1);
    s = gameReducer(s, { type: 'NEXT_TEAM' });
    s = gameReducer(playTurn(s, {}), { type: 'NEXT_TEAM' }); // Gazelas
    expect(s.turn?.side).toBe('blue');
    s = run(s, { type: 'READY' }, { type: 'START_TURN', now: 0 });
    expect(s.turn?.card?.blue.words).toEqual(words(s));
    expect(describerView(s, 0).flipped).toBe(false);

    // Agora +1 casa → casa 2 (amarela) → a próxima carta vem do lado amarelo
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

  it('chegar ou passar a casa 36 ganha', () => {
    let s = start({ scoring: 'noDie' });
    s = { ...s, teams: s.teams.map((t, i) => (i === 0 ? { ...t, position: 34 } : t)) };
    s = { ...s, turn: { ...s.turn!, side: 'yellow' } };
    s = playTurn(s, { marks: [0, 1, 2] });
    expect(s.phase).toBe('won');
    expect(s.winnerId).toBe('t1');
    expect(s.teams[0].position).toBe(36);
  });
});

describe('ordem das equipas e de quem explica', () => {
  it('quem explica roda dentro da equipa', () => {
    let s = start();
    const describers: string[] = [];
    for (let i = 0; i < 6; i++) {
      describers.push(s.turn!.describer);
      s = gameReducer(playTurn(s), { type: 'NEXT_TEAM' });
    }
    expect(describers).toEqual(['Ana', 'Tomás', 'Pedro', 'Rita', 'Lúcia', 'Tomás']);
  });

  it('a ronda sobe quando volta à primeira equipa', () => {
    let s = start();
    expect(s.round).toBe(1);
    s = gameReducer(playTurn(s), { type: 'NEXT_TEAM' });
    expect(s.round).toBe(1);
    s = gameReducer(playTurn(s), { type: 'NEXT_TEAM' });
    expect(s.round).toBe(2);
  });

  it.each([2, 6])('a sequência das equipas roda com %i equipas (com e sem dado)', (n) => {
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

  it('trocar quem explica no handoff', () => {
    const s = gameReducer(start(), { type: 'HANDOFF', skipDescriber: true });
    expect(s.turn?.describer).toBe('Pedro');
  });
});

describe('desfazer', () => {
  it('volta ao estado anterior à validação', () => {
    let s = run(start(), { type: 'READY' }, { type: 'START_TURN', now: 0 });
    s = run(s, { type: 'TOGGLE_WORD', index: 0, now: 1 }, { type: 'TOGGLE_WORD', index: 1, now: 2 });
    s = run(s, { type: 'END_EARLY', now: 3 }, { type: 'BEGIN_VALIDATION' }, { type: 'SET_VALIDATION', index: 1, annulled: true });
    const before = s;
    s = run(s, { type: 'CONFIRM_VALIDATION' }, { type: 'ROLL_DIE', value: 0 }, { type: 'APPLY_MOVE' }, { type: 'DIE_RETURNED' });
    expect(s.teams[0].position).toBe(1);
    s = gameReducer(s, { type: 'UNDO_TURN' });
    expect(s).toEqual({ ...before, undo: null });
    expect(s.phase).toBe('validating');
    expect(s.teams[0].position).toBe(0);
    expect(gameReducer(s, { type: 'UNDO_TURN' })).toBe(s); // só um nível
  });

  it('não se desfaz depois de passar a vez', () => {
    const s = gameReducer(playTurn(start(), { marks: [0] }), { type: 'NEXT_TEAM' });
    expect(gameReducer(s, { type: 'UNDO_TURN' })).toBe(s);
  });
});

describe('guardar e retomar', () => {
  afterEach(() => clearSavedGame());

  it('guarda e retoma; uma vez a meio volta em pausa', () => {
    const s = run(start(), { type: 'READY' }, { type: 'START_TURN', now: 0 }, { type: 'TICK', now: 4000 });
    saveGame(s);
    const loaded = loadGame();
    expect(loaded?.state.teams).toEqual(s.teams);
    const resumed = gameReducer(createInitialState(), { type: 'LOAD', state: loaded!.state });
    expect(resumed.phase).toBe('paused');
    expect(resumed.turn?.timer.remainingMs).toBe(26_000);
    expect(resumed.turn?.timer.running).toBe(false);
  });

  it('ignora um esquema antigo ou dados estragados', () => {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({ schema: 0, state: start() }));
    expect(loadGame()).toBeNull();
    window.localStorage.setItem(SAVE_KEY, '{nope');
    expect(loadGame()).toBeNull();
  });

  it('REMATCH recomeça com as mesmas equipas', () => {
    const s = gameReducer(playTurn(start(), { marks: [0, 1] }), { type: 'REMATCH', seed: 9 });
    expect(s.phase).toBe('handoff');
    expect(s.teams.map((t) => t.position)).toEqual([0, 0]);
    expect(s.teams[0].name).toBe('Os Leões');
  });
});
