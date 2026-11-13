import { useId, useState, type FormEvent } from 'react';
import { MiniSquares } from '../components/Controls';
import { DevicesIcon, PlayerPhonesIcon } from '../components/Icons';
import { useT } from '../i18n';
import { normalizeRoomCode } from '../net/room';
import styles from './HomeScreen.module.css';

/**
 * The first page: create a room (this screen becomes the table) or join one (this phone
 * joins a table by its 4-letter code).
 */
export function HomeScreen({ onCreate, onJoin }: { onCreate: () => void; onJoin: (code: string) => void }) {
  const t = useT();
  const id = useId();
  const [text, setText] = useState('');
  const [tried, setTried] = useState(false);
  const code = normalizeRoomCode(text);

  const join = (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (code) onJoin(code);
  };

  return (
    <main className={styles.screen}>
      <header className={styles.hero}>
        <MiniSquares />
        <h1 className={styles.title}>Tick Talk</h1>
        <p className={styles.tagline}>{t.tagline}</p>
      </header>

      <div className={styles.choices}>
        <section className={`panel ${styles.choice}`} aria-labelledby={`${id}-create`}>
          <DevicesIcon size={40} className={styles.icon} />
          <h2 id={`${id}-create`} className={styles.choiceTitle}>
            {t.homeCreate}
          </h2>
          <p className={styles.help}>{t.homeCreateHelp}</p>
          <button type="button" className="btn btn-primary btn-lg" onClick={onCreate}>
            {t.homeCreate}
          </button>
        </section>

        <form className={`panel ${styles.choice}`} onSubmit={join} noValidate aria-labelledby={`${id}-join`}>
          <PlayerPhonesIcon size={40} className={styles.icon} />
          <h2 id={`${id}-join`} className={styles.choiceTitle}>
            {t.homeJoin}
          </h2>
          <p className={styles.help}>{t.homeJoinHelp}</p>
          <label htmlFor={`${id}-code`} className="visually-hidden">
            {t.roomCode}
          </label>
          <div className={styles.joinRow}>
            <input
              id={`${id}-code`}
              className={styles.code}
              value={text}
              onChange={(e) => setText(e.target.value.toUpperCase())}
              placeholder="ABCD"
              maxLength={6}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              enterKeyHint="go"
              aria-invalid={(tried && !code) || undefined}
            />
            <button type="submit" className="btn btn-outline btn-lg">
              {t.enterRoom}
            </button>
          </div>
          {tried && !code && (
            <p className={styles.error} role="alert">
              {t.roomInvalid}
            </p>
          )}
        </form>
      </div>
    </main>
  );
}
