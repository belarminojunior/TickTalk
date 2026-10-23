import { squareColor } from './board';
import { cardNumber } from './deck';
import { DIE_FACES, advanceFor } from './dice';
import { emptyFlags, markedCount, validCount } from './reducer';
import type {
  EndReason,
  GameState,
  Hit,
  Language,
  Move,
  PauseReason,
  Phase,
  ScoringMode,
  Settings,
  Side,
  SideFlags,
  Team,
  TimerState,
} from './types';

/** Phases in which the words may appear on the table. */
const REVEALED_PHASES: readonly Phase[] = ['validating', 'rolling', 'moving', 'won'];

export function isRevealed(phase: Phase): boolean {
  return REVEALED_PHASES.includes(phase);
}

export interface TableTurnView {
  teamIndex: number;
  describer: string;
  guessers: string[];
  /** Side the turn started on. */
  side: Side;
  /** Side face up right now (it turns over on every correct word). */
  up: Side;
  ready: boolean;
  marked: SideFlags;
  annulled: SideFlags;
  hits: Hit[];
  timer: TimerState;
  pauseReason: PauseReason | null;
  endReason: EndReason | null;
  die: number | null;
  move: Move | null;
  settled: boolean;
  /** Both sides' words, only once time is up (validation onwards). */
  words: Record<Side, string[]> | null;
  cardNumber: number | null;
}

export interface TableView {
  phase: Phase;
  settings: Settings;
  teams: Team[];
  currentTeam: number;
  round: number;
  lastDie: number | null;
  winnerId: string | null;
  canUndo: boolean;
  turn: TableTurnView | null;
}

export function guessersOf(team: Team, describer: string): string[] {
  return team.players.filter((p) => p !== describer);
}

/** Table view: never carries the words before validation. */
export function tableView(state: GameState): TableView {
  const { turn } = state;
  const revealed = isRevealed(state.phase);
  return {
    phase: state.phase,
    settings: state.settings,
    teams: state.teams,
    currentTeam: state.currentTeam,
    round: state.round,
    lastDie: state.lastDie,
    winnerId: state.winnerId,
    canUndo: state.undo !== null,
    turn: turn
      ? {
          teamIndex: turn.teamIndex,
          describer: turn.describer,
          guessers: guessersOf(state.teams[turn.teamIndex], turn.describer),
          side: turn.side,
          up: turn.up,
          ready: turn.ready,
          marked: copyFlags(turn.marked),
          annulled: copyFlags(turn.annulled),
          hits: [...turn.hits],
          timer: { ...turn.timer },
          pauseReason: turn.pauseReason,
          endReason: turn.endReason,
          die: turn.die,
          move: turn.move,
          settled: turn.settled,
          words: revealed && turn.card ? cardWords(turn.card) : null,
          cardNumber: revealed && turn.card ? cardNumber(turn.card) : null,
        }
      : null,
  };
}

function copyFlags(flags: SideFlags): SideFlags {
  return { blue: [...flags.blue], yellow: [...flags.yellow] };
}

function cardWords(card: NonNullable<GameState['turn']>['card'] & object): Record<Side, string[]> {
  return { blue: [...card.blue.words], yellow: [...card.yellow.words] };
}

export interface DescriberView {
  phase: Phase;
  language: Language;
  team: { name: string; color: Team['color']; position: number } | null;
  /** Every team's pawn (for the blurred board in the background). */
  pawns: { id: string; name: string; color: Team['color']; position: number }[];
  describer: string | null;
  /** Side the turn starts on (the colour of the team's square). */
  side: Side;
  /** Side face up right now. */
  up: Side;
  /** The starting side changed since this team's last turn. */
  flipped: boolean;
  ready: boolean;
  cardNumber: number | null;
  /** Both sides' words, only during the turn. */
  words: Record<Side, string[]> | null;
  marked: SideFlags;
  timer: { durationMs: number; remainingMs: number; running: boolean };
  pauseReason: PauseReason | null;
  winner: string | null;
  /** End of the turn (moving phase only): the move, and who plays next. */
  endOfTurn: { steps: number; to: number; settled: boolean; nextPlayer: string; nextTeam: string } | null;
}

const DESCRIBER_WORD_PHASES: readonly Phase[] = ['describing', 'paused', 'timeUp'];

