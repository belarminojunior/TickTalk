import { useId, useState, type CSSProperties, type FormEvent } from 'react';
import { unlockAudio } from '../audio/sfx';
import { MiniSquares, Segmented } from '../components/Controls';
import { PlusIcon, ShuffleIcon, XIcon } from '../components/Icons';
import { Pawn, teamInitial } from '../components/Pawn';
import { QrConnect } from '../components/QrConnect';
import { ScreenModePicker } from '../components/ScreenModePicker';
import { ShuffleTeamsModal } from '../components/ShuffleTeamsModal';
import {
  MAX_TEAMS,
  dealRandomly,
  nextFreeColor,
  shuffleError,
  teamIdAt,
  validateSetup,
  withRoster,
  type SetupError,
  type TeamDraft,
} from '../game/setup';
import type { Settings } from '../game/types';
import type { HostLink } from '../hooks/useTransport';
import { useT } from '../i18n';
import styles from './SetupScreen.module.css';

export interface SetupScreenProps {
  settings: Settings;
  onSettings: (settings: Settings) => void;
  teams: TeamDraft[];
  onTeams: (teams: TeamDraft[]) => void;
  link: HostLink;
  phoneUrl: string | null;
  hasSaved: boolean;
  onContinue: () => void;
  onStart: () => void;
}

/**
 * The first page: how to play (and the QR code for the phones) on the left, teams and
 * the two house rules on the right. Designed to fit a laptop screen without scrolling.
 */
