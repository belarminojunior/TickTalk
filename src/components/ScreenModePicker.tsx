import type { ScreenMode } from '../game/types';
import { useT } from '../i18n';
import { DevicesIcon, PlayerPhonesIcon, TeamPhonesIcon } from './Icons';
import styles from './ScreenModePicker.module.css';

const MODES: ScreenMode[] = ['phone', 'teamPhones', 'playerPhones'];
const ICONS = { phone: DevicesIcon, teamPhones: TeamPhonesIcon, playerPhones: PlayerPhonesIcon };

/** The three ways to play: PC + the describer's phone / one phone per team / one phone per person. */
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
            <Icon size={32} className={styles.icon} />
            <span className={styles.title}>{t.modeTitle[mode]}</span>
            <span className={styles.desc}>{t.modeDesc[mode]}</span>
          </button>
        );
      })}
    </div>
  );
}
