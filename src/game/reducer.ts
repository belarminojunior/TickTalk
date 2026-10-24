import { clampSquare, sideFor } from './board';
import { createDeck, drawCard } from './deck';
import { advanceFor } from './dice';
import type {
  Card,
  GameState,
  PauseReason,
  Settings,
  Side,
  SideFlags,
  Team,
  TeamSetup,
  TimerState,
  Turn,
} from './types';
import { FINISH, WORDS_PER_CARD, WORDS_PER_TURN } from './types';

export type GameAction =
  | { type: 'SETUP'; settings: Settings; teams: TeamSetup[]; cards: Card[]; seed: number }
  | { type: 'HANDOFF'; skipDescriber?: boolean }
  | { type: 'READY' }
  | { type: 'START_TURN'; now: number }
  | { type: 'TOGGLE_WORD'; index: number; now: number }
  | { type: 'UNDO_HIT'; now: number }
  | { type: 'TICK'; now: number }
  | { type: 'TIME_UP'; now: number }
  | { type: 'END_EARLY'; now: number }
  | { type: 'BEGIN_VALIDATION' }
  | { type: 'SET_VALIDATION'; side: Side; index: number; annulled: boolean }
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
  packs: ['people', 'places', 'things', 'entertainment', 'mozambique'],
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

export function emptyFlags(): SideFlags {
  const none = () => Array.from({ length: WORDS_PER_CARD }, () => false);
  return { blue: none(), yellow: none() };
}

export function otherSide(side: Side): Side {
  return side === 'blue' ? 'yellow' : 'blue';
}

function setFlag(flags: SideFlags, side: Side, index: number, value: boolean): SideFlags {
  const row = [...flags[side]];
  row[index] = value;
  return { ...flags, [side]: row };
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
    up: sideFor(team),
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

/** Deducts the time elapsed since the last settlement. */
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

const SIDES: Side[] = ['blue', 'yellow'];

/** Valid words over both sides: marked and not cancelled. */
export function validCount(turn: Pick<Turn, 'marked' | 'annulled'>): number {
  return SIDES.reduce((n, side) => n + turn.marked[side].filter((m, i) => m && !turn.annulled[side][i]).length, 0);
}

/** Words marked as guessed, over both sides. */
export function markedCount(turn: Pick<Turn, 'marked'>): number {
  return SIDES.reduce((n, side) => n + turn.marked[side].filter(Boolean).length, 0);
}

function applyMove(state: GameState, turn: Turn): GameState {
  const team = state.teams[turn.teamIndex];
  const die = state.settings.scoring === 'die' ? turn.die : null;
  const steps = advanceFor(validCount(turn), die);
  const from = team.position;
  const to = clampSquare(from + steps);
  const teams = state.teams.map((t, i) => (i === turn.teamIndex ? { ...t, position: to } : t));
  // The game only ends when the pawn enters the Chegada, after square 36.
  const reached = from + steps >= FINISH;
  return {
    ...state,
    phase: 'moving',
    teams,
    winnerId: reached ? team.id : state.winnerId,
    turn: { ...turn, move: { from, to, steps }, settled: false },
  };
}

/** Step after validation: roll the die (die mode) or move straight away (no-die mode). */
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
      // Acts on the side that is face up. Marking a word turns the card over to the other
      // side; unmarking (a correction) leaves the card where it is.
      if (state.phase !== 'describing' || !turn) return state;
      if (action.index < 0 || action.index >= WORDS_PER_CARD) return state;
      const timer = settleTimer(turn.timer, action.now);
      if (timer.remainingMs <= 0) return endTurn(state, { ...turn, timer }, 'time');
      const side = turn.up;
      if (turn.marked[side][action.index]) {
        const marked = setFlag(turn.marked, side, action.index, false);
        const hits = turn.hits.filter((h) => !(h.side === side && h.index === action.index));
        return { ...state, turn: { ...turn, timer, marked, hits } };
      }
      const marked = setFlag(turn.marked, side, action.index, true);
      const hits = [...turn.hits, { side, index: action.index, atMs: timer.durationMs - timer.remainingMs }];
      const next: Turn = { ...turn, timer, marked, hits, up: otherSide(side) };
      if (markedCount(next) >= WORDS_PER_TURN) return endTurn(state, next, 'allWords');
      return { ...state, turn: next };
    }

    case 'UNDO_HIT': {
      // Takes back the last correct word and turns the card back to the side it was on.
      if (state.phase !== 'describing' || !turn || turn.hits.length === 0) return state;
      const last = turn.hits[turn.hits.length - 1];
      return {
        ...state,
        turn: {
          ...turn,
          timer: settleTimer(turn.timer, action.now),
          marked: setFlag(turn.marked, last.side, last.index, false),
          hits: turn.hits.slice(0, -1),
          up: last.side,
        },
      };
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
      if (!turn.marked[action.side]?.[action.index]) return state; // only guessed words can be cancelled
      return { ...state, turn: { ...turn, annulled: setFlag(turn.annulled, action.side, action.index, action.annulled) } };
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
      // Only once the pawn has landed (and the die is back on the board).
      if (state.phase !== 'moving' || !turn || !turn.settled) return state;
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

/** A resumed game never comes back with the timer running. */
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

/** Remaining time at a given instant, without changing the state. */
export function remainingAt(timer: TimerState, now: number): number {
  if (!timer.running || timer.lastTickAt === null) return timer.remainingMs;
  return Math.max(0, timer.remainingMs - Math.max(0, now - timer.lastTickAt));
}
