import { useState } from 'react';
import { useT } from '../i18n';
import { Modal } from './Controls';
import { ExitIcon } from './Icons';
import styles from './ExitButton.module.css';

/** "Sair" during the game: asks first, then leaves to the setup screen (the game stays saved). */
export function ExitButton({ onExit }: { onExit: () => void }) {
  const t = useT();
  const [confirming, setConfirming] = useState(false);
  return (
    <>
      <button type="button" className="btn btn-outline" onClick={() => setConfirming(true)}>
        <ExitIcon size={18} />
        {t.exit}
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
