import { useEffect, useRef, type ReactNode } from 'react';
import { useT } from '../i18n';
import { XIcon } from './Icons';
import styles from './Controls.module.css';

export interface SegmentedOption<T extends string | number> {
  value: T;
  label: ReactNode;
}

/** Controlo segmentado: o selecionado fica amarelo com texto escuro. */
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

/** Caixa de seleção grande com visto amarelo. */
export function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={styles.checkbox}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className={styles.box} aria-hidden="true">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </span>
      <span>{label}</span>
    </label>
  );
}

/** Janela modal com foco preso, Esc para fechar. */
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
      if (e.key === 'Tab' && ref.current) {
        const focusables = ref.current.querySelectorAll<HTMLElement>('button, [href], input, [tabindex]:not([tabindex="-1"])');
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
  }, [onClose]);
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

/** Logótipo: quadrado meio amarelo, meio azul. */
export function Logo({ size = 64 }: { size?: number }) {
  return <span className={styles.logo} style={{ width: size, height: size }} aria-hidden="true" />;
}

/** Quatro mini-casas alternadas (decoração da configuração). */
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

/** Pastilha de estado com ponto (verde, vermelho a pulsar, cinzento). */
export function StatusPill({ tone, children }: { tone: 'live' | 'ok' | 'off' | 'warn'; children: ReactNode }) {
  return (
    <span className={`${styles.pill} ${styles[tone]}`} role="status">
      <span className={styles.dot} aria-hidden="true" />
      {children}
    </span>
  );
}
