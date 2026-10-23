import { forwardRef } from 'react';
import styles from './Dice.module.css';

/** The die resting on the board, showing the last value. */
export const BoardDie = forwardRef<HTMLDivElement, { value: number }>(function BoardDie({ value }, ref) {
  return (
    <div ref={ref} className={styles.boardDie} data-testid="board-die">
      <span>{value}</span>
    </div>
  );
});
