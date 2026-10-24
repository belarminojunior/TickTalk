export type Side = 'yellow' | 'blue';

export type PawnColor = 'red' | 'green' | 'purple' | 'orange' | 'white' | 'pink';
export const PAWN_COLORS: PawnColor[] = ['red', 'green', 'purple', 'orange', 'white', 'pink'];

export type PackId = 'people' | 'places' | 'things' | 'entertainment' | 'mozambique';
export const PACK_IDS: PackId[] = ['people', 'places', 'things', 'entertainment', 'mozambique'];

export type Language = 'pt' | 'en';
export type ScreenMode = 'phone' | 'windows' | 'single';
export type TurnSeconds = 30 | 45 | 60;
export type ValidationMode = 'nextTeam' | 'none';
export type ScoringMode = 'die' | 'noDie';

export interface Settings {
  screenMode: ScreenMode;
  turnSeconds: TurnSeconds;
  validation: ValidationMode;
  scoring: ScoringMode;
  /** Card language. */
  language: Language;
  /** Interface language. */
  uiLanguage: Language;
  packs: PackId[];
}

export interface CardSide {
  pack: PackId;
  words: string[];
}

export interface Card {
  id: string;
  yellow: CardSide;
  blue: CardSide;
}

export interface TeamSetup {
  name: string;
  color: PawnColor;
  players: string[];
}

export interface Team extends TeamSetup {
  id: string;
  /** 0 = start (Partida), 1..36 = squares, 37 = finish (Chegada). */
  position: number;
  /** Index of the next player to describe. */
  describerIndex: number;
  /** Card side read on this team's last turn (null = hasn't played yet). */
  lastSide: Side | null;
}

export type Phase =
  | 'setup'
  | 'handoff'
  | 'describing'
  | 'paused'
  | 'timeUp'
  | 'validating'
  | 'rolling'
  | 'moving'
  | 'won';

/** Per-side flags, one per word: `{ blue: [5], yellow: [5] }`. */
export type SideFlags = Record<Side, boolean[]>;

export interface Hit {
  /** Side of the card the word is on. */
  side: Side;
  /** Word position on that side (0–4). */
  index: number;
  /** Milliseconds since the turn started. */
  atMs: number;
}

export interface TimerState {
  durationMs: number;
  remainingMs: number;
  /** Instant (host clock) of the last settlement, while running. */
  lastTickAt: number | null;
  running: boolean;
}

export type PauseReason = 'user' | 'disconnected';
export type EndReason = 'time' | 'allWords' | 'early';

export interface Move {
  from: number;
  to: number;
  steps: number;
}

export interface Turn {
  teamIndex: number;
  describer: string;
  /** Side the turn starts on: the colour of the team's square. */
  side: Side;
  /** Side currently face up. Every correct word turns the card over to the other side. */
  up: Side;
  ready: boolean;
  card: Card | null;
  marked: SideFlags;
  annulled: SideFlags;
  hits: Hit[];
  timer: TimerState;
  pauseReason: PauseReason | null;
  endReason: EndReason | null;
  die: number | null;
  move: Move | null;
  /** The pawn has finished moving and the die is back on the board. */
  settled: boolean;
}

export interface Deck {
  cards: Card[];
  /** Shuffled order (indices into `cards`). */
  order: number[];
  next: number;
  seed: number;
}

export interface GameState {
  phase: Phase;
  settings: Settings;
  teams: Team[];
  currentTeam: number;
  round: number;
  turn: Turn | null;
  deck: Deck;
  /** Last die value (stays visible on the board). */
  lastDie: number | null;
  winnerId: string | null;
  /** One level of undo: the state before validation was confirmed. */
  undo: GameState | null;
}

export const WORDS_PER_CARD = 5;
/** Both sides of the card: 10 words to describe per turn. */
export const WORDS_PER_TURN = WORDS_PER_CARD * 2;
export const BOARD_SQUARES = 36;
/** The Chegada tile comes after square 36: a team wins when its pawn enters it. */
export const FINISH = BOARD_SQUARES + 1;
