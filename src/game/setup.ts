import type { PackId, PawnColor, TeamSetup } from './types';
import { PAWN_COLORS } from './types';

export const MIN_TEAMS = 2;
export const MAX_TEAMS = 6;
export const MIN_PLAYERS = 2;

/** Linha do formulário: os jogadores vêm como texto separado por vírgulas. */
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
  | { kind: 'duplicatePlayers'; team: number }
  | { kind: 'noPacks' }
  | { kind: 'noCards' };

export function validateSetup(teams: TeamDraft[], packs: PackId[], cardCount: number): SetupError[] {
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
  if (packs.length === 0) errors.push({ kind: 'noPacks' });
  else if (cardCount === 0) errors.push({ kind: 'noCards' });
  return errors;
}

export function nextFreeColor(used: PawnColor[], after?: PawnColor): PawnColor {
  const start = after ? PAWN_COLORS.indexOf(after) + 1 : 0;
  for (let k = 0; k < PAWN_COLORS.length; k++) {
    const c = PAWN_COLORS[(start + k) % PAWN_COLORS.length];
    if (!used.includes(c)) return c;
  }
  return after ?? PAWN_COLORS[0];
}
