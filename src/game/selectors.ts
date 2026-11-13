import { clampSquare, squareColor } from './board';
import { cardNumber } from './deck';
import { emptyFlags, markedCount, validCount } from './reducer';
import type {
  EndReason,
  GameState,
  Hit,
  Language,
  Move,
  PauseReason,
  PawnColor,
  Phase,
  ScreenMode,
  Settings,
  Side,
  SideFlags,
  Team,
  TimerState,
} from './types';

/** Phases in which the words may appear on the table. */
const REVEALED_PHASES: readonly Phase[] = ['validating', 'moving', 'won'];

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

/**
 * What a phone is for, right now (with a phone per team or per person; otherwise always
 * "describer"). "guesser": a teammate of the describer, on their own phone.
 */
export type PhoneRole = 'describer' | 'guesser' | 'validator' | 'spectator';

/** One phone per person: why this phone has no player right now. */
export type PhoneIssue = 'nameTaken' | 'removed';

export interface DescriberView {
  phase: Phase;
  language: Language;
  mode: ScreenMode;
  /**
   * This phone: its team and its role right now. One phone per person: also the person's
   * name (null until they write it) and why the table refused it.
   */
  you: { teamId: string | null; role: PhoneRole; refusedTeam: string | null; name: string | null; issue: PhoneIssue | null };
  /** Name of the team that checks this turn (the next team). */
  checking: string | null;
  /**
   * Teams to pick from, and whether each already has a phone (one phone per team) or who
   * is in it (one phone per person).
   */
  teamsList: { id: string; name: string; color: Team['color']; taken: boolean; members: string[] }[];
  /** One phone per person, mid-game, on a phone that isn't anyone yet: the players to pick from. */
  claimable: { team: string; name: string; online: boolean }[];
  /** The checking team's phone, while validating: both sides with marks and cancellations. */
  validation: {
    team: string;
    describer: string;
    side: Side;
    cardNumber: number;
    words: Record<Side, string[]>;
    marked: SideFlags;
    annulled: SideFlags;
  } | null;
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
    mode: state.settings.screenMode,
    you: { teamId: null, role: 'describer', refusedTeam: null, name: null, issue: null },
    checking: state.teams.length > 1 ? validatorTeam(state).name : null,
    teamsList: [],
    claimable: [],
    validation: null,
  };
}

/**
 * The view for one phone in "one phone per team" mode. The playing team's phone gets the
 * describer view (with the words); the checking team's phone gets the card to validate,
 * only while validating; every other phone gets the turn without any words.
 * In the other modes this is simply the describer view.
 */
export function phoneView(
  state: GameState,
  now: number,
  phone: { teamId: string | null; refusedTeam: string | null; takenTeams: readonly string[] },
): DescriberView {
  const base = describerView(state, now);
  if (state.settings.screenMode !== 'teamPhones') return base;

  const { turn } = state;
  const playing = turn ? state.teams[turn.teamIndex] : null;
  const checking = state.teams.length > 1 ? validatorTeam(state) : null;
  const role: PhoneRole =
    phone.teamId && playing && phone.teamId === playing.id
      ? 'describer'
      : phone.teamId && checking && phone.teamId === checking.id && state.phase === 'validating'
        ? 'validator'
        : 'spectator';

  const view: DescriberView = {
    ...base,
    you: { teamId: phone.teamId, role, refusedTeam: phone.refusedTeam, name: null, issue: null },
    teamsList: state.teams.map((t) => ({
      id: t.id,
      name: t.name,
      color: t.color,
      taken: t.id !== phone.teamId && phone.takenTeams.includes(t.id),
      members: [],
    })),
  };
  return withRole(view, state, role);
}

/** Only the describer sees the words; the checking team gets the card to validate. */
function withRole(view: DescriberView, state: GameState, role: PhoneRole): DescriberView {
  const { turn } = state;
  if (role !== 'describer') {
    view.words = null;
    view.cardNumber = null;
  }
  if (role === 'validator' && turn?.card) {
    view.validation = {
      team: state.teams[turn.teamIndex].name,
      describer: turn.describer,
      side: turn.side,
      cardNumber: cardNumber(turn.card),
      words: cardWords(turn.card),
      marked: copyFlags(turn.marked),
      annulled: copyFlags(turn.annulled),
    };
  }
  return view;
}

/** One phone per person: who this phone is, as the table knows it. */
export interface PlayerPhone {
  player: { name: string; team: string | null } | null;
  issue: PhoneIssue | null;
}

/** One phone per person: what every phone needs to know before and during the game. */
export interface Lobby {
  /** The setup rows (ids "t1"…), used before the game starts. */
  teams: { id: string; name: string; color: PawnColor }[];
  /** Everyone who joined from a phone. */
  roster: { name: string; team: string | null; online: boolean }[];
  /** The table's interface language (the game's settings only exist once it starts). */
  language: Language;
}