export function SetupScreen(props: SetupScreenProps) {
  const { settings, onSettings, teams, onTeams, link } = props;
  const t = useT();
  const ids = useId();
  const [errors, setErrors] = useState<SetupError[] | null>(null);
  const [shuffling, setShuffling] = useState(false);
  const [shuffleMessage, setShuffleMessage] = useState<string | null>(null);
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => onSettings({ ...settings, [key]: value });

  // One phone per person: the players are whoever joined each team from their phone.
  const playerMode = settings.screenMode === 'playerPhones';
  const gameTeams = playerMode ? withRoster(teams, link.roster) : teams;
  const withoutTeam = playerMode ? link.roster.filter((p) => !p.team || !teams.some((_, i) => teamIdAt(i) === p.team)) : [];

  const currentErrors = errors ? validateSetup(gameTeams) : [];
  const teamErrors = (i: number) => currentErrors.filter((e) => 'team' in e && e.team === i);

  const updateTeam = (i: number, patch: Partial<TeamDraft>) =>
    onTeams(teams.map((team, k) => (k === i ? { ...team, ...patch } : team)));

  const addTeam = () => {
    if (teams.length >= MAX_TEAMS) return;
    const color = nextFreeColor(teams.map((x) => x.color));
    onTeams([...teams, { name: '', color, players: '' }]);
  };

  const cycleColor = (i: number) => {
    const used = teams.filter((_, k) => k !== i).map((x) => x.color);
    updateTeam(i, { color: nextFreeColor(used, teams[i].color) });
  };

  const removeTeam = (i: number) => {
    onTeams(teams.filter((_, k) => k !== i));
    if (playerMode) link.removeTeamAt(i);
  };

  /** Mixes everyone who joined from a phone into the current teams. */
  const shufflePlayers = () => {
    const error = shuffleError(
      link.roster.map((p) => p.name),
      teams.length,
    );
    if (error) {
      setShuffleMessage(error.kind === 'tooFewPlayers' ? t.shuffleErrors.tooFewPlayers(error.needed) : t.shuffleErrors.repeatedName(error.name));
      return;
    }
    setShuffleMessage(null);
    const dealt = dealRandomly(
      link.roster.map((p) => p.key),
      teams.length,
    );
    link.assignPlayers(Object.fromEntries(dealt.map((keys, i) => [teamIdAt(i), keys])));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    unlockAudio();
    const found = validateSetup(gameTeams);
    setErrors(found);
    if (found.length === 0) props.onStart();
  };

  const errorText = (e: SetupError) => (playerMode && e.kind === 'teamPlayers' ? t.needPhonesPerTeam : t.errors[e.kind]);
  const generalErrors = currentErrors.filter((e) => !('team' in e));

  return (
    <>
      <form className={styles.screen} onSubmit={submit} noValidate>
        <header className={styles.hero}>
          <div className={styles.heroText}>
            <h1 className={styles.title}>Tick Talk</h1>
            <p className={styles.tagline}>{t.tagline}</p>
          </div>
          <div className={styles.heroRight}>
            <div className={styles.uiLang} role="radiogroup" aria-label={t.interfaceLanguage}>
              {(['pt', 'en'] as const).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  role="radio"
                  aria-checked={settings.uiLanguage === lang}
                  className={settings.uiLanguage === lang ? styles.langOn : ''}
                  onClick={() => set('uiLanguage', lang)}
                >
                  {lang.toUpperCase()}
                </button>
              ))}
            </div>
            <MiniSquares />
          </div>
        </header>

        <div className={styles.body}>
          <section className={`panel ${styles.modePanel}`} aria-labelledby={`${ids}-mode`}>
            <h2 id={`${ids}-mode`} className={styles.panelTitle}>
              {t.howToPlay}
            </h2>
            <ScreenModePicker value={settings.screenMode} onChange={(m) => set('screenMode', m)} />
            <QrConnect
              url={props.phoneUrl}
              connected={link.connected}
              server={link.serverStatus}
              mode={settings.screenMode}
            />
          </section>

          <div className={styles.side}>
            <section className={`panel ${styles.teamsPanel}`} aria-labelledby={`${ids}-teams`}>
              <div className={styles.panelHeader}>
                <h2 id={`${ids}-teams`} className={styles.panelTitle}>
                  {t.teams}
                </h2>
                <button type="button" className={styles.shuffleButton} onClick={playerMode ? shufflePlayers : () => setShuffling(true)}>
                  <ShuffleIcon size={18} /> {t.shuffleTeams}
                </button>
              </div>
              {shuffleMessage && playerMode && (
                <p className={styles.shuffleMessage} role="alert">
                  {shuffleMessage}
                </p>
              )}
              <ul className={styles.teamList}>
                {teams.map((team, i) => {
                  const errs = teamErrors(i);
                  const nameId = `${ids}-name-${i}`;
                  const playersId = `${ids}-players-${i}`;
                  const errId = `${ids}-err-${i}`;
                  const label = team.name || t.teamPlaceholder(i + 1);
                  // Column labels only show above the first row; the others keep them for screen readers.
                  const labelClass = i === 0 ? '' : 'visually-hidden';
                  return (
                    <li key={i} className={`${styles.teamRow} ${errs.length ? styles.rowError : ''}`}>
                      <button
                        type="button"
                        className={styles.pawnButton}
                        onClick={() => cycleColor(i)}
                        aria-label={t.changeColor(label)}
                        style={
                          {
                            '--pawn': `var(--pawn-${team.color})`,
                          } as CSSProperties
                        }
                      >
                        <Pawn color={team.color} label={teamInitial(label)} size={38} />
                      </button>
                      <div className={styles.fieldName}>
                        <label htmlFor={nameId} className={labelClass}>
                          {t.teamName}
                        </label>
                        <input
                          id={nameId}
                          value={team.name}
                          placeholder={t.teamPlaceholder(i + 1)}
                          onChange={(e) => updateTeam(i, { name: e.target.value })}
                          aria-invalid={errs.some((e) => e.kind === 'teamName') || undefined}
                          aria-describedby={errs.length ? errId : undefined}
                          maxLength={32}
                          autoComplete="off"
                        />
                      </div>
                      {playerMode ? (
                        <div className={styles.fieldPlayers}>
                          <span id={playersId} className={labelClass}>
                            {t.playersFromPhones}
                          </span>
                          <ul className={styles.chips} aria-labelledby={playersId} aria-describedby={errs.length ? errId : undefined}>
                            {link.roster
                              .filter((p) => p.team === teamIdAt(i))
                              .map((p) => (
                                <li key={p.key} className={`${styles.chip} ${p.online ? '' : styles.chipOffline}`}>
                                  <span>{p.online ? p.name : t.playerOffline(p.name)}</span>
                                  <button type="button" onClick={() => link.removePlayer(p.key)} aria-label={t.removePlayer(p.name)}>
                                    <XIcon size={14} />
                                  </button>
                                </li>
                              ))}
                            {!link.roster.some((p) => p.team === teamIdAt(i)) && <li className={styles.chipsEmpty}>{t.noPlayersYet}</li>}
                          </ul>
                        </div>
                      ) : (
                        <div className={styles.fieldPlayers}>
                          <label htmlFor={playersId} className={labelClass}>
                            {t.players}
                          </label>
                          <input
                            id={playersId}
                            value={team.players}
                            placeholder={t.playersPlaceholder}
                            onChange={(e) => updateTeam(i, { players: e.target.value })}
                            aria-invalid={errs.some((e) => e.kind !== 'teamName') || undefined}
                            aria-describedby={errs.length ? errId : undefined}
                            autoComplete="off"
                          />
                        </div>
                      )}
                      <button
                        type="button"
                        className={styles.removeButton}
                        onClick={() => removeTeam(i)}
                        disabled={teams.length <= 2}
                        aria-label={t.removeTeam(label)}
                      >
                        <XIcon size={20} />
                      </button>
                      {errs.length > 0 && (
                        <p id={errId} className={styles.rowErrorText} role="alert">
                          {errs.map(errorText).join(' ')}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
              {withoutTeam.length > 0 && <p className={styles.withoutTeam}>{t.withoutTeam(withoutTeam.map((p) => p.name))}</p>}
              <button type="button" className={styles.addButton} onClick={addTeam} disabled={teams.length >= MAX_TEAMS}>
                <PlusIcon size={18} /> {t.addTeam}
              </button>
            </section>

            <section className={`panel ${styles.rulesPanel}`} aria-label={t.houseRules}>
              <Segmented
                id={`${ids}-time`}
                label={t.timePerTurn}
                value={settings.turnSeconds}
                onChange={(v) => set('turnSeconds', v)}
                options={[30, 45, 60].map((s) => ({
                  value: s as 30 | 45 | 60,
                  label: `${s} s`,
                }))}
              />
              <Segmented
                id={`${ids}-lang`}
                label={t.cardLanguage}
                value={settings.language}
                onChange={(v) => set('language', v)}
                options={[
                  { value: 'pt', label: 'Português' },
                  { value: 'en', label: 'English' },
                ]}
              />
            </section>

            <footer className={styles.footer}>
              <div className={styles.messages}>
                {generalErrors.map((e) => (
                  <p key={e.kind} className={styles.error} role="alert">
                    {errorText(e)}
                  </p>
                ))}
                {link.connected === 0 && <p className={styles.warning}>{t.noPhoneWarning}</p>}
              </div>
              <div className={styles.footerButtons}>
                {props.hasSaved && (
                  <button type="button" className="btn btn-outline btn-lg" onClick={props.onContinue}>
                    {t.continueSaved}
                  </button>
                )}
                <button type="submit" className="btn btn-primary btn-lg">
                  {t.startGame}
                </button>
              </div>
            </footer>
          </div>
        </div>
      </form>
      {shuffling && <ShuffleTeamsModal teams={teams} onApply={onTeams} onClose={() => setShuffling(false)} />}
    </>
  );
}
