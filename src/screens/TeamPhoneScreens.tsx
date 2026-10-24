import type { CSSProperties } from 'react';
import { CardFace } from '../components/Card';
import { ArrowRightIcon, DiceIcon, SwapIcon } from '../components/Icons';
import { Pawn, teamInitial } from '../components/Pawn';
import { sideVars } from '../components/TablePanels';
import { TimerRing } from '../components/TimerRing';
import { RulesList, ValidationRow } from '../components/ValidationRow';
import { markedCount, otherSide, validCount } from '../game/reducer';
import type { DescriberView } from '../game/selectors';
import type { Side } from '../game/types';
import { useT } from '../i18n';
import type { DescriberCommand } from '../net/protocol';
import styles from './TeamPhoneScreens.module.css';

/** "Qual é a tua equipa?" — the first screen of each phone, once the game has started. */
export function TeamPicker({ view, onJoin }: { view: DescriberView; onJoin: (team: string) => void }) {
  const t = useT();
  const refused = view.teamsList.find((x) => x.id === view.you.refusedTeam);
  return (
    <section className={styles.panel}>
      <h1 className={styles.title}>{t.pickTeamTitle}</h1>
      <p className={styles.muted}>{t.pickTeamHelp}</p>
      {refused && (
        <p className={styles.warning} role="alert">
          {t.refusedTeam(refused.name)}
        </p>
      )}
      <ul className={styles.teamList}>
        {view.teamsList.map((team) => (
          <li key={team.id}>
            <button
              type="button"
              className={styles.teamButton}
              onClick={() => onJoin(team.id)}
              disabled={team.taken}
              style={{ '--pawn': `var(--pawn-${team.color})` } as CSSProperties}
            >
              <Pawn color={team.color} label={teamInitial(team.name)} size={40} />
              <span className={styles.teamName}>{team.name}</span>
              {team.taken && <span className={styles.taken}>{t.teamTaken}</span>}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Small bar with this phone's team and a way to change it. */
function YourTeam({ view, onChangeTeam }: { view: DescriberView; onChangeTeam: () => void }) {
  const t = useT();
  const mine = view.teamsList.find((x) => x.id === view.you.teamId);
  if (!mine) return null;
  return (
    <div className={styles.yourTeam}>
      <Pawn color={mine.color} label={teamInitial(mine.name)} size={34} />
      <span className={styles.yourTeamName}>{t.yourTeam(mine.name)}</span>
      <button type="button" className="btn btn-outline" onClick={onChangeTeam}>
        <SwapIcon size={16} /> {t.changeTeam}
      </button>
    </div>
  );
}

/** Phones of the teams not playing (and not checking): the turn, live, without any words. */
export function SpectatorScreen({
  view,
  remaining,
  onChangeTeam,
}: {
  view: DescriberView;
  remaining: number;
  onChangeTeam: () => void;
}) {
  const t = useT();
  const team = view.team;
  const hits = markedCount(view);
  const live = view.phase === 'describing' || view.phase === 'paused';

  let body: JSX.Element;
  if (view.phase === 'won') {
    body = <p className={styles.big}>{view.winner ? t.victory(view.winner) : t.gameOver}</p>;
  } else if (live) {
    body = (
      <div className={styles.liveRow}>
        <TimerRing
          size={110}
          remainingMs={remaining}
          durationMs={view.timer.durationMs}
          running={view.phase === 'describing'}
          label={t.secondsLeft(Math.ceil(remaining / 1000))}
        />
        <div>
          <p className={styles.big} aria-live="polite">
            {t.hitsCount(hits)}
          </p>
          {view.phase === 'paused' && <p className={styles.muted}>{t.paused}</p>}
        </div>
      </div>
    );
  } else if (view.phase === 'timeUp') {
    body = <p className={styles.big}>{t.timeUp}</p>;
  } else if (view.phase === 'validating') {
    body = <p className={styles.big}>{view.checking ? t.checkingNow(view.checking) : t.timeUp}</p>;
  } else if (view.phase === 'rolling') {
    body = <p className={styles.big}>{t.rolling}</p>;
  } else if (view.phase === 'moving' && view.endOfTurn) {
    body = (
      <>
        <p className={styles.big}>
          {t.plusSquares(view.endOfTurn.steps)} · {t.squareN(view.endOfTurn.to)}
        </p>
        <p className={styles.muted}>{t.nextUp(view.endOfTurn.nextPlayer, view.endOfTurn.nextTeam)}</p>
      </>
    );
  } else if (view.phase === 'handoff') {
    body = <p className={styles.muted}>{t.startsSoon}</p>;
  } else {
    body = <p className={styles.muted}>{t.waitingNextTurn}</p>;
  }

  return (
    <>
      <YourTeam view={view} onChangeTeam={onChangeTeam} />
      {team && view.phase !== 'won' && (
        <section className={styles.panel} style={{ '--pawn': `var(--pawn-${team.color})` } as CSSProperties}>
          <div className={styles.turnHead}>
            <Pawn color={team.color} label={teamInitial(team.name)} size={48} />
            <div>
              <p className={styles.eyebrow}>{t.turnOf(team.name)}</p>
              {view.describer && (
                <h1 className={styles.title}>
                  {view.phase === 'handoff' ? t.aboutToExplain(view.describer) : t.isExplaining(view.describer)}
                </h1>
              )}
            </div>
          </div>
          {body}
          {live && <p className={styles.muted}>{t.spectatorHelp}</p>}
        </section>
      )}
      {view.phase === 'won' && <section className={styles.panel}>{body}</section>}
    </>
  );
}

/** The checking team's phone: both sides of the card, Válida | Anular, then confirm. */
export function PhoneValidation({
  view,
  onCommand,
}: {
  view: DescriberView;
  onCommand: (command: DescriberCommand) => void;
}) {
  const t = useT();
  const v = view.validation;
  if (!v) return null;
  const marked = markedCount(v);
  const valid = validCount(v);
  const annulled = marked - valid;
  const withDie = view.scoring === 'die';
  const sides: Side[] = [v.side, otherSide(v.side)];

  return (
    <div className={styles.validation}>
      <header className={styles.validationHead}>
        <span className={styles.pill}>{t.timeUpPill}</span>
        <h1 className={styles.title}>{t.phoneValidateTitle(v.team)}</h1>
        <p className={styles.muted}>{t.validateSubtitle(v.describer, withDie)}</p>
      </header>

      {sides.map((side) => (
        <CardFace key={side} side={side} header={t.cardHeader(side, v.cardNumber)}>
          <ul className={styles.rows} style={sideVars(side)}>
            {v.words[side].map((word, i) => (
              <ValidationRow
                key={i}
                index={i}
                word={word}
                marked={v.marked[side][i]}
                annulled={v.annulled[side][i]}
                onChange={(index, isAnnulled) => onCommand({ type: 'SET_VALIDATION', side, index, annulled: isAnnulled })}
                compact
              />
            ))}
          </ul>
        </CardFace>
      ))}

      <section className={styles.panel} style={sideVars(v.side)}>
        <h2 className="eyebrow">{t.turnResult}</h2>
        <p className={styles.sum}>
          <b>{marked}</b> {t.markedWord(marked)} − <b className={styles.annulledNum}>{annulled}</b> {t.annulledWord(annulled)}
        </p>
        <div className={styles.validBox} aria-live="polite">
          <strong>{valid}</strong> <span>{t.validWords(valid)}</span>
        </div>
      </section>

      <button type="button" className="btn btn-primary btn-lg btn-block" onClick={() => onCommand({ type: 'CONFIRM_VALIDATION' })}>
        {withDie ? <DiceIcon size={22} /> : <ArrowRightIcon size={22} />}
        {withDie ? t.confirmRoll : t.confirmAdvance}
      </button>
      <p className={styles.note}>{t.finalNote}</p>
      <RulesList />
    </div>
  );
}