/** Describer view: has the words, but only during the turn. */
export function describerView(state: GameState, now: number): DescriberView {
  const { turn } = state;
  const team = turn ? state.teams[turn.teamIndex] : null;
  const showWords = !!turn?.card && DESCRIBER_WORD_PHASES.includes(state.phase);
  const winner = state.winnerId ? state.teams.find((t) => t.id === state.winnerId)?.name ?? null : null;
  return {
    phase: state.phase,
    language: state.settings.uiLanguage ?? state.settings.language,
    team: team ? { name: team.name, color: team.color, position: team.position } : null,
    pawns: state.teams.map((t) => ({ id: t.id, name: t.name, color: t.color, position: t.position })),
    describer: turn?.describer ?? null,
    side: turn?.side ?? 'blue',
    up: turn?.up ?? turn?.side ?? 'blue',
    flipped: !!team && team.lastSide !== null && !!turn && team.lastSide !== turn.side,
    ready: turn?.ready ?? false,
    cardNumber: showWords && turn?.card ? cardNumber(turn.card) : null,
    words: showWords && turn?.card ? cardWords(turn.card) : null,
    marked: turn ? copyFlags(turn.marked) : emptyFlags(),
    timer: turn
      ? {
          durationMs: turn.timer.durationMs,
          remainingMs: remainingNow(turn.timer, now),
          running: turn.timer.running,
        }
      : { durationMs: state.settings.turnSeconds * 1000, remainingMs: state.settings.turnSeconds * 1000, running: false },
    pauseReason: turn?.pauseReason ?? null,
    winner,
    endOfTurn: endOfTurnFor(state),
  };
}

function endOfTurnFor(state: GameState): DescriberView['endOfTurn'] {
  const move = state.turn?.move;
  if (state.phase !== 'moving' || !state.turn || !move) return null;
  const next = nextDescriber(state);
  return { steps: move.steps, to: move.to, settled: state.turn.settled, nextPlayer: next.player, nextTeam: next.team.name };
}

function remainingNow(timer: TimerState, now: number): number {
  if (!timer.running || timer.lastTickAt === null) return timer.remainingMs;
  return Math.max(0, timer.remainingMs - Math.max(0, now - timer.lastTickAt));
}

export type SequenceLabel = 'justPlayed' | 'next' | 'later';

/** Team order, starting from the team that just played. */
export function teamSequence(state: Pick<GameState, 'teams' | 'currentTeam'>): { team: Team; label: SequenceLabel }[] {
  const n = state.teams.length;
  return Array.from({ length: n }, (_, k) => {
    const team = state.teams[(state.currentTeam + k) % n];
    const label: SequenceLabel = k === 0 ? 'justPlayed' : k === 1 ? 'next' : 'later';
    return { team, label };
  });
}

export function nextTeamIndex(state: Pick<GameState, 'teams' | 'currentTeam'>): number {
  return (state.currentTeam + 1) % state.teams.length;
}

/** Who checks: the next team. */
export function validatorTeam(state: Pick<GameState, 'teams' | 'currentTeam'>): Team {
  return state.teams[nextTeamIndex(state)];
}

/** Who describes on the next team's turn. */
export function nextDescriber(state: Pick<GameState, 'teams' | 'currentTeam'>): { team: Team; player: string } {
  const team = state.teams[nextTeamIndex(state)];
  return { team, player: team.players[team.describerIndex % team.players.length] };
}

/** "If time ran out now": advance for each die face (or with no die). */
export function projection(marked: number, scoring: ScoringMode): { die: number | null; advance: number }[] {
  if (scoring === 'noDie') return [{ die: null, advance: advanceFor(marked, null) }];
  const faces = [...new Set(DIE_FACES)];
  return faces.map((die) => ({ die, advance: advanceFor(marked, die) }));
}

export function turnSummary(turn: Pick<TableTurnView, 'marked' | 'annulled'>) {
  const marked = markedCount(turn);
  const valid = validCount(turn);
  return { marked, annulled: marked - valid, valid };
}

export function colorChanged(move: Move): boolean {
  return squareColor(move.from) !== squareColor(move.to);
}

export function rankings(teams: Team[], winnerId: string | null): Team[] {
  return [...teams].sort((a, b) => {
    if (a.id === winnerId) return -1;
    if (b.id === winnerId) return 1;
    return b.position - a.position;
  });
}
