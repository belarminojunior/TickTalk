import type { Side, Team } from './types';
import { FINISH } from './types';

export interface GridCell {
  row: number;
  col: number;
}

/** (row, column) of squares 1–36 on a 10-column × 7-row grid. */
export const BOARD_PATH: readonly GridCell[] = [
  [6, 4], [7, 4], [7, 3], [7, 2], [7, 1], [6, 1], [5, 1], [4, 1], [3, 1],
  [2, 1], [1, 1], [1, 2], [1, 3], [1, 4], [2, 4], [3, 4], [4, 4], [4, 5],
  [4, 6], [4, 7], [3, 7], [2, 7], [1, 7], [1, 8], [1, 9], [1, 10],
  [2, 10], [3, 10], [4, 10], [5, 10], [6, 10], [7, 10], [7, 9], [7, 8],
  [7, 7], [6, 7],
].map(([row, col]) => ({ row, col }));

export const BOARD_COLS = 10;
export const BOARD_ROWS = 7;

/**
 * Colours alternate along the whole track, Partida to Chegada:
 * Partida (0) blue, 1 yellow, 2 blue, … 36 blue, Chegada (37) yellow.
 */
export function squareColor(square: number): Side {
  return Math.max(0, square) % 2 === 0 ? 'blue' : 'yellow';
}

/** Card side the team reads: the colour of the square its pawn is on. */
export function sideFor(team: Pick<Team, 'position'>): Side {
  return squareColor(team.position);
}

/** 0 (Partida) … 37 (Chegada). */
export function clampSquare(square: number): number {
  return Math.max(0, Math.min(FINISH, square));
}

export type SquareIcon = 'star' | 'globe' | 'music' | 'ball' | 'film' | 'book';
const ICON_CYCLE: SquareIcon[] = ['star', 'globe', 'music', 'ball', 'film', 'book'];

export function iconFor(square: number): SquareIcon {
  return ICON_CYCLE[(square - 1) % ICON_CYCLE.length];
}
