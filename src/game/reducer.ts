import { clampSquare, sideFor } from './board';
import { createDeck, drawCard } from './deck';
import { advanceFor } from './dice';
import type {
  Card,
  GameState,
  PauseReason,
  Settings,
  Team,
  TeamSetup,
  TimerState,
  Turn,
} from './types';
import { BOARD_SQUARES, WORDS_PER_CARD } from './types';

export type GameAction =
  | { type: 'SETUP'; settings: Settings; teams: TeamSetup[]; cards: Card[]; seed: number }
  | { type: 'HANDOFF'; skipDescriber?: boolean }
  | { type: 'READY' }
  | { type: 'START_TURN'; now: number }
  | { type: 'TOGGLE_WORD'; index: number; now: number }
  | { type: 'TICK'; now: number }
  | { type: 'TIME_UP'; now: number }
  | { type: 'END_EARLY'; now: number }
  | { type: 'BEGIN_VALIDATION' }
  | { type: 'SET_VALIDATION'; index: number; annulled: boolean }
  | { type: 'CONFIRM_VALIDATION' }
  | { type: 'ROLL_DIE'; value: number }
  | { type: 'APPLY_MOVE' }
  | { type: 'DIE_RETURNED' }
  | { type: 'UNDO_TURN' }
  | { type: 'NEXT_TEAM' }
  | { type: 'PAUSE'; now: number; reason?: PauseReason }
  | { type: 'RESUME'; now: number }
  | { type: 'DESCRIBER_DISCONNECTED'; now: number }
  | { type: 'REMATCH'; seed: number }
  | { type: 'LOAD'; state: GameState }
  | { type: 'RESET' };

export const DEFAULT_SETTINGS: Settings = {
  screenMode: 'phone',
  turnSeconds: 30,
  validation: 'nextTeam',
  scoring: 'die',
  language: 'pt',
  uiLanguage: 'pt',
  packs: ['pessoas', 'lugares', 'coisas', 'entretenimento', 'mocambique'],
};

export function createInitialState(settings: Settings = DEFAULT_SETTINGS): GameState {
  return {
    phase: 'setup',
    settings,
    teams: [],
    currentTeam: 0,
    round: 1,
    turn: null,
    deck: { cards: [], order: [], next: 0, seed: 1 },
    lastDie: null,
    winnerId: null,
    undo: null,
  };
}

function emptyFlags(): boolean[] {
  return Array.from({ length: WORDS_PER_CARD }, () => false);
}

function newTimer(settings: Settings): TimerState {
  const durationMs = settings.turnSeconds * 1000;
  return { durationMs, remainingMs: durationMs, lastTickAt: null, running: false };
}

export function describerOf(team: Team): string {
  return team.players[team.describerIndex % team.players.length];
}

function handoffTurn(state: GameState, teamIndex: number): Turn {
  const team = state.teams[teamIndex];
  return {
    teamIndex,
    describer: describerOf(team),
    side: sideFor(team),
    ready: false,
    card: null,
    marked: emptyFlags(),
    annulled: emptyFlags(),
    hits: [],
    timer: newTimer(state.settings),
    pauseReason: null,
    endReason: null,
    die: null,
    move: null,
    settled: false,
  };
}

/** Desconta o tempo passado desde o último acerto de contas. */
function settleTimer(timer: TimerState, now: number): TimerState {
  if (!timer.running || timer.lastTickAt === null) return timer;
  const elapsed = Math.max(0, now - timer.lastTickAt);
  return { ...timer, remainingMs: Math.max(0, timer.remainingMs - elapsed), lastTickAt: now };
}

function stopTimer(timer: TimerState): TimerState {
  return { ...timer, running: false, lastTickAt: null };
}

function endTurn(state: GameState, turn: Turn, reason: Turn['endReason']): GameState {
  return {
    ...state,
    phase: 'timeUp',
    turn: { ...turn, timer: stopTimer(turn.timer), endReason: reason, pauseReason: null },
  };
}

export function validCount(turn: Pick<Turn, 'marked' | 'annulled'>): number {
  return turn.marked.filter((m, i) => m && !turn.annulled[i]).length;
}

export function markedCount(turn: Pick<Turn, 'marked'>): number {
  return turn.marked.filter(Boolean).length;
}

