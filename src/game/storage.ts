import type { Card, GameState, PackId, PawnColor, Settings, Side, Turn } from './types';
import { WORDS_PER_CARD } from './types';

export const SAVE_KEY = 'ticktalk.save';
export const SETUP_KEY = 'ticktalk.setup';
/** Bump this when the shape of GameState changes; older saves are ignored. */
export const SAVE_SCHEMA = 3;

export interface SavedGame {
  schema: number;
  savedAt: number;
  state: GameState;
}

export interface SavedSetup {
  schema: number;
  settings: Settings;
  teams: { name: string; color: PawnColor; players: string }[];
}

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

function readJson(key: string): unknown {
  const s = storage();
  if (!s) return null;
  try {
    const raw = s.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    storage()?.setItem(key, JSON.stringify(value));
  } catch {
    /* out of space or no access: the game carries on without saving */
  }
}

export function saveGame(state: GameState, now = Date.now()): void {
  if (state.phase === 'setup') return;
  const saved: SavedGame = { schema: SAVE_SCHEMA, savedAt: now, state };
  writeJson(SAVE_KEY, saved);
}

function looksLikeState(value: unknown): value is GameState {
  if (!value || typeof value !== 'object') return false;
  const s = value as Partial<GameState>;
  return (
    typeof s.phase === 'string' &&
    Array.isArray(s.teams) &&
    s.teams.length >= 2 &&
    typeof s.settings === 'object' &&
    typeof s.deck === 'object' &&
    Array.isArray(s.deck?.cards)
  );
}

// Old saves are migrated, not dropped:
//  - schema 1 used Portuguese pack ids;
//  - schemas 1–2 had one side of marks per turn (the card did not turn over on each hit).
const V1_PACK_IDS: Record<string, PackId> = {
  pessoas: 'people',
  lugares: 'places',
  coisas: 'things',
  entretenimento: 'entertainment',
  mocambique: 'mozambique',
};

function migratePack(pack: PackId): PackId {
  return V1_PACK_IDS[pack] ?? pack;
}

function migrateSettings(settings: Settings): Settings {
  return Array.isArray(settings.packs) ? { ...settings, packs: settings.packs.map(migratePack) } : settings;
}

function migrateCard(card: Card): Card {
  return {
    ...card,
    yellow: { ...card.yellow, pack: migratePack(card.yellow.pack) },
    blue: { ...card.blue, pack: migratePack(card.blue.pack) },
  };
}

interface OldTurn extends Omit<Turn, 'marked' | 'annulled' | 'up' | 'hits'> {
  marked: boolean[];
  annulled: boolean[];
  hits: { index: number; atMs: number }[];
}

function migrateTurn(turn: Turn | OldTurn | null): Turn | null {
  if (!turn || !Array.isArray(turn.marked)) return turn as Turn | null;
  const old = turn as OldTurn;
  const other: Side = old.side === 'blue' ? 'yellow' : 'blue';
  const none = () => Array.from({ length: WORDS_PER_CARD }, () => false);
  const flags = (row: boolean[]) => ({ [old.side]: row, [other]: none() }) as Record<Side, boolean[]>;
  return {
    ...old,
    up: old.side,
    marked: flags(old.marked),
    annulled: flags(old.annulled),
    hits: old.hits.map((h) => ({ ...h, side: old.side })),
    endReason: (old.endReason as string) === 'allFive' ? 'allWords' : old.endReason,
    card: old.card ? migrateCard(old.card) : null,
  };
}

function migrateState(state: GameState): GameState {
  return {
    ...state,
    settings: migrateSettings(state.settings),
    deck: { ...state.deck, cards: state.deck.cards.map(migrateCard) },
    turn: migrateTurn(state.turn),
    undo: state.undo ? migrateState(state.undo) : null,
  };
}

export function loadGame(): SavedGame | null {
  const data = readJson(SAVE_KEY) as Partial<SavedGame> | null;
  if (!data || !looksLikeState(data.state) || data.state.phase === 'setup') return null;
  if (data.schema === 1 || data.schema === 2) {
    return { schema: SAVE_SCHEMA, savedAt: data.savedAt ?? 0, state: migrateState(data.state) };
  }
  if (data.schema !== SAVE_SCHEMA) return null;
  return data as SavedGame;
}

export function clearSavedGame(): void {
  try {
    storage()?.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}

export function saveSetup(setup: Omit<SavedSetup, 'schema'>): void {
  writeJson(SETUP_KEY, { schema: SAVE_SCHEMA, ...setup });
}

export function loadSetup(): SavedSetup | null {
  const data = readJson(SETUP_KEY) as Partial<SavedSetup> | null;
  if (!data || !data.settings || !Array.isArray(data.teams)) return null;
  if (data.schema === 1 || data.schema === 2) {
    return { ...(data as SavedSetup), schema: SAVE_SCHEMA, settings: migrateSettings(data.settings) };
  }
  if (data.schema !== SAVE_SCHEMA) return null;
  return data as SavedSetup;
}
