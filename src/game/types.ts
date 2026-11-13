export type Side = 'yellow' | 'blue';

export type PawnColor = 'red' | 'green' | 'purple' | 'orange' | 'white' | 'pink';
export const PAWN_COLORS: PawnColor[] = ['red', 'green', 'purple', 'orange', 'white', 'pink'];

export type PackId = 'people' | 'places' | 'things' | 'entertainment' | 'football' | 'anime' | 'mozambique';
export const PACK_IDS: PackId[] = ['people', 'places', 'things', 'entertainment', 'football', 'anime', 'mozambique'];

export type Language = 'pt' | 'en';
/**
 * phone: one shared phone, passed to each describer · teamPhones: one phone per team ·
 * playerPhones: everyone on their own phone (each person writes their name and picks a team).
 */
export type ScreenMode = 'phone' | 'teamPhones' | 'playerPhones';
export const SCREEN_MODES: ScreenMode[] = ['phone', 'teamPhones', 'playerPhones'];
/** Several phones at once, each one bound to a team (and, per person, to a player). */
export function hasPhonePerTeam(mode: ScreenMode): boolean {
  return mode === 'teamPhones' || mode === 'playerPhones';
}
export type TurnSeconds = 30 | 45 | 60;
/** Validation only exists with a phone per team (or per person): the next team checks on its own phone(s). */
export type ValidationMode = 'nextTeam' | 'none';

export interface Settings {
  screenMode: ScreenMode;
  turnSeconds: TurnSeconds;
  /** Derived from the mode when the game starts (see validationFor). */
  validation: ValidationMode;
  /** Card language. */
  language: Language;
  /** Interface language. */
  uiLanguage: Language;
}

/** A phone per team or per person → the next team validates; one shared phone → no validation. */
export function validationFor(mode: ScreenMode): ValidationMode {
  return hasPhonePerTeam(mode) ? 'nextTeam' : 'none';
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
  move: Move | null;
  /** The pawn has finished moving. */
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
