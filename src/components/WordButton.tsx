import type { Side } from '../game/types';
import { CheckIcon } from './Icons';
import styles from './Card.module.css';

export interface WordButtonProps {
  index: number;
  word: string;
  marked: boolean;
  side: Side;
  disabled?: boolean;
  onToggle: (index: number) => void;
}

/** Palavra da carta: tocar marca como acertada (preta, riscada, com visto); tocar outra vez desmarca. */
export function WordButton({ index, word, marked, side, disabled, onToggle }: WordButtonProps) {
  return (
    <button
      type="button"
      className={`${styles.word} ${marked ? styles.wordMarked : ''}`}
      data-side={side}
      aria-pressed={marked}
      disabled={disabled}
      onClick={() => onToggle(index)}
    >
      <span className={styles.badge} aria-hidden="true">
        {marked ? <CheckIcon size="62%" strokeWidth={3} /> : index + 1}
      </span>
      <span className={styles.wordText}>{word}</span>
    </button>
  );
}
