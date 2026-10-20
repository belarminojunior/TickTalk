export type Side = 'yellow' | 'blue';

export type PawnColor = 'red' | 'green' | 'purple' | 'orange' | 'white' | 'pink';
export const PAWN_COLORS: PawnColor[] = ['red', 'green', 'purple', 'orange', 'white', 'pink'];

export type PackId = 'pessoas' | 'lugares' | 'coisas' | 'entretenimento' | 'mocambique';
export const PACK_IDS: PackId[] = ['pessoas', 'lugares', 'coisas', 'entretenimento', 'mocambique'];

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
  /** Língua das cartas. */
  language: Language;
  /** Língua da interface. */
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
  /** 0 = Partida, 1..36 = casas. */
  position: number;
  /** Índice do próximo jogador a explicar. */
  describerIndex: number;
  /** Lado da carta lido na última vez desta equipa (null = ainda não jogou). */
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

export interface Hit {
  /** Posição da palavra (0–4). */
  index: number;
  /** Milissegundos desde o início da vez. */
  atMs: number;
}

export interface TimerState {
  durationMs: number;
  remainingMs: number;
  /** Instante (relógio do anfitrião) do último acerto de contas, quando a correr. */
  lastTickAt: number | null;
  running: boolean;
}

export type PauseReason = 'user' | 'disconnected';
export type EndReason = 'time' | 'allFive' | 'early';

export interface Move {
  from: number;
  to: number;
  steps: number;
}

export interface Turn {
  teamIndex: number;
  describer: string;
  side: Side;
  ready: boolean;
  card: Card | null;
  marked: boolean[];
  annulled: boolean[];
  hits: Hit[];
  timer: TimerState;
  pauseReason: PauseReason | null;
  endReason: EndReason | null;
  die: number | null;
  move: Move | null;
  /** O peão terminou de andar e o dado voltou ao tabuleiro. */
  settled: boolean;
}

export interface Deck {
  cards: Card[];
  /** Ordem baralhada (índices em `cards`). */
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
  /** Último valor do dado (fica visível no tabuleiro). */
  lastDie: number | null;
  winnerId: string | null;
  /** Um nível de desfazer: o estado antes de confirmar a validação. */
  undo: GameState | null;
}

export const WORDS_PER_CARD = 5;
export const BOARD_SQUARES = 36;
