import type { Side, Team } from './types';
import { BOARD_SQUARES } from './types';

export interface GridCell {
  row: number;
  col: number;
}

/** Coordenadas (linha, coluna) das casas 1–36 numa grelha de 10 colunas × 7 linhas. */
export const BOARD_PATH: readonly GridCell[] = [
  [6, 4], [7, 4], [7, 3], [7, 2], [7, 1], [6, 1], [5, 1], [4, 1], [3, 1],
  [2, 1], [1, 1], [1, 2], [1, 3], [1, 4], [2, 4], [3, 4], [4, 4], [4, 5],
  [4, 6], [4, 7], [3, 7], [2, 7], [1, 7], [1, 8], [1, 9], [1, 10],
  [2, 10], [3, 10], [4, 10], [5, 10], [6, 10], [7, 10], [7, 9], [7, 8],
  [7, 7], [6, 7],
].map(([row, col]) => ({ row, col }));

export const BOARD_COLS = 10;
export const BOARD_ROWS = 7;

/** Casa 0 = Partida (azul). Ímpar = azul, par = amarela. */
export function squareColor(square: number): Side {
  if (square <= 0) return 'blue';
  return square % 2 === 1 ? 'blue' : 'yellow';
}

/** Lado da carta que a equipa lê: a cor da casa onde está o peão. */
export function sideFor(team: Pick<Team, 'position'>): Side {
  return squareColor(team.position);
}

export function clampSquare(square: number): number {
  return Math.max(0, Math.min(BOARD_SQUARES, square));
}

export type SquareIcon = 'star' | 'globe' | 'music' | 'ball' | 'film' | 'book';
const ICON_CYCLE: SquareIcon[] = ['star', 'globe', 'music', 'ball', 'film', 'book'];

export function iconFor(square: number): SquareIcon {
  return ICON_CYCLE[(square - 1) % ICON_CYCLE.length];
}
