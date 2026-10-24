import { useEffect } from 'react';
import { play } from '../audio/sfx';
import { rankings } from '../game/selectors';
import type { Team } from '../game/types';
import { FINISH } from '../game/types';
import { useT } from '../i18n';
import { Confetti } from './Confetti';
import { Pawn, teamInitial } from './Pawn';
import styles from './WinScreen.module.css';

export function WinScreen({
  teams,
  winnerId,
  onPlayAgain,
  onNewSetup,
}: {
  teams: Team[];
  winnerId: string | null;
  onPlayAgain: () => void;
  onNewSetup: () => void;
}) {
  const t = useT();
  const winner = teams.find((x) => x.id === winnerId) ?? null;
  const ranked = rankings(teams, winnerId);
  useEffect(() => play('win'), []);
  return (
    <div className={styles.overlay}>
      <Confetti />
      <div className={styles.content} role="dialog" aria-modal="true" aria-labelledby="win-title">
        {winner && <Pawn color={winner.color} label={teamInitial(winner.name)} size={96} />}
        <h1 id="win-title" className={styles.title}>
          {winner ? t.victory(winner.name) : t.gameOver}
        </h1>
        <p className={styles.sub}>{t.victorySub}</p>
        <section className={`panel ${styles.ranking}`}>
          <h2 className="eyebrow">{t.ranking}</h2>
          <ol>
            {ranked.map((team, i) => (
              <li key={team.id} className={team.id === winnerId ? styles.first : ''}>
                <span className={styles.place}>{i + 1}</span>
                <Pawn color={team.color} label={teamInitial(team.name)} size={32} />
                <span className={styles.name}>{team.name}</span>
                <span className={styles.pos}>
                  <b>{team.position}</b>/{FINISH}
                </span>
              </li>
            ))}
          </ol>
        </section>
        <div className={styles.actions}>
          <button type="button" className="btn btn-outline btn-lg" onClick={onNewSetup}>
            {t.newSetup}
          </button>
          <button type="button" className="btn btn-primary btn-lg" onClick={onPlayAgain} autoFocus>
            {t.playAgain}
          </button>
        </div>
      </div>
    </div>
  );
}
