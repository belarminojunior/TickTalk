import { useEffect, useState } from 'react';
import { DIE_FACES } from '../game/dice';
import styles from './Dice.module.css';

export interface BigDieProps {
  value: number | null;
  /** Rolling: changes face and shakes. */
  rolling?: boolean;
  size?: number;
  className?: string;
  label?: string;
}

/** Big die (white cube, slightly rotated). */
export function BigDie({ value, rolling = false, size = 132, className, label }: BigDieProps) {
  const [face, setFace] = useState(value ?? 0);
  useEffect(() => {
    if (!rolling) {
      setFace(value ?? 0);
      return;
    }
    let i = 0;
    const id = setInterval(() => {
      i = (i + 1 + Math.floor(Math.random() * 3)) % DIE_FACES.length;
      setFace(DIE_FACES[i]);
    }, 90);
    return () => clearInterval(id);
  }, [rolling, value]);

  return (
    <div
      className={`${styles.bigDie} ${rolling ? styles.rolling : ''} ${className ?? ''}`}
      style={{ ['--die-size' as string]: `${size}px` }}
      role="img"
      aria-label={label ?? String(value ?? '')}
    >
      <span>{rolling ? face : value ?? ''}</span>
    </div>
  );
}
