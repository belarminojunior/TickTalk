import type { PawnColor, TeamSetup } from './types';
import { PAWN_COLORS } from './types';

export const MIN_TEAMS = 2;
export const MAX_TEAMS = 6;
export const MIN_PLAYERS = 2;

/** A form row: players come as comma-separated text. */
export interface TeamDraft {
  name: string;
  color: PawnColor;
  players: string;
}

export function parsePlayers(text: string): string[] {
  return text
    .split(/[,;\n]/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function toTeamSetup(draft: TeamDraft): TeamSetup {
  return { name: draft.name.trim(), color: draft.color, players: parsePlayers(draft.players) };
}

export type SetupError =
  | { kind: 'tooFewTeams' }
  | { kind: 'teamName'; team: number }
  | { kind: 'teamPlayers'; team: number }
  | { kind: 'duplicatePlayers'; team: number };

export function validateSetup(teams: TeamDraft[]): SetupError[] {
  const errors: SetupError[] = [];
  if (teams.length < MIN_TEAMS) errors.push({ kind: 'tooFewTeams' });
  teams.forEach((t, team) => {
    if (!t.name.trim()) errors.push({ kind: 'teamName', team });
    const players = parsePlayers(t.players);
    if (players.length < MIN_PLAYERS) errors.push({ kind: 'teamPlayers', team });
    else if (new Set(players.map((p) => p.toLowerCase())).size !== players.length) {
      errors.push({ kind: 'duplicatePlayers', team });
    }
  });
  return errors;
}

export type ShuffleError = { kind: 'tooFewPlayers'; needed: number } | { kind: 'repeatedName'; name: string };

/** Why a list of names can't be split into `teamCount` teams, or null if it can. */
export function shuffleError(names: string[], teamCount: number): ShuffleError | null {
  const seen = new Set<string>();
  for (const name of names) {
    const key = name.toLowerCase();
    if (seen.has(key)) return { kind: 'repeatedName', name };
    seen.add(key);
  }
  const needed = teamCount * MIN_PLAYERS;
  return names.length < needed ? { kind: 'tooFewPlayers', needed } : null;
}

/**
 * Random teams from a list of names: shuffled, then dealt one at a time so team sizes differ
 * by at most one. Team names and colours stay as they were; extra teams get a free colour and
 * no name, so the players still name them.
 */
export function randomTeams(
  names: string[],
  teamCount: number,
  current: TeamDraft[],
  random: () => number = Math.random,
): TeamDraft[] {
  const shuffled = [...names];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const used = current.slice(0, teamCount).map((t) => t.color);
  return Array.from({ length: teamCount }, (_, i) => {
    const kept = current[i];
    const color = kept?.color ?? nextFreeColor(used);
    if (!kept) used.push(color);
    const players = shuffled.filter((_, k) => k % teamCount === i);
    return { name: kept?.name ?? '', color, players: players.join(', ') };
  });
}

export function nextFreeColor(used: PawnColor[], after?: PawnColor): PawnColor {
  const start = after ? PAWN_COLORS.indexOf(after) + 1 : 0;
  for (let k = 0; k < PAWN_COLORS.length; k++) {
    const c = PAWN_COLORS[(start + k) % PAWN_COLORS.length];
    if (!used.includes(c)) return c;
  }
  return after ?? PAWN_COLORS[0];
}
