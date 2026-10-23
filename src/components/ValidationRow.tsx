import { useT } from '../i18n';
import { CheckIcon, XIcon } from './Icons';
import styles from './ValidationRow.module.css';

export interface ValidationRowProps {
  index: number;
  word: string;
  marked: boolean;
  annulled: boolean;
  onChange?: (index: number, annulled: boolean) => void;
  readOnly?: boolean;
  /** Smaller rows, for showing both sides of the card at once. */
  compact?: boolean;
}

/** Row of the revealed card: valid / cancelled / not guessed. */
export function ValidationRow({ index, word, marked, annulled, onChange, readOnly, compact }: ValidationRowProps) {
  const t = useT();
  const size = compact ? styles.compact : '';
  if (!marked) {
    return (
      <li className={`${styles.row} ${styles.missed} ${size}`}>
        <span className={styles.word}>{word}</span>
        <span className={styles.missedTag}>{t.notGuessed}</span>
      </li>
    );
  }
  return (
    <li className={`${styles.row} ${annulled ? styles.annulled : styles.valid} ${size}`} data-annulled={annulled}>
      <span className={styles.mark} aria-hidden="true">
        {annulled ? <XIcon size={26} strokeWidth={3} /> : <CheckIcon size={26} strokeWidth={3} />}
      </span>
      <span className={styles.word}>{word}</span>
      {annulled && <span className={styles.annulledTag}>{t.annulled}</span>}
      {!readOnly && onChange && (
        <span className={styles.toggle} role="group" aria-label={t.validationGroup(word)}>
          <button
            type="button"
            className={`${styles.toggleBtn} ${!annulled ? styles.onValid : ''}`}
            aria-pressed={!annulled}
            onClick={() => onChange(index, false)}
          >
            {t.valid}
          </button>
          <button
            type="button"
            className={`${styles.toggleBtn} ${annulled ? styles.onAnnul : ''}`}
            aria-pressed={annulled}
            onClick={() => onChange(index, true)}
          >
            {t.annul}
          </button>
        </span>
      )}
    </li>
  );
}

/** "Cancel if the describer…" */
export function RulesList() {
  const t = useT();
  return (
    <section className={`panel ${styles.rulesPanel}`}>
      <h3 className="eyebrow">{t.annulIf}</h3>
      <ul className={styles.rules}>
        {t.annulRules.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
    </section>
  );
}
