import type { CSSProperties, ReactNode } from 'react';
import { iconFor, squareColor, type GridCell } from '../game/board';
import { SQUARE_ICONS } from './Icons';
import styles from './Board.module.css';

export interface SquareProps {
  number: number;
  cell: GridCell;
  highlight?: boolean;
  children?: ReactNode;
}

export function Square({ number, cell, highlight, children }: SquareProps) {
  const color = squareColor(number);
  const Icon = SQUARE_ICONS[iconFor(number)];
  const style = { gridRow: cell.row, gridColumn: cell.col } as CSSProperties;
  return (
    <div
      className={`${styles.square} ${styles[color]} ${highlight ? styles.highlight : ''}`}
      style={style}
      data-square={number}
    >
      <span className={styles.number}>{number}</span>
      <Icon className={styles.icon} strokeWidth={2.2} size="100%" />
      {children}
    </div>
  );
}
