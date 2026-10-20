import { forwardRef } from 'react';
import styles from './Dice.module.css';

/** O dado pousado no tabuleiro, a mostrar o último valor. */
export const BoardDie = forwardRef<HTMLDivElement, { value: number }>(function BoardDie({ value }, ref) {
  return (
    <div ref={ref} className={styles.boardDie} data-testid="board-die">
      <span>{value}</span>
    </div>
  );
});
