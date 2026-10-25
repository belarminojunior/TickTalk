import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useT } from '../i18n';
import { XIcon } from './Icons';
import styles from './Controls.module.css';

export interface SegmentedOption<T extends string | number> {
  value: T;
  label: ReactNode;
}

/** Segmented control: the selected option is yellow with dark text. */
export function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
  id,
}: {
  label: string;
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  id?: string;
}) {
  return (
    <div className={styles.field}>
      <span className={styles.label} id={id}>
        {label}
      </span>
      <div className={styles.segmented} role="radiogroup" aria-labelledby={id}>
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={o.value === value}
            className={`${styles.segment} ${o.value === value ? styles.segmentOn : ''}`}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}


/** Modal dialog with a focus trap; Esc closes it. */
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  // The parent usually passes a new onClose on every render; keep the latest without
  // re-running the effect, which would pull focus out of the field being typed in.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  // Where focus goes back on close: whatever had it when the dialog opened (read before a
  // field inside takes it).
  const [previous] = useState(() => document.activeElement as HTMLElement | null);
  useEffect(() => {
    // A field inside may already have taken focus (e.g. the names box); otherwise focus the dialog.
    if (!ref.current?.contains(document.activeElement)) ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
      }
      if (e.key === 'Tab' && ref.current) {
        const focusables = ref.current.querySelectorAll<HTMLElement>('button:not(:disabled), [href], input, textarea, [tabindex]:not([tabindex="-1"])');
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      previous?.focus?.();
    };
  }, [previous]);
  return (
    <div className={styles.backdrop} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label={title} ref={ref} tabIndex={-1}>
        <header className={styles.modalHeader}>
          <h2>{title}</h2>
          <button type="button" className={styles.iconButton} onClick={onClose} aria-label={t.close}>
            <XIcon size={22} />
          </button>
        </header>
        <div className={styles.modalBody}>{children}</div>
      </div>
    </div>
  );
}

/** Logo: a square, half yellow and half blue. */
export function Logo({ size = 64 }: { size?: number }) {
  return <span className={styles.logo} style={{ width: size, height: size }} aria-hidden="true" />;
}

/** Four alternating mini squares (setup decoration). */
export function MiniSquares() {
  return (
    <span className={styles.miniSquares} aria-hidden="true">
      <span className={styles.blueSq} />
      <span className={styles.yellowSq} />
      <span className={styles.blueSq} />
      <span className={styles.yellowSq} />
    </span>
  );
}

/** Status pill with a dot (green, pulsing red, grey). */
export function StatusPill({ tone, children }: { tone: 'live' | 'ok' | 'off' | 'warn'; children: ReactNode }) {
  return (
    <span className={`${styles.pill} ${styles[tone]}`} role="status">
      <span className={styles.dot} aria-hidden="true" />
      {children}
    </span>
  );
}
