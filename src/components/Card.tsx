import type { ReactNode } from 'react';
import type { Side } from '../game/types';
import { WORDS_PER_CARD } from '../game/types';
import { useReducedMotion } from '../hooks/useReducedMotion';
import styles from './Card.module.css';

/** One face of a card, in the colour of its side. */
export function CardFace({
  side,
  header,
  children,
  className,
}: {
  side: Side;
  header: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`${styles.card} ${styles[side]} ${className ?? ''}`} data-side={side}>
      <header className={styles.header}>
        <span className={styles.brand}>Tick Talk</span>
        <span className={styles.meta}>{header}</span>
      </header>
      <div className={styles.words}>{children}</div>
    </section>
  );
}

/** Five face-down word slots: the card is showing, but its words are not readable yet. */
export function HiddenWords({ children }: { children?: ReactNode }) {
  return (
    <div className={styles.hiddenWrap}>
      <ol className={styles.hiddenList} aria-hidden="true">
        {Array.from({ length: WORDS_PER_CARD }, (_, i) => (
          <li key={i} className={styles.hiddenWord}>
            <span className={styles.badge}>{i + 1}</span>
            <span className={styles.hiddenBar} />
          </li>
        ))}
      </ol>
      {children && <div className={styles.overlay}>{children}</div>}
    </div>
  );
}

/**
 * A real two-sided card: blue on one face, yellow on the other.
 * Changing `up` turns the card over in 3D (600 ms); with reduced motion it just swaps.
 */
export function TwoSidedCard({
  up,
  blue,
  yellow,
  size = 'large',
}: {
  up: Side;
  blue: ReactNode;
  yellow: ReactNode;
  size?: 'large' | 'mini';
}) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={styles.flipStatic}>{up === 'blue' ? blue : yellow}</div>;
  return (
    <div className={`${styles.flip} ${size === 'mini' ? styles.flipMini : ''}`} data-up={up}>
      <div className={`${styles.flipInner} ${up === 'yellow' ? styles.flipped : ''}`}>
        <div className={styles.faceBlue} aria-hidden={up !== 'blue' || undefined}>
          {blue}
        </div>
        <div className={styles.faceYellow} aria-hidden={up !== 'yellow' || undefined}>
          {yellow}
        </div>
      </div>
    </div>
  );
}

/** Small card used on the table to show which side the team reads next. */
export function MiniCard({ side }: { side: Side }) {
  return (
    <span className={`${styles.mini} ${styles[side]}`}>
      <span className={styles.miniBrand}>TT</span>
      <span className={styles.miniLines} />
    </span>
  );
}
