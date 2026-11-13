import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { CheckIcon, PlusIcon, SwapIcon, XIcon } from '../components/Icons';
import { Pawn, teamInitial } from '../components/Pawn';
import { MAX_PLAYERS, MIN_PLAYERS } from '../game/setup';
import type { DescriberView } from '../game/selectors';
import { useT } from '../i18n';
import { MAX_NAME_LENGTH, MAX_TEAM_NAME_LENGTH, type TeamEdit } from '../net/protocol';
import styles from './TeamPhoneScreens.module.css';
import own from './PlayerPhoneScreens.module.css';

const SEND_DELAY = 300;

const tidy = (list: string[]) => list.map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * One phone per team, before the game: the group's phone writes the team name (optional:
 * otherwise "Grupo A") and who plays, in describing order. The PC shows it as it's typed.
 */
export function TeamForm({
  view,
  onEdit,
  onChangeGroup,
}: {
  view: DescriberView;
  onEdit: (edit: TeamEdit) => void;
  onChangeGroup: () => void;
}) {
  const t = useT();
  const id = useId();
  const index = view.teamsList.findIndex((x) => x.id === view.you.teamId);
  const mine = view.teamsList[index];
  const group = t.groupLabel(index);
  const [name, setName] = useState(mine?.chosenName ?? '');
  const [players, setPlayers] = useState<string[]>(() => {
    const known = mine?.members ?? [];
    return known.length >= MIN_PLAYERS ? known : [...known, ...Array<string>(MIN_PLAYERS - known.length).fill('')];
  });
  const listRef = useRef<HTMLOListElement>(null);
  const edited = useRef(false);

  // Sends what is typed, a moment after the last key.
  useEffect(() => {
    if (!edited.current) return;
    const timer = setTimeout(() => onEdit({ name: name.replace(/\s+/g, ' ').trim(), players: tidy(players) }), SEND_DELAY);
    return () => clearTimeout(timer);
  }, [name, players, onEdit]);

  if (!mine) return null;

  const change = (fn: () => void) => {
    edited.current = true;
    fn();
  };
  const setPlayer = (i: number, value: string) => change(() => setPlayers((list) => list.map((p, k) => (k === i ? value : p))));
  const addPerson = () => {
    change(() => setPlayers((list) => [...list, '']));
    // Focus the new line once it exists.
    setTimeout(() => listRef.current?.querySelector<HTMLInputElement>('li:last-child input')?.focus(), 0);
  };
  const removePerson = (i: number) => change(() => setPlayers((list) => list.filter((_, k) => k !== i)));

  const written = tidy(players);
  const synced = mine.chosenName === name.replace(/\s+/g, ' ').trim() && sameList(mine.members, written);

  return (
    <section className={styles.panel} style={{ '--pawn': `var(--pawn-${mine.color})` } as CSSProperties}>
      <div className={styles.turnHead}>
        <Pawn color={mine.color} label={teamInitial(name.trim() || group)} size={48} />
        <h1 className={styles.title}>{t.teamFormTitle(group)}</h1>
      </div>

      <div className={own.field}>
        <label htmlFor={`${id}-name`} className={own.label}>
          {t.teamNameLabel}
        </label>
        <input
          id={`${id}-name`}
          className={own.input}
          value={name}
          placeholder={group}
          maxLength={MAX_TEAM_NAME_LENGTH}
          autoComplete="off"
          onChange={(e) => change(() => setName(e.target.value))}
        />
        <p className={own.hint}>{t.teamNameOptional(group)}</p>
      </div>

      <div className={own.field}>
        <span id={`${id}-players`} className={own.label}>
          {t.playersFormLabel}
        </span>
        <ol className={own.people} ref={listRef} aria-labelledby={`${id}-players`}>
          {players.map((player, i) => (
            <li key={i}>
              <span className={own.number} aria-hidden="true">
                {i + 1}
              </span>
              <input
                className={own.input}
                value={player}
                placeholder={t.personPlaceholder(i + 1)}
                aria-label={t.personPlaceholder(i + 1)}
                maxLength={MAX_NAME_LENGTH}
                autoComplete="off"
                autoCapitalize="words"
                enterKeyHint={i === players.length - 1 ? 'done' : 'next'}
                onChange={(e) => setPlayer(i, e.target.value)}
              />
              <button
                type="button"
                className={own.removePerson}
                onClick={() => removePerson(i)}
                disabled={players.length <= MIN_PLAYERS}
                aria-label={t.removePersonN(i + 1)}
              >
                <XIcon size={16} />
              </button>
            </li>
          ))}
        </ol>
        {players.length < MAX_PLAYERS && (
          <button type="button" className={own.addPerson} onClick={addPerson}>
            <PlusIcon size={16} /> {t.addPerson}
          </button>
        )}
      </div>

      <p className={written.length < MIN_PLAYERS ? styles.warning : own.synced} role="status">
        {written.length < MIN_PLAYERS ? (
          t.teamFormNeedTwo
        ) : synced ? (
          <>
            <CheckIcon size={16} /> {t.teamFormSynced}
          </>
        ) : (
          '…'
        )}
      </p>

      <button type="button" className="btn btn-outline" onClick={onChangeGroup}>
        <SwapIcon size={16} /> {t.changeGroup}
      </button>
    </section>
  );
}

/**
 * One phone per person, in the lobby: anyone in the group can name the team. Follows what
 * the others type, unless this person is typing.
 */
export function TeamNameField({
  view,
  onEdit,
}: {
  view: DescriberView;
  onEdit: (edit: TeamEdit) => void;
}) {
  const t = useT();
  const id = useId();
  const index = view.teamsList.findIndex((x) => x.id === view.you.teamId);
  const mine = view.teamsList[index];
  const group = t.groupLabel(index);
  const [name, setName] = useState(mine?.chosenName ?? '');
  const [typing, setTyping] = useState(false);
  const edited = useRef(false);

  // Someone else in the group changed it: show theirs (not while typing here).
  useEffect(() => {
    if (!typing && mine) setName(mine.chosenName);
  }, [mine?.chosenName, typing]);

  useEffect(() => {
    if (!edited.current) return;
    const timer = setTimeout(() => onEdit({ name: name.replace(/\s+/g, ' ').trim() }), SEND_DELAY);
    return () => clearTimeout(timer);
  }, [name, onEdit]);

  if (!mine) return null;
  return (
    <div className={own.field}>
      <label htmlFor={`${id}-team`} className={own.label}>
        {t.teamNameLabel}
      </label>
      <input
        id={`${id}-team`}
        className={own.input}
        value={name}
        placeholder={group}
        maxLength={MAX_TEAM_NAME_LENGTH}
        autoComplete="off"
        onFocus={() => setTyping(true)}
        onBlur={() => setTyping(false)}
        onChange={(e) => {
          edited.current = true;
          setName(e.target.value);
        }}
      />
      <p className={own.hint}>{t.teamNameAnyone}</p>
    </div>
  );
}
