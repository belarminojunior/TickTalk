import { useId, useState, type CSSProperties, type FormEvent } from 'react';
import { unlockAudio } from '../audio/sfx';
import { SwapIcon } from '../components/Icons';
import { Pawn, teamInitial } from '../components/Pawn';
import type { DescriberView } from '../game/selectors';
import { useT } from '../i18n';
import { MAX_NAME_LENGTH, cleanName } from '../net/protocol';
import styles from './TeamPhoneScreens.module.css';
import own from './PlayerPhoneScreens.module.css';

export type SetPlayer = (player: { name: string; team: string | null } | null) => void;

const pawnVars = (color: string) => ({ '--pawn': `var(--pawn-${color})` }) as CSSProperties;

/** "Como te chamas?" — the first screen of each phone (and to change the name later). */
export function NameEntry({
  view,
  onPlayer,
  onCancel,
}: {
  view: DescriberView;
  onPlayer: SetPlayer;
  /** Shown when the person already has a name (changing it). */
  onCancel?: () => void;
}) {
  const t = useT();
  const id = useId();
  const [name, setName] = useState(view.you.name ?? '');
  const clean = cleanName(name);
  const issue = view.you.issue === 'nameTaken' ? t.nameTaken : view.you.issue === 'removed' ? t.removedByTable : null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    unlockAudio();
    if (clean) onPlayer({ name: clean, team: view.you.teamId });
  };

  return (
    <form className={styles.panel} onSubmit={submit} noValidate>
      <h1 className={styles.title}>{t.nameTitle}</h1>
      <p className={styles.muted}>{t.nameHelp}</p>
      {issue && (
        <p className={styles.warning} role="alert">
          {issue}
        </p>
      )}
      <label htmlFor={`${id}-name`} className={own.label}>
        {t.nameLabel}
      </label>
      <input
        id={`${id}-name`}
        className={own.input}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t.namePlaceholder}
        maxLength={MAX_NAME_LENGTH}
        autoComplete="given-name"
        autoCapitalize="words"
        enterKeyHint="go"
        autoFocus
      />
      <div className={own.buttons}>
        {onCancel && (
          <button type="button" className="btn btn-outline btn-lg" onClick={onCancel}>
            {t.cancel}
          </button>
        )}
        <button type="submit" className="btn btn-primary btn-lg" disabled={!clean}>
          {t.continue}
        </button>
      </div>
    </form>
  );
}

/** Before the game: pick a team, or (once in one) wait for the start with the team list. */
export function Lobby({ view, onPlayer, onRename }: { view: DescriberView; onPlayer: SetPlayer; onRename: () => void }) {
  const t = useT();
  const name = view.you.name!;
  const mine = view.teamsList.find((x) => x.id === view.you.teamId);
  const choose = (team: string | null) => {
    unlockAudio();
    onPlayer({ name, team });
  };

  if (!mine) {
    return (
      <section className={styles.panel}>
        <p className={styles.eyebrow}>{t.hello(name)}</p>
        <h1 className={styles.title}>{t.pickTeamTitle}</h1>
        <p className={styles.muted}>{t.pickTeamHelpPlayer}</p>
        <ul className={styles.teamList}>
          {view.teamsList.map((team) => (
            <li key={team.id}>
              <button type="button" className={styles.teamButton} onClick={() => choose(team.id)} style={pawnVars(team.color)}>
                <Pawn color={team.color} label={teamInitial(team.name)} size={40} />
                <span className={own.teamText}>
                  <span className={styles.teamName}>{team.name}</span>
                  <span className={own.members}>{team.members.length ? team.members.join(', ') : t.nobodyYet}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className={own.link} onClick={onRename}>
          {t.changeName}
        </button>
      </section>
    );
  }

  return (
    <section className={styles.panel} style={pawnVars(mine.color)}>
      <div className={styles.turnHead}>
        <Pawn color={mine.color} label={teamInitial(mine.name)} size={52} />
        <div>
          <p className={styles.eyebrow}>{t.hello(name)}</p>
          <h1 className={styles.title}>{t.yourTeam(mine.name)}</h1>
        </div>
      </div>
      <ul className={own.memberList} aria-label={mine.name}>
        {mine.members.map((member) => (
          <li key={member} className={member === name ? own.me : undefined}>
            {member}
          </li>
        ))}
      </ul>
      <p className={styles.muted}>{t.lobbyWaiting}</p>
      <div className={own.buttons}>
        <button type="button" className="btn btn-outline" onClick={() => choose(null)}>
          <SwapIcon size={16} /> {t.changeTeam}
        </button>
        <button type="button" className="btn btn-outline" onClick={onRename}>
          {t.changeName}
        </button>
      </div>
    </section>
  );
}

/** Mid-game, on a phone that isn't anyone yet (new phone, another browser…): "Quem és tu?". */
export function WhoAreYou({ view, onPlayer }: { view: DescriberView; onPlayer: SetPlayer }) {
  const t = useT();
  return (
    <section className={styles.panel}>
      <h1 className={styles.title}>{t.whoAreYouTitle}</h1>
      <p className={styles.muted}>{t.whoAreYouHelp}</p>
      {view.you.issue === 'nameTaken' && (
        <p className={styles.warning} role="alert">
          {t.nameTaken}
        </p>
      )}
      {view.teamsList.map((team) => (
        <div key={team.id} className={own.claimTeam} style={pawnVars(team.color)}>
          <p className={styles.eyebrow}>{team.name}</p>
          <ul className={own.claimList}>
            {view.claimable
              .filter((p) => p.team === team.id)
              .map((p) => (
                <li key={p.name}>
                  <button
                    type="button"
                    className={styles.teamButton}
                    onClick={() => {
                      unlockAudio();
                      onPlayer({ name: p.name, team: p.team });
                    }}
                    disabled={p.online}
                  >
                    <span className={styles.teamName}>{p.name}</span>
                    {p.online && <span className={styles.taken}>{t.alreadyConnected}</span>}
                  </button>
                </li>
              ))}
          </ul>
        </div>
      ))}
      <p className={styles.muted}>{t.notInList}</p>
    </section>
  );
}
