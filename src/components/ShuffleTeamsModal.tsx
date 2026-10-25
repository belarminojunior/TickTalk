import { useEffect, useId, useRef, useState } from 'react';
import { MAX_TEAMS, MIN_TEAMS, parsePlayers, randomTeams, shuffleError, type TeamDraft } from '../game/setup';
import { useT } from '../i18n';
import { Modal, Segmented } from './Controls';
import { ShuffleIcon } from './Icons';
import styles from './ShuffleTeamsModal.module.css';

const TEAM_COUNTS = Array.from({ length: MAX_TEAMS - MIN_TEAMS + 1 }, (_, i) => MIN_TEAMS + i);

/**
 * "Random teams": everyone's names in one box, how many teams, and the game deals the
 * names out at random. Starts with the players already written in the team rows.
 */
export function ShuffleTeamsModal({
  teams,
  onApply,
  onClose,
}: {
  teams: TeamDraft[];
  onApply: (teams: TeamDraft[]) => void;
  onClose: () => void;
}) {
  const t = useT();
  const ids = useId();
  const [text, setText] = useState(() => teams.flatMap((team) => parsePlayers(team.players)).join(', '));
  const [teamCount, setTeamCount] = useState(Math.min(Math.max(teams.length, MIN_TEAMS), MAX_TEAMS));
  const [tried, setTried] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);

  // Ready to type: cursor at the end of the names already there.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);

  const names = parsePlayers(text);
  const error = shuffleError(names, teamCount);
  const min = Math.floor(names.length / teamCount);
  const max = Math.ceil(names.length / teamCount);

  const shuffle = () => {
    setTried(true);
    if (error) return;
    onApply(randomTeams(names, teamCount, teams));
    onClose();
  };

  const errorText =
    error?.kind === 'tooFewPlayers'
      ? t.shuffleErrors.tooFewPlayers(error.needed)
      : error?.kind === 'repeatedName'
        ? t.shuffleErrors.repeatedName(error.name)
        : null;
  // A repeated name is shown straight away; "too few" only once they try, so it doesn't nag while typing.
  const shownError = error?.kind === 'repeatedName' || tried ? errorText : null;

  return (
    <Modal title={t.shuffleTeams} onClose={onClose}>
      <p className={styles.help}>{t.shuffleHelp}</p>
      <div className={styles.field}>
        <label htmlFor={`${ids}-names`} className={styles.label}>
          {t.everyone}
        </label>
        <textarea
          id={`${ids}-names`}
          ref={box}
          className={styles.names}
          value={text}
          placeholder={t.everyonePlaceholder}
          onChange={(e) => setText(e.target.value)}
          aria-invalid={!!shownError || undefined}
          aria-describedby={`${ids}-summary`}
          rows={4}
          autoComplete="off"
        />
        <p id={`${ids}-summary`} className={shownError ? styles.error : styles.summary} role={shownError ? 'alert' : undefined}>
          {shownError ?? (names.length > 0 ? t.shuffleSummary(names.length, min, max) : ' ')}
        </p>
      </div>
      <Segmented
        id={`${ids}-count`}
        label={t.teamCount}
        value={teamCount}
        onChange={setTeamCount}
        options={TEAM_COUNTS.map((n) => ({ value: n, label: String(n) }))}
      />
      <div className={styles.buttons}>
        <button type="button" className="btn btn-outline" onClick={onClose}>
          {t.cancel}
        </button>
        <button type="button" className="btn btn-primary" onClick={shuffle}>
          <ShuffleIcon size={20} /> {t.shuffle}
        </button>
      </div>
    </Modal>
  );
}
