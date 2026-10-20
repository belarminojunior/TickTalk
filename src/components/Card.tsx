import type { ReactNode } from 'react';
import type { Side } from '../game/types';
import { useReducedMotion } from '../hooks/useReducedMotion';
import styles from './Card.module.css';

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

/** Costas da carta: padrão bicolor com o nome do jogo. */
export function CardBack({ label, children }: { label: string; children?: ReactNode }) {
  return (
    <section className={`${styles.card} ${styles.back}`} aria-label={label}>
      <div className={styles.backPattern} aria-hidden="true">
        <span className={styles.backLogo}>TICK<br />TALK</span>
      </div>
      {children && <div className={styles.backContent}>{children}</div>}
    </section>
  );
}

/** Vira a carta em 3D (600 ms). Sem animação com movimento reduzido. */
export function FlipCard({ flipped, back, front }: { flipped: boolean; back: ReactNode; front: ReactNode }) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={styles.flipStatic}>{flipped ? front : back}</div>;
  return (
    <div className={`${styles.flip} ${flipped ? styles.flipped : ''}`}>
      <div className={styles.flipInner}>
        <div className={styles.flipBack} aria-hidden={flipped || undefined}>
          {back}
        </div>
        <div className={styles.flipFront} aria-hidden={!flipped || undefined}>
          {front}
        </div>
      </div>
    </div>
  );
}
