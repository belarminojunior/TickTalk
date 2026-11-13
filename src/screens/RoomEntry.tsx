import { useId, useState, type FormEvent } from 'react';
import { useT } from '../i18n';
import { normalizeRoomCode } from '../net/room';
import styles from './TeamPhoneScreens.module.css';
import own from './PlayerPhoneScreens.module.css';

/** "Em que sala vais jogar?" — a phone opened without a room code, or with one that doesn't exist. */
export function RoomEntry({ notFound, onRoom }: { notFound: string | null; onRoom: (code: string) => void }) {
  const t = useT();
  const id = useId();
  const [text, setText] = useState('');
  const [tried, setTried] = useState(false);
  const code = normalizeRoomCode(text);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (code) onRoom(code);
  };

  return (
    <form className={styles.panel} onSubmit={submit} noValidate>
      <h1 className={styles.title}>{t.roomTitle}</h1>
      <p className={styles.muted}>{t.roomHelp}</p>
      {notFound && (
        <p className={styles.warning} role="alert">
          {t.roomNotFound(notFound)}
        </p>
      )}
      <label htmlFor={`${id}-room`} className={own.label}>
        {t.roomCode}
      </label>
      <input
        id={`${id}-room`}
        className={`${own.input} ${own.roomInput}`}
        value={text}
        onChange={(e) => setText(e.target.value.toUpperCase())}
        placeholder="ABCD"
        maxLength={6}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        enterKeyHint="go"
        aria-invalid={(tried && !code) || undefined}
        autoFocus
      />
      {tried && !code && (
        <p className={styles.warning} role="alert">
          {t.roomInvalid}
        </p>
      )}
      <div className={own.buttons}>
        <button type="submit" className="btn btn-primary btn-lg">
          {t.enterRoom}
        </button>
      </div>
    </form>
  );
}