/**
 * The view for one phone in "one phone per person" mode. Before the game: the teams to
 * choose from, with who is in each. During the game, by role: the describer gets the words,
 * their teammates follow the turn, the checking team validates, everyone else watches.
 * A phone that isn't one of the game's players gets the list of players to pick from.
 */
export function playerPhoneView(state: GameState, now: number, phone: PlayerPhone, lobby: Lobby): DescriberView {
  const base = describerView(state, now);
  const { player } = phone;
  const you: DescriberView['you'] = {
    teamId: null,
    role: 'spectator',
    refusedTeam: null,
    name: player?.name ?? null,
    issue: phone.issue,
  };

  if (state.phase === 'setup') {
    return {
      ...base,
      mode: 'playerPhones',
      language: lobby.language,
      you: { ...you, teamId: player?.team ?? null },
      teamsList: lobby.teams.map((t) => ({
        ...t,
        taken: false,
        members: lobby.roster.filter((p) => p.team === t.id).map((p) => p.name),
      })),
      words: null,
      cardNumber: null,
    };
  }

  const { turn } = state;
  const myTeam = player?.team ? state.teams.find((t) => t.id === player.team && t.players.includes(player.name)) : undefined;
  const playing = turn ? state.teams[turn.teamIndex] : null;
  const checking = state.teams.length > 1 ? validatorTeam(state) : null;
  let role: PhoneRole = 'spectator';
  if (myTeam && playing && myTeam.id === playing.id) role = player!.name === turn!.describer ? 'describer' : 'guesser';
  else if (myTeam && checking && myTeam.id === checking.id && state.phase === 'validating') role = 'validator';

  const online = (team: string, name: string) => lobby.roster.some((p) => p.online && p.team === team && p.name === name);
  const view: DescriberView = {
    ...base,
    mode: 'playerPhones',
    you: { ...you, teamId: myTeam?.id ?? null, role },
    teamsList: state.teams.map((t) => ({ id: t.id, name: t.name, color: t.color, taken: false, members: [...t.players] })),
    claimable: myTeam ? [] : state.teams.flatMap((t) => t.players.map((name) => ({ team: t.id, name, online: online(t.id, name) }))),
  };
  return withRole(view, state, role);
}

/**
 * Who may send which command in "one phone per person" mode: only the describer runs the
 * turn (from handoff to passing it on); anyone in the checking team may validate.
 */
export function mayPlayerCommand(state: GameState, player: { name: string; team: string | null }, command: { type: string }): boolean {
  if (!state.turn || state.teams.length < 2 || !player.team) return false;
  if (command.type === 'SET_VALIDATION' || command.type === 'CONFIRM_VALIDATION') {
    return state.phase === 'validating' && validatorTeam(state).id === player.team;
  }
  const playing = state.teams[state.turn.teamIndex];
  return playing.id === player.team && player.name === state.turn.describer;
}

/**
 * Who may send which command in "one phone per team" mode: the playing team runs its turn;
 * only the checking team validates, and only while validating.
 */
export function mayCommand(state: GameState, team: string, command: { type: string }): boolean {
  if (!state.turn || state.teams.length < 2) return false;
  if (command.type === 'SET_VALIDATION' || command.type === 'CONFIRM_VALIDATION') {
    return state.phase === 'validating' && validatorTeam(state).id === team;
  }
  return state.teams[state.turn.teamIndex].id === team;
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

export function turnSummary(turn: Pick<TableTurnView, 'marked' | 'annulled'>) {
  const marked = markedCount(turn);
  const valid = validCount(turn);
  return { marked, annulled: marked - valid, valid };
}

/**
 * Where the active team's pawn is shown during the turn: it advances one square per
 * correct word, live. With validation this is provisional (cancelled words come off).
 * Returns null outside the turn.
 *  - describing/paused/timeUp: start + marked words
 *  - validating: start + valid words (cancelled ones already taken off)
 *  - moving: start + valid words, which is where the final hop begins
 */
export function provisionalPosition(view: Pick<TableView, 'phase' | 'teams' | 'turn'>): number | null {
  const { turn } = view;
  if (!turn) return null;
  const start = view.phase === 'moving' ? turn.move?.from : view.teams[turn.teamIndex].position;
  if (start === undefined) return null;
  switch (view.phase) {
    case 'describing':
    case 'paused':
    case 'timeUp':
      return clampSquare(start + markedCount(turn));
    case 'validating':
    case 'moving':
      return clampSquare(start + validCount(turn));
    default:
      return null;
  }
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
