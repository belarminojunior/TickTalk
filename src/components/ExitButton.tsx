import { useState } from 'react';
import { useT } from '../i18n';
import { Modal } from './Controls';
import { ExitIcon } from './Icons';
import styles from './ExitButton.module.css';

/** "Sair" during the game: asks first, then leaves to the setup screen (the game stays saved). */
export function ExitButton({ onExit, round = false }: { onExit: () => void; round?: boolean }) {
  const t = useT();
  const [confirming, setConfirming] = useState(false);
  return (
    <>
      <button
        type="button"
        className={round ? styles.round : 'btn btn-outline'}
        onClick={() => setConfirming(true)}
        aria-label={round ? t.exit : undefined}
      >
        <ExitIcon size={round ? 22 : 18} />
        {!round && t.exit}
      </button>
      {confirming && (
        <Modal title={t.exitTitle} onClose={() => setConfirming(false)}>
          <p className={styles.body}>{t.exitBody}</p>
          <div className={styles.actions}>
            <button type="button" className="btn btn-outline btn-lg" onClick={() => setConfirming(false)} autoFocus>
              {t.keepPlaying}
            </button>
            <button type="button" className="btn btn-primary btn-lg" onClick={onExit}>
              <ExitIcon size={20} /> {t.exitConfirm}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
