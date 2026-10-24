import type { ScreenMode } from '../game/types';
import { useT } from '../i18n';
import { DevicesIcon, MonitorIcon, TeamPhonesIcon, WindowsIcon } from './Icons';
import styles from './ScreenModePicker.module.css';

const MODES: ScreenMode[] = ['phone', 'teamPhones', 'windows', 'single'];
const ICONS = { phone: DevicesIcon, teamPhones: TeamPhonesIcon, windows: WindowsIcon, single: MonitorIcon };

/** Large cards: PC + phone / One phone per team / Two windows / One screen. */
export function ScreenModePicker({ value, onChange }: { value: ScreenMode; onChange: (m: ScreenMode) => void }) {
  const t = useT();
  return (
    <div className={styles.grid} role="radiogroup" aria-label={t.howToPlay}>
      {MODES.map((mode) => {
        const Icon = ICONS[mode];
        const selected = mode === value;
        return (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={selected}
            className={`${styles.card} ${selected ? styles.selected : ''}`}
            onClick={() => onChange(mode)}
          >
            <Icon size={34} className={styles.icon} />
            <span className={styles.title}>{t.modeTitle[mode]}</span>
            <span className={styles.desc}>{t.modeDesc[mode]}</span>
          </button>
        );
      })}
    </div>
  );
}
