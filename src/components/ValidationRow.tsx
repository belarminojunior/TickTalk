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
}

/** Linha da carta revelada: válida / anulada / não acertada. */
export function ValidationRow({ index, word, marked, annulled, onChange, readOnly }: ValidationRowProps) {
  const t = useT();
  if (!marked) {
    return (
      <li className={`${styles.row} ${styles.missed}`}>
        <span className={styles.word}>{word}</span>
        <span className={styles.missedTag}>{t.notGuessed}</span>
      </li>
    );
  }
  return (
    <li className={`${styles.row} ${annulled ? styles.annulled : styles.valid}`} data-annulled={annulled}>
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

/** "Anula se quem explicou…" */
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
