import type { CSSProperties } from 'react';
import { squareColor } from '../game/board';
import { projection } from '../game/selectors';
import type { Hit, ScoringMode, Side, SideFlags, Team } from '../game/types';
import { FINISH } from '../game/types';
import { useT } from '../i18n';
import { CheckIcon } from './Icons';
import { MiniCard, TwoSidedCard } from './Card';
import { Pawn, teamInitial } from './Pawn';
import styles from './TablePanels.module.css';

export function sideVars(side: Side): CSSProperties {
  return {
    '--side': `var(--${side})`,
    '--side-paper': `var(--${side}-paper)`,
  } as CSSProperties;
}

/**
 * 10 slots, one row per side of the card. Guessed words show in the side colour with a tick,
 * the rest are dashed with "?". The row of the side that is face up is marked. Never shows words.
 */
export function ProgressSlots({ marked, up }: { marked: SideFlags; up: Side }) {
  const t = useT();
  return (
    <div className={styles.slotRows} aria-label={t.liveHits} role="group">
      {(['blue', 'yellow'] as const).map((side) => (
        <div key={side} className={`${styles.slotRow} ${side === up ? styles.slotRowUp : ''}`} style={sideVars(side)}>
          <span className={`${styles.rowTag} ${styles[side]}`} aria-hidden="true" />
          <ol className={styles.slots}>
            {marked[side].map((hit, i) => (
              <li key={i} className={`${styles.slot} ${hit ? styles.slotHit : ''}`} aria-label={t.slotLabel(side, i + 1, hit)}>
                {hit ? <CheckIcon size="42%" strokeWidth={3} /> : <span aria-hidden="true">?</span>}
              </li>
            ))}
          </ol>
        </div>
      ))}
      <p className={styles.faceUp} aria-live="polite">
        {t.faceUp(up)}
      </p>
    </div>
  );
}

/** Live feed: "+1 Word 4 guessed · at 12 s" (newest first). */
export function LiveFeed({ hits }: { hits: Hit[] }) {
  const t = useT();
  const list = [...hits].reverse();
  return (
    <section className={`panel ${styles.feedPanel}`}>
      <h3 className="eyebrow">{t.liveHits}</h3>
      {list.length === 0 ? (
        <p className={styles.muted}>{t.noHitsYet}</p>
      ) : (
        <ul className={styles.feed} aria-live="polite">
          {list.map((h) => (
            <li key={`${h.side}-${h.index}-${h.atMs}`} className={styles.feedItem} style={sideVars(h.side)}>
              <span className={styles.plusOne}>+1</span>
              <span className={styles.feedText}>{t.hitLine(h.index + 1, h.side)}</span>
              <span className={styles.feedTime}>{t.atSeconds(Math.max(0, Math.round(h.atMs / 1000)))}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** "If time ran out now": die 0/1/2 → +X squares (or, with no die, +X squares). */
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

/** Team cards under the board. */
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
                <b>{position}</b>/{FINISH}
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

/**
 * "The card flips to yellow" / "The card stays blue", with a small two-sided card that
 * turns over from the old colour to the new one once the pawn has landed (`settled`).
 */
export function CardFlipNotice({ team, from, to, settled }: { team: string; from: Side; to: Side; settled: boolean }) {
  const t = useT();
  const changed = from !== to;
  return (
    <section className={`panel ${styles.flipNotice}`}>
      <div className={styles.cardStack} aria-hidden="true">
        <TwoSidedCard size="mini" up={settled ? to : from} blue={<MiniCard side="blue" />} yellow={<MiniCard side="yellow" />} />
      </div>
      <div>
        <h3 className={styles.flipTitle}>{changed ? t.cardFlips(to) : t.cardStays(to)}</h3>
        <p className={styles.muted}>{changed ? t.cardFlipsHelp(team, to) : t.cardStaysHelp(team, to)}</p>
      </div>
    </section>
  );
}

/** "Square 13 → Square 14" with the square colours. */
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
