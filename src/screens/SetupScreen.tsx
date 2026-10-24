import { useId, useState, type CSSProperties, type FormEvent } from 'react';
import { unlockAudio } from '../audio/sfx';
import { Checkbox, MiniSquares, Segmented } from '../components/Controls';
import { ExternalIcon, PlusIcon, XIcon } from '../components/Icons';
import { Pawn, teamInitial } from '../components/Pawn';
import { QrConnect } from '../components/QrConnect';
import { ScreenModePicker } from '../components/ScreenModePicker';
import { MAX_TEAMS, nextFreeColor, validateSetup, type SetupError, type TeamDraft } from '../game/setup';
import { PACK_IDS, type PackId, type Settings } from '../game/types';
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
  /** Cards available for the chosen language and packs. */
  cardCount: number;
  hasSaved: boolean;
  onContinue: () => void;
  onStart: () => void;
  onOpenDescriberWindow: () => void;
}

export function SetupScreen(props: SetupScreenProps) {
  const { settings, onSettings, teams, onTeams, link, cardCount } = props;
  const t = useT();
  const ids = useId();
  const [errors, setErrors] = useState<SetupError[] | null>(null);
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => onSettings({ ...settings, [key]: value });

  const currentErrors = errors ? validateSetup(teams, settings.packs, cardCount) : [];
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

  const togglePack = (pack: PackId, on: boolean) =>
    set('packs', on ? PACK_IDS.filter((p) => p === pack || settings.packs.includes(p)) : settings.packs.filter((p) => p !== pack));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    unlockAudio();
    const found = validateSetup(teams, settings.packs, cardCount);
    setErrors(found);
    if (found.length === 0) props.onStart();
  };

  const errorText = (e: SetupError) => t.errors[e.kind];
  const generalErrors = currentErrors.filter((e) => !('team' in e));
  const noDescriber = settings.screenMode !== 'single' && link.connected === 0;

  return (
    <form className={styles.screen} onSubmit={submit} noValidate>
      <header className={styles.hero}>
        <div>
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

      <section className={`panel ${styles.modePanel}`} aria-labelledby={`${ids}-mode`}>
        <h2 id={`${ids}-mode`} className={styles.panelTitle}>
          {t.howToPlay}
        </h2>
        <ScreenModePicker value={settings.screenMode} onChange={(m) => set('screenMode', m)} />
        {(settings.screenMode === 'phone' || settings.screenMode === 'teamPhones') && (
          <QrConnect
            url={props.phoneUrl}
            connected={link.connected}
            server={link.serverStatus}
            teamPhones={settings.screenMode === 'teamPhones'}
          />
        )}
        {settings.screenMode === 'windows' && (
          <div className={styles.windowBox}>
            <div>
              <h3 className={styles.boxTitle}>{t.openWindowTitle}</h3>
              <p className={styles.muted}>{t.openWindowHelp}</p>
              <p className={styles.status} data-tone={link.connected > 0 ? 'ok' : 'off'} role="status">
                <span className={styles.dot} aria-hidden="true" />
                {t.windowsConnected(link.connected)}
              </p>
            </div>
            <button type="button" className="btn btn-outline" onClick={props.onOpenDescriberWindow}>
              <ExternalIcon size={18} /> {t.openWindow}
            </button>
          </div>
        )}
        {settings.screenMode === 'single' && <p className={styles.singleNote}>{t.singleNote}</p>}
      </section>

      <div className={styles.columns}>
        <section className={`panel ${styles.teamsPanel}`} aria-labelledby={`${ids}-teams`}>
          <h2 id={`${ids}-teams`} className={styles.panelTitle}>
            {t.teams}
          </h2>
          <ul className={styles.teamList}>
            {teams.map((team, i) => {
              const errs = teamErrors(i);
              const nameId = `${ids}-name-${i}`;
              const playersId = `${ids}-players-${i}`;
              const errId = `${ids}-err-${i}`;
              const label = team.name || t.teamPlaceholder(i + 1);
              return (
                <li key={i} className={`${styles.teamRow} ${errs.length ? styles.rowError : ''}`}>
                  <button
                    type="button"
                    className={styles.pawnButton}
                    onClick={() => cycleColor(i)}
                    aria-label={t.changeColor(label)}
                    style={{ '--pawn': `var(--pawn-${team.color})` } as CSSProperties}
                  >
                    <Pawn color={team.color} label={teamInitial(label)} size={40} />
                  </button>
                  <div className={styles.fieldName}>
                    <label htmlFor={nameId}>{t.teamName}</label>
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
                  <div className={styles.fieldPlayers}>
                    <label htmlFor={playersId}>{t.players}</label>
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
                  <button
                    type="button"
                    className={styles.removeButton}
                    onClick={() => onTeams(teams.filter((_, k) => k !== i))}
                    disabled={teams.length <= 2}
                    aria-label={t.removeTeam(label)}
                  >
                    <XIcon size={22} />
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
          <button type="button" className={styles.addButton} onClick={addTeam} disabled={teams.length >= MAX_TEAMS}>
            <PlusIcon size={20} /> {t.addTeam}
          </button>
        </section>

        <section className={`panel ${styles.rulesPanel}`} aria-labelledby={`${ids}-rules`}>
          <h2 id={`${ids}-rules`} className={styles.panelTitle}>
            {t.houseRules}
          </h2>
          <Segmented
            id={`${ids}-time`}
            label={t.timePerTurn}
            value={settings.turnSeconds}
            onChange={(v) => set('turnSeconds', v)}
            options={[30, 45, 60].map((s) => ({ value: s as 30 | 45 | 60, label: `${s} s` }))}
          />
          <Segmented
            id={`${ids}-validation`}
            label={t.whoValidates}
            value={settings.validation}
            onChange={(v) => set('validation', v)}
            options={[
              { value: 'nextTeam', label: t.nextTeam },
              { value: 'none', label: t.noValidation },
            ]}
          />
          <div>
            <Segmented
              id={`${ids}-die`}
              label={t.dieSetting}
              value={settings.scoring}
              onChange={(v) => set('scoring', v)}
              options={[
                { value: 'die', label: t.withDie },
                { value: 'noDie', label: t.withoutDie },
              ]}
            />
            <p className={styles.help}>{settings.scoring === 'die' ? t.dieHelp : t.noDieHelp}</p>
          </div>
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
          <fieldset className={styles.packs}>
            <legend>{t.packs}</legend>
            {PACK_IDS.map((pack) => (
              <Checkbox
                key={pack}
                label={t.packName[pack]}
                checked={settings.packs.includes(pack)}
                onChange={(on) => togglePack(pack, on)}
              />
            ))}
            <p className={styles.help}>{t.cardsInDeck(cardCount)}</p>
          </fieldset>
        </section>
      </div>

      <footer className={styles.footer}>
        <div className={styles.messages}>
          {generalErrors.map((e) => (
            <p key={e.kind} className={styles.error} role="alert">
              {errorText(e)}
            </p>
          ))}
          {noDescriber && (
            <p className={styles.warning}>{settings.screenMode === 'windows' ? t.noWindowWarning : t.noPhoneWarning}</p>
          )}
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
    </form>
  );
}
