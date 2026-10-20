import type { GameState, PawnColor, Settings } from './types';

export const SAVE_KEY = 'ticktalk.save';
export const SETUP_KEY = 'ticktalk.setup';
/** Sobe este número quando a forma do GameState mudar; jogos antigos são ignorados. */
export const SAVE_SCHEMA = 1;

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
    /* sem espaço ou sem acesso: o jogo continua sem guardar */
  }
}

export function saveGame(state: GameState, now = Date.now()): void {
  if (state.phase === 'setup') return;
  // O snapshot de desfazer não precisa de ir para o disco duas vezes.
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

export function loadGame(): SavedGame | null {
  const data = readJson(SAVE_KEY) as Partial<SavedGame> | null;
  if (!data || data.schema !== SAVE_SCHEMA || !looksLikeState(data.state)) return null;
  if (data.state.phase === 'setup') return null;
  return data as SavedGame;
}

export function clearSavedGame(): void {
  try {
    storage()?.removeItem(SAVE_KEY);
  } catch {
    /* ignorar */
  }
}

export function saveSetup(setup: Omit<SavedSetup, 'schema'>): void {
  writeJson(SETUP_KEY, { schema: SAVE_SCHEMA, ...setup });
}

export function loadSetup(): SavedSetup | null {
  const data = readJson(SETUP_KEY) as Partial<SavedSetup> | null;
  if (!data || data.schema !== SAVE_SCHEMA || !data.settings || !Array.isArray(data.teams)) return null;
  return data as SavedSetup;
}
