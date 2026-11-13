import { useId, useState, type CSSProperties, type FormEvent } from 'react';
import { unlockAudio } from '../audio/sfx';
import { MiniSquares, Segmented } from '../components/Controls';
import { MinusIcon, PlusIcon, ShuffleIcon, XIcon } from '../components/Icons';
import { Pawn, teamInitial } from '../components/Pawn';
import { QrConnect } from '../components/QrConnect';
import { ScreenModePicker } from '../components/ScreenModePicker';
import {
  MAX_PLAYERS,
  MAX_TEAMS,
  MIN_PLAYERS,
  MIN_TEAMS,
  dealRandomly,
  gameDrafts,
  nextFreeColor,
  parsePlayers,
  shuffleError,
  teamIdAt,
  validateSetup,
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
 * The table's first page: how to play (and the room's QR code) on the left; the groups and
 * the two house rules on the right. The PC never names teams: they are "Grupo A", "Grupo B"…
 * until a phone names them. Fits a laptop screen without scrolling; one column on a phone.
 */
export function SetupScreen(props: SetupScreenProps) {
  const { settings, onSettings, teams, onTeams, link } = props;
  const t = useT();
  const ids = useId();
  const [errors, setErrors] = useState<SetupError[] | null>(null);
  const [shuffleMessage, setShuffleMessage] = useState<string | null>(null);
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => onSettings({ ...settings, [key]: value });

  const mode = settings.screenMode;
  const gameTeams = gameDrafts(mode, teams, link.roster, t.personLabel);
  const withoutTeam =
    mode === 'playerPhones' ? link.roster.filter((p) => !p.team || !teams.some((_, i) => teamIdAt(i) === p.team)) : [];

  const currentErrors = errors ? validateSetup(gameTeams) : [];
  const teamErrors = (i: number) => currentErrors.filter((e) => 'team' in e && e.team === i);

  const updateTeam = (i: number, patch: Partial<TeamDraft>) =>
    onTeams(teams.map((team, k) => (k === i ? { ...team, ...patch } : team)));

  const setGroupCount = (count: number) => {
    const n = Math.min(MAX_TEAMS, Math.max(MIN_TEAMS, count));
    if (n < teams.length) onTeams(teams.slice(0, n));
    else if (n > teams.length) {
      const next = [...teams];
      while (next.length < n) next.push({ name: '', color: nextFreeColor(next.map((x) => x.color)), players: '' });
      onTeams(next);
    }
  };

  const cycleColor = (i: number) => {
    const used = teams.filter((_, k) => k !== i).map((x) => x.color);
    updateTeam(i, { color: nextFreeColor(used, teams[i].color) });
  };

  /** PC + one phone: "− 3 pessoas +" (the people are just numbered). */
  const setPeople = (i: number, count: number) => {
    const current = parsePlayers(gameTeams[i].players);
    const n = Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, count));
    if (n < current.length) {
      updateTeam(i, { players: current.slice(0, n).join(', ') });
      return;
    }
    const next = [...current];
    for (let k = next.length + 1; next.length < n; k++) {
      const label = t.personLabel(k);
      if (!next.includes(label)) next.push(label);
    }
    updateTeam(i, { players: next.join(', ') });
  };

  /** One phone per person: mixes everyone who joined into the groups. Members then name their team. */
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
    // New groups: the names chosen before no longer fit.
    onTeams(teams.map((team) => ({ ...team, name: '' })));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    unlockAudio();
    const found = validateSetup(gameTeams);
    setErrors(found);
    if (found.length === 0) props.onStart();
  };

  const errorText = (e: SetupError) => {
    if (e.kind === 'teamPlayers' && mode === 'playerPhones') return t.needPhonesPerTeam;
    if (e.kind === 'teamPlayers' && mode === 'teamPhones') return t.needPlayersOnGroupPhone;
    return t.errors[e.kind];
  };
  const generalErrors = currentErrors.filter((e) => !('team' in e));
  const groupsHelp = { phone: t.phoneModeGroupsHelp, teamPhones: t.teamPhonesGroupsHelp, playerPhones: t.playerPhonesGroupsHelp }[mode];

  return (
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
          <ScreenModePicker value={mode} onChange={(m) => set('screenMode', m)} />
          <QrConnect url={props.phoneUrl} connected={link.connected} server={link.serverStatus} mode={mode} room={link.room} />
        </section>

        <div className={styles.side}>
          <section className={`panel ${styles.teamsPanel}`} aria-labelledby={`${ids}-teams`}>
            <div className={styles.panelHeader}>
              <h2 id={`${ids}-teams`} className={styles.panelTitle}>
                {t.groupsTitle}
              </h2>
              <div className={styles.headerTools}>
                <div className={styles.stepper} role="group" aria-label={t.groupCount}>
                  <button type="button" onClick={() => setGroupCount(teams.length - 1)} disabled={teams.length <= MIN_TEAMS} aria-label={t.fewerGroups}>
                    <MinusIcon size={18} />
                  </button>
                  <output aria-live="polite">{teams.length}</output>
                  <button type="button" onClick={() => setGroupCount(teams.length + 1)} disabled={teams.length >= MAX_TEAMS} aria-label={t.moreGroups}>
                    <PlusIcon size={18} />
                  </button>
                </div>
                {mode === 'playerPhones' && (
                  <button type="button" className={styles.shuffleButton} onClick={shufflePlayers}>
                    <ShuffleIcon size={18} /> {t.shuffleTeams}
                  </button>
                )}
              </div>
            </div>
            <p className={styles.groupsHelp}>{groupsHelp}</p>
            {shuffleMessage && mode === 'playerPhones' && (
              <p className={styles.shuffleMessage} role="alert">
                {shuffleMessage}
              </p>
            )}
            <ul className={styles.teamList}>
              {teams.map((team, i) => {
                const errs = teamErrors(i);
                const errId = `${ids}-err-${i}`;
                const group = t.groupLabel(i);
                const name = team.name.trim() || group;
                const people = parsePlayers(gameTeams[i].players);
                return (
                  <li key={i} className={`${styles.teamRow} ${errs.length ? styles.rowError : ''}`} aria-describedby={errs.length ? errId : undefined}>
                    <button
                      type="button"
                      className={styles.pawnButton}
                      onClick={() => cycleColor(i)}
                      aria-label={t.changeColor(name)}
                      style={{ '--pawn': `var(--pawn-${team.color})` } as CSSProperties}
                    >
                      <Pawn color={team.color} label={teamInitial(name)} size={38} />
                    </button>
                    <div className={styles.groupInfo}>
                      <strong className={styles.groupName}>{name}</strong>
                      {team.name.trim() && <span className={styles.groupTag}>{group}</span>}
                    </div>

                    {mode === 'phone' && (
                      <div className={styles.stepper} role="group" aria-label={`${name}: ${t.peopleCount(people.length)}`}>
                        <button
                          type="button"
                          onClick={() => setPeople(i, people.length - 1)}
                          disabled={people.length <= MIN_PLAYERS}
                          aria-label={t.fewerPeople(name)}
                        >
                          <MinusIcon size={18} />
                        </button>
                        <output aria-live="polite">{t.peopleCount(people.length)}</output>
                        <button
                          type="button"
                          onClick={() => setPeople(i, people.length + 1)}
                          disabled={people.length >= MAX_PLAYERS}
                          aria-label={t.morePeople(name)}
                        >
                          <PlusIcon size={18} />
                        </button>
                      </div>
                    )}

                    {mode === 'teamPhones' && (
                      <div className={styles.groupPeople}>
                        {people.length > 0 ? (
                          <ul className={styles.chips} aria-label={name}>
                            {people.map((p) => (
                              <li key={p} className={styles.chip}>
                                <span>{p}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className={styles.chipsEmpty}>
                            {link.teamsWithPhone.includes(teamIdAt(i)) ? t.teamPhoneOn : t.waitingGroupPhone}
                          </p>
                        )}
                      </div>
                    )}

                    {mode === 'playerPhones' && (
                      <div className={styles.groupPeople}>
                        <ul className={styles.chips} aria-label={name}>
                          {link.roster
                            .filter((p) => p.team === teamIdAt(i))
                            .map((p) => (
                              <li key={p.key} className={`${styles.chip} ${styles.chipRemovable} ${p.online ? '' : styles.chipOffline}`}>
                                <span>{p.online ? p.name : t.playerOffline(p.name)}</span>
                                <button type="button" onClick={() => link.removePlayer(p.key)} aria-label={t.removePlayer(p.name)}>
                                  <XIcon size={14} />
                                </button>
                              </li>
                            ))}
                          {!link.roster.some((p) => p.team === teamIdAt(i)) && <li className={styles.chipsEmpty}>{t.noPlayersYet}</li>}
                        </ul>
                      </div>
                    )}

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
          </section>

          <section className={`panel ${styles.rulesPanel}`} aria-label={t.houseRules}>
            <Segmented
              id={`${ids}-time`}
              label={t.timePerTurn}
              value={settings.turnSeconds}
              onChange={(v) => set('turnSeconds', v)}
              options={[30, 45, 60].map((s) => ({ value: s as 30 | 45 | 60, label: `${s} s` }))}
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
  );
}
