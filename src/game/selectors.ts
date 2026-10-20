import { squareColor } from './board';
import { cardNumber } from './deck';
import { DIE_FACES, advanceFor } from './dice';
import { markedCount, validCount } from './reducer';
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
  Team,
  TimerState,
} from './types';

/** Fases em que as palavras já podem aparecer na mesa. */
const REVEALED_PHASES: readonly Phase[] = ['validating', 'rolling', 'moving', 'won'];

export function isRevealed(phase: Phase): boolean {
  return REVEALED_PHASES.includes(phase);
}

export interface TableTurnView {
  teamIndex: number;
  describer: string;
  guessers: string[];
  side: Side;
  ready: boolean;
  marked: boolean[];
  annulled: boolean[];
  hits: Hit[];
  timer: TimerState;
  pauseReason: PauseReason | null;
  endReason: EndReason | null;
  die: number | null;
  move: Move | null;
  settled: boolean;
  /** Só depois de o tempo acabar (validação em diante). */
  words: string[] | null;
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

/** Vista da mesa: nunca leva as palavras antes da validação. */
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
          ready: turn.ready,
          marked: [...turn.marked],
          annulled: [...turn.annulled],
          hits: [...turn.hits],
          timer: { ...turn.timer },
          pauseReason: turn.pauseReason,
          endReason: turn.endReason,
          die: turn.die,
          move: turn.move,
          settled: turn.settled,
          words: revealed && turn.card ? [...turn.card[turn.side].words] : null,
          cardNumber: revealed && turn.card ? cardNumber(turn.card) : null,
        }
      : null,
  };
}

export interface DescriberView {
  phase: Phase;
  language: Language;
  team: { name: string; color: Team['color']; position: number } | null;
  /** Peões de todas as equipas (para o tabuleiro desfocado ao fundo). */
  pawns: { id: string; name: string; color: Team['color']; position: number }[];
  describer: string | null;
  side: Side;
  /** A carta mudou de lado desde a última vez desta equipa. */
  flipped: boolean;
  ready: boolean;
  cardNumber: number | null;
  words: string[] | null;
  marked: boolean[];
  timer: { durationMs: number; remainingMs: number; running: boolean };
  pauseReason: PauseReason | null;
  winner: string | null;
}

const DESCRIBER_WORD_PHASES: readonly Phase[] = ['describing', 'paused', 'timeUp'];

/** Vista de quem explica: tem as palavras, mas só durante a vez. */
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
    flipped: !!team && team.lastSide !== null && !!turn && team.lastSide !== turn.side,
    ready: turn?.ready ?? false,
    cardNumber: showWords && turn?.card ? cardNumber(turn.card) : null,
    words: showWords && turn?.card ? [...turn.card[turn.side].words] : null,
    marked: turn ? [...turn.marked] : [false, false, false, false, false],
    timer: turn
      ? {
          durationMs: turn.timer.durationMs,
          remainingMs: remainingNow(turn.timer, now),
          running: turn.timer.running,
        }
      : { durationMs: state.settings.turnSeconds * 1000, remainingMs: state.settings.turnSeconds * 1000, running: false },
    pauseReason: turn?.pauseReason ?? null,
    winner,
  };
}

function remainingNow(timer: TimerState, now: number): number {
  if (!timer.running || timer.lastTickAt === null) return timer.remainingMs;
  return Math.max(0, timer.remainingMs - Math.max(0, now - timer.lastTickAt));
}

export type SequenceLabel = 'justPlayed' | 'next' | 'later';

/** Ordem das equipas a partir da equipa que acabou de jogar. */
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

/** Quem valida: a equipa seguinte. */
export function validatorTeam(state: Pick<GameState, 'teams' | 'currentTeam'>): Team {
  return state.teams[nextTeamIndex(state)];
}

/** Quem explica na próxima vez da equipa seguinte. */
export function nextDescriber(state: Pick<GameState, 'teams' | 'currentTeam'>): { team: Team; player: string } {
  const team = state.teams[nextTeamIndex(state)];
  return { team, player: team.players[team.describerIndex % team.players.length] };
}

/** "Se o tempo acabasse agora": avanço para cada face do dado (ou sem dado). */
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
