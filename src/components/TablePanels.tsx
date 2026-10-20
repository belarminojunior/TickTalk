import type { CSSProperties } from 'react';
import { squareColor } from '../game/board';
import { projection } from '../game/selectors';
import type { Hit, ScoringMode, Side, Team } from '../game/types';
import { useT } from '../i18n';
import { CheckIcon } from './Icons';
import { Pawn, teamInitial } from './Pawn';
import styles from './TablePanels.module.css';

export function sideVars(side: Side): CSSProperties {
  return {
    '--side': `var(--${side})`,
    '--side-paper': `var(--${side}-paper)`,
  } as CSSProperties;
}

/** 5 ranhuras (3:4): acertadas na cor do lado com visto; por acertar tracejadas com "?". Nunca mostram palavras. */
export function ProgressSlots({ marked, side }: { marked: boolean[]; side: Side }) {
  const t = useT();
  return (
    <ol className={styles.slots} style={sideVars(side)} aria-label={t.liveHits}>
      {marked.map((hit, i) => (
        <li key={i} className={`${styles.slot} ${hit ? styles.slotHit : ''}`} aria-label={t.slotLabel(i + 1, hit)}>
          {hit ? <CheckIcon size="42%" strokeWidth={3} /> : <span aria-hidden="true">?</span>}
        </li>
      ))}
    </ol>
  );
}

/** Registo ao vivo: "+1 Palavra 4 acertada · aos 12 s" (o mais recente em cima). */
export function LiveFeed({ hits, side }: { hits: Hit[]; side: Side }) {
  const t = useT();
  const list = [...hits].reverse();
  return (
    <section className={`panel ${styles.feedPanel}`} style={sideVars(side)}>
      <h3 className="eyebrow">{t.liveHits}</h3>
      {list.length === 0 ? (
        <p className={styles.muted}>{t.noHitsYet}</p>
      ) : (
        <ul className={styles.feed} aria-live="polite">
          {list.map((h) => (
            <li key={`${h.index}-${h.atMs}`} className={styles.feedItem}>
              <span className={styles.plusOne}>+1</span>
              <span className={styles.feedText}>{t.hitLine(h.index + 1)}</span>
              <span className={styles.feedTime}>{t.atSeconds(Math.max(0, Math.round(h.atMs / 1000)))}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** "Se o tempo acabasse agora": dado 0/1/2 → +X casas (ou sem dado: +X casas). */
export function Projection({ marked, scoring }: { marked: number; scoring: ScoringMode }) {
  const t = useT();
  const rows = projection(marked, scoring);
  return (
    <section className={`panel ${styles.projectionPanel}`}>
      <h3 className="eyebrow">{t.ifTimeEndedNow}</h3>
      {scoring === 'noDie' ? (
        <div className={`${styles.projBox} ${styles.projWide}`}>
          <strong>{t.plusSquares(rows[0].advance)}</strong>
          <span>{t.onePerWord}</span>
        </div>
      ) : (
        <div className={styles.projGrid}>
          {rows.map((r) => (
            <div key={r.die} className={styles.projBox}>
              <span>{t.dieN(r.die ?? 0)}</span>
              <strong>{t.plusSquares(r.advance)}</strong>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/** Cartões das equipas por baixo do tabuleiro. */
export function TeamCards({ teams, activeIndex, positions }: { teams: Team[]; activeIndex: number | null; positions?: number[] }) {
  const t = useT();
  return (
    <ul className={styles.teamCards}>
      {teams.map((team, i) => {
        const position = positions?.[i] ?? team.position;
        const side = squareColor(position);
        const active = i === activeIndex;
        return (
          <li
            key={team.id}
            className={`${styles.teamCard} ${active ? styles.teamActive : ''}`}
            style={{ '--pawn': `var(--pawn-${team.color})` } as CSSProperties}
            aria-current={active || undefined}
          >
            <div className={styles.teamTop}>
              <Pawn color={team.color} label={teamInitial(team.name)} size={30} />
              <strong className={styles.teamName}>{team.name}</strong>
              <span className={styles.teamScore}>
                <b>{position}</b>/36
              </span>
            </div>
            <div className={styles.teamLine}>
              <span className={`${styles.swatch} ${styles[side]}`} aria-hidden="true" />
              <span>
                {position === 0 ? t.startSquare : t.houseColor(side)} · {team.players.join(' · ')}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Mini-ilustração: duas cartas (a de trás e a da frente). */
export function TwoCards({ from, to }: { from: Side; to: Side }) {
  return (
    <div className={styles.twoCards} aria-hidden="true">
      <span className={`${styles.miniCard} ${styles[from]}`} />
      <span className={`${styles.miniCard} ${styles.miniFront} ${styles[to]}`} />
    </div>
  );
}

/** Aviso "A carta vira para o amarelo" / "A carta continua azul". */
export function CardFlipNotice({ team, from, to }: { team: string; from: Side; to: Side }) {
  const t = useT();
  const changed = from !== to;
  return (
    <section className={`panel ${styles.flipNotice}`}>
      <TwoCards from={from} to={to} />
      <div>
        <h3 className={styles.flipTitle}>{changed ? t.cardFlips(to) : t.cardStays(to)}</h3>
        <p className={styles.muted}>{changed ? t.cardFlipsHelp(team, to) : t.cardStaysHelp(team, to)}</p>
      </div>
    </section>
  );
}

/** "Casa 13 → Casa 14" com as cores das casas. */
export function SquareChange({ from, to }: { from: number; to: number }) {
  const t = useT();
  return (
    <div className={styles.squareChange}>
      <span className={styles.squareTag}>
        <span className={`${styles.swatchLg} ${styles[squareColor(from)]}`} aria-hidden="true" />
        {t.squareN(from)}
      </span>
      <span aria-hidden="true">→</span>
      <span className={styles.squareTag}>
        <span className={`${styles.swatchLg} ${styles[squareColor(to)]}`} aria-hidden="true" />
        {t.squareN(to)}
      </span>
    </div>
  );
}
