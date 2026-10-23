import { useT } from '../i18n';
import styles from './ReplacedNotice.module.css';

/** Another page with the same role replaced this one; it will not reconnect on its own. */
export function ReplacedNotice({ role, onTakeOver }: { role: 'host' | 'describer'; onTakeOver: () => void }) {
  const t = useT();
  return (
    <div className={styles.backdrop}>
      <div className={styles.box} role="alertdialog" aria-modal="true" aria-labelledby="replaced-title">
        <h2 id="replaced-title">{role === 'host' ? t.replacedHostTitle : t.replacedDescriberTitle}</h2>
        <p>{role === 'host' ? t.replacedHostHelp : t.replacedDescriberHelp}</p>
        <button type="button" className="btn btn-primary btn-lg" onClick={onTakeOver} autoFocus>
          {t.useThisWindow}
        </button>
      </div>
    </div>
  );
}
