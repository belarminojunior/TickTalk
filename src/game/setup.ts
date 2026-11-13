import type { PawnColor, ScreenMode, TeamSetup } from './types';
import { PAWN_COLORS } from './types';

export const MIN_TEAMS = 2;
export const MAX_TEAMS = 6;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 10;

/** Groups are lettered A, B, C… until someone gives the team a name. */
export function groupLetter(index: number): string {
  return 'ABCDEFGHIJ'[index] ?? String(index + 1);
}

/** A form row: players come as comma-separated text. An empty name means "Grupo A". */
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

/** @param groupName the name a team without one gets ("Grupo A"). */
export function toTeamSetup(draft: TeamDraft, groupName: string): TeamSetup {
  return { name: draft.name.trim() || groupName, color: draft.color, players: parsePlayers(draft.players) };
}

/**
 * PC + one phone: nobody types names. Each group just has N people, called "Pessoa 1", …
 * (`label` gives the name for a number, in the interface language).
 */
export function numberedPlayers(count: number, label: (n: number) => string): string {
  const n = Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, count));
  return Array.from({ length: n }, (_, i) => label(i + 1)).join(', ');
}

export type SetupError =
  | { kind: 'tooFewTeams' }
  | { kind: 'teamPlayers'; team: number }
  | { kind: 'duplicatePlayers'; team: number };

export function validateSetup(teams: TeamDraft[]): SetupError[] {
  const errors: SetupError[] = [];
  if (teams.length < MIN_TEAMS) errors.push({ kind: 'tooFewTeams' });
  teams.forEach((t, team) => {
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

/** Shuffles, then deals one at a time into `count` groups (sizes differ by at most one). */
export function dealRandomly<T>(items: readonly T[], count: number, random: () => number = Math.random): T[][] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return Array.from({ length: count }, (_, i) => shuffled.filter((_, k) => k % count === i));
}

/** Setup row ids, as the game will number the teams. */
export function teamIdAt(index: number): string {
  return `t${index + 1}`;
}

/**
 * The teams the game starts with, by mode: one phone per person → whoever joined each group;
 * PC + one phone → the group's numbered people (at least 2); one phone per team → as written
 * on each group's phone.
 */
export function gameDrafts(
  mode: ScreenMode,
  teams: TeamDraft[],
  roster: readonly { name: string; team: string | null }[],
  personLabel: (n: number) => string,
): TeamDraft[] {
  if (mode === 'playerPhones') return withRoster(teams, roster);
  if (mode === 'phone') {
    return teams.map((t) => {
      const count = parsePlayers(t.players).length;
      return count >= MIN_PLAYERS ? t : { ...t, players: numberedPlayers(count, personLabel) };
    });
  }
  return teams;
}

/**
 * One phone per person: the rows' players are whoever picked each team on their phone
 * (in the order they joined, which is the order they describe).
 */
export function withRoster(teams: TeamDraft[], roster: readonly { name: string; team: string | null }[]): TeamDraft[] {
  return teams.map((team, i) => ({
    ...team,
    players: roster
      .filter((p) => p.team === teamIdAt(i))
      .map((p) => p.name)
      .join(', '),
  }));
}

export function nextFreeColor(used: PawnColor[], after?: PawnColor): PawnColor {
  const start = after ? PAWN_COLORS.indexOf(after) + 1 : 0;
  for (let k = 0; k < PAWN_COLORS.length; k++) {
    const c = PAWN_COLORS[(start + k) % PAWN_COLORS.length];
    if (!used.includes(c)) return c;
  }
  return after ?? PAWN_COLORS[0];
}
