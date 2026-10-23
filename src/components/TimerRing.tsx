import styles from './TimerRing.module.css';

export interface TimerRingProps {
  remainingMs: number;
  durationMs: number;
  size: number;
  /** Small text under the number (e.g. "seconds"). */
  caption?: string;
  running?: boolean;
  label?: string;
}

/** Timer ring: seconds in the centre, pulsing in the last 5 s. */
export function TimerRing({ remainingMs, durationMs, size, caption, running = true, label }: TimerRingProps) {
  const seconds = Math.ceil(remainingMs / 1000);
  const fraction = durationMs > 0 ? Math.max(0, Math.min(1, remainingMs / durationMs)) : 0;
  const stroke = Math.max(5, size * 0.075);
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const urgent = running && seconds <= 5 && remainingMs > 0;
  return (
    <div
      className={`${styles.ring} ${urgent ? styles.urgent : ''}`}
      style={{ width: size, height: size }}
      role="timer"
      aria-live="off"
      aria-label={label}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} className={styles.track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          className={styles.progress}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className={styles.center}>
        <span key={urgent ? seconds : 'n'} className={styles.seconds} style={{ fontSize: size * (caption ? 0.34 : 0.42) }}>
          {seconds}
        </span>
        {caption && <span className={styles.caption} style={{ fontSize: Math.max(12, size * 0.1) }}>{caption}</span>}
      </div>
    </div>
  );
}