function applyMove(state: GameState, turn: Turn): GameState {
  const team = state.teams[turn.teamIndex];
  const die = state.settings.scoring === 'die' ? turn.die : null;
  const steps = advanceFor(validCount(turn), die);
  const from = team.position;
  const to = clampSquare(from + steps);
  const teams = state.teams.map((t, i) => (i === turn.teamIndex ? { ...t, position: to } : t));
  const reached = from + steps >= BOARD_SQUARES;
  return {
    ...state,
    phase: 'moving',
    teams,
    winnerId: reached ? team.id : state.winnerId,
    turn: { ...turn, move: { from, to, steps }, settled: false },
  };
}

/** Passo depois da validação: rolar o dado (com dado) ou avançar logo (sem dado). */
function afterValidation(state: GameState, turn: Turn): GameState {
  const snapshot: GameState = { ...state, undo: null };
  if (state.settings.scoring === 'die') {
    return { ...state, phase: 'rolling', turn: { ...turn, die: null }, undo: snapshot };
  }
  return { ...applyMove(state, { ...turn, die: null }), undo: snapshot };
}

function pause(state: GameState, turn: Turn, now: number, reason: PauseReason): GameState {
  const timer = stopTimer(settleTimer(turn.timer, now));
  if (timer.remainingMs <= 0) return endTurn(state, { ...turn, timer }, 'time');
  return { ...state, phase: 'paused', turn: { ...turn, timer, pauseReason: reason } };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  const turn = state.turn;

  switch (action.type) {
    case 'SETUP': {
      const teams: Team[] = action.teams.map((t, i) => ({
        id: `t${i + 1}`,
        name: t.name.trim(),
        color: t.color,
        players: t.players.map((p) => p.trim()).filter(Boolean),
        position: 0,
        describerIndex: 0,
        lastSide: null,
      }));
      const base: GameState = {
        ...createInitialState(action.settings),
        teams,
        deck: createDeck(action.cards, action.seed),
      };
      return { ...base, phase: 'handoff', turn: handoffTurn(base, 0) };
    }

    case 'REMATCH': {
      if (state.teams.length === 0) return state;
      const teams = state.teams.map((t) => ({ ...t, position: 0, describerIndex: 0, lastSide: null }));
      const base: GameState = {
        ...createInitialState(state.settings),
        teams,
        deck: createDeck(state.deck.cards, action.seed),
      };
      return { ...base, phase: 'handoff', turn: handoffTurn(base, 0) };
    }

    case 'HANDOFF': {
      if (state.phase !== 'handoff' || state.teams.length === 0) return state;
      let teams = state.teams;
      if (action.skipDescriber) {
        teams = teams.map((t, i) =>
          i === state.currentTeam ? { ...t, describerIndex: t.describerIndex + 1 } : t,
        );
      }
      const next = { ...state, teams };
      return { ...next, turn: handoffTurn(next, state.currentTeam) };
    }

    case 'READY': {
      if (state.phase !== 'handoff' || !turn) return state;
      return { ...state, turn: { ...turn, ready: true } };
    }

    case 'START_TURN': {
      if (state.phase !== 'handoff' || !turn || !turn.ready) return state;
      const { card, deck } = drawCard(state.deck);
      return {
        ...state,
        phase: 'describing',
        deck,
        turn: {
          ...turn,
          card,
          timer: { ...turn.timer, running: true, lastTickAt: action.now },
        },
      };
    }

    case 'TOGGLE_WORD': {
      if (state.phase !== 'describing' || !turn) return state;
      if (action.index < 0 || action.index >= WORDS_PER_CARD) return state;
      const timer = settleTimer(turn.timer, action.now);
      if (timer.remainingMs <= 0) return endTurn(state, { ...turn, timer }, 'time');
      const marked = [...turn.marked];
      marked[action.index] = !marked[action.index];
      const hits = marked[action.index]
        ? [...turn.hits, { index: action.index, atMs: timer.durationMs - timer.remainingMs }]
        : turn.hits.filter((h) => h.index !== action.index);
      const next: Turn = { ...turn, timer, marked, hits };
      if (marked.every(Boolean)) return endTurn(state, next, 'allFive');
      return { ...state, turn: next };
    }

    case 'TICK': {
      if (state.phase !== 'describing' || !turn) return state;
      const timer = settleTimer(turn.timer, action.now);
      if (timer.remainingMs <= 0) return endTurn(state, { ...turn, timer }, 'time');
      return { ...state, turn: { ...turn, timer } };
    }

    case 'TIME_UP': {
      if ((state.phase !== 'describing' && state.phase !== 'paused') || !turn) return state;
      return endTurn(state, { ...turn, timer: { ...turn.timer, remainingMs: 0 } }, 'time');
    }

    case 'END_EARLY': {
      if ((state.phase !== 'describing' && state.phase !== 'paused') || !turn) return state;
      return endTurn(state, { ...turn, timer: settleTimer(turn.timer, action.now) }, 'early');
    }

    case 'PAUSE': {
      if (state.phase !== 'describing' || !turn) return state;
      return pause(state, turn, action.now, action.reason ?? 'user');
    }

    case 'DESCRIBER_DISCONNECTED': {
      if (state.phase !== 'describing' || !turn) return state;
      return pause(state, turn, action.now, 'disconnected');
    }

    case 'RESUME': {
      if (state.phase !== 'paused' || !turn) return state;
      return {
        ...state,
        phase: 'describing',
        turn: { ...turn, pauseReason: null, timer: { ...turn.timer, running: true, lastTickAt: action.now } },
      };
    }

    case 'BEGIN_VALIDATION': {
      if (state.phase !== 'timeUp' || !turn) return state;
      if (state.settings.validation === 'none') return afterValidation(state, turn);
      return { ...state, phase: 'validating' };
    }

    case 'SET_VALIDATION': {
      if (state.phase !== 'validating' || !turn) return state;
      if (!turn.marked[action.index]) return state; // não se anula o que não foi acertado
      const annulled = [...turn.annulled];
      annulled[action.index] = action.annulled;
      return { ...state, turn: { ...turn, annulled } };
    }

    case 'CONFIRM_VALIDATION': {
      if (state.phase !== 'validating' || !turn) return state;
      return afterValidation(state, turn);
    }

    case 'ROLL_DIE': {
      if (state.phase !== 'rolling' || !turn || state.settings.scoring !== 'die') return state;
      if (turn.die !== null) return state;
      return { ...state, lastDie: action.value, turn: { ...turn, die: action.value } };
    }

    case 'APPLY_MOVE': {
      if (state.phase !== 'rolling' || !turn || turn.die === null) return state;
      return applyMove(state, turn);
    }

    case 'DIE_RETURNED': {
      if (state.phase !== 'moving' || !turn) return state;
      const settled = { ...state, turn: { ...turn, settled: true } };
      return state.winnerId ? { ...settled, phase: 'won' } : settled;
    }

    case 'UNDO_TURN': {
      if (!state.undo || !['rolling', 'moving', 'won'].includes(state.phase)) return state;
      return { ...state.undo, undo: null };
    }

    case 'NEXT_TEAM': {
      if (state.phase !== 'moving' || !turn) return state;
      const teams = state.teams.map((t, i) =>
        i === turn.teamIndex ? { ...t, describerIndex: t.describerIndex + 1, lastSide: turn.side } : t,
      );
      const currentTeam = (state.currentTeam + 1) % teams.length;
      const round = currentTeam === 0 ? state.round + 1 : state.round;
      const next: GameState = { ...state, teams, currentTeam, round, undo: null };
      return { ...next, phase: 'handoff', turn: handoffTurn(next, currentTeam) };
    }

    case 'LOAD':
      return normalizeLoaded(action.state);

    case 'RESET':
      return createInitialState(state.settings);
  }
}

/** Um jogo retomado nunca volta com o tempo a correr. */
export function normalizeLoaded(state: GameState): GameState {
  if (state.phase === 'describing' && state.turn) {
    return {
      ...state,
      phase: 'paused',
      turn: { ...state.turn, pauseReason: 'user', timer: stopTimer(state.turn.timer) },
    };
  }
  if (state.turn?.timer.running) {
    return { ...state, turn: { ...state.turn, timer: stopTimer(state.turn.timer) } };
  }
  return state;
}

/** Tempo restante num dado instante, sem alterar o estado. */
export function remainingAt(timer: TimerState, now: number): number {
  if (!timer.running || timer.lastTickAt === null) return timer.remainingMs;
  return Math.max(0, timer.remainingMs - Math.max(0, now - timer.lastTickAt));
}
