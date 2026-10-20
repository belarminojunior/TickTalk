import type { CSSProperties } from 'react';
import type { PawnColor } from '../game/types';
import styles from './Pawn.module.css';

export interface PawnProps {
  color: PawnColor;
  label: string;
  /** Tamanho CSS (px, cqw…). */
  size?: string | number;
  title?: string;
  className?: string;
}

export function teamInitial(name: string): string {
  const cleaned = name.replace(/^(os|as|o|a|the)\s+/i, '').trim();
  return (cleaned[0] ?? name[0] ?? '?').toUpperCase();
}

/** Peão: disco na cor da equipa, aro mais escuro, sempre com a inicial. */
export function Pawn({ color, label, size = 40, title, className }: PawnProps) {
  const style = {
    '--pawn': `var(--pawn-${color})`,
    '--pawn-rim': `var(--pawn-${color}-rim)`,
    '--pawn-fg': `var(--pawn-${color}-fg)`,
    '--size': typeof size === 'number' ? `${size}px` : size,
  } as CSSProperties;
  return (
    <span className={`${styles.pawn} ${className ?? ''}`} style={style} title={title} aria-hidden={title ? undefined : true}>
      <span className={styles.letter}>{label}</span>
    </span>
  );
}
