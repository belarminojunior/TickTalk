import { useCallback, useEffect, useRef, useState, type CSSProperties, type Dispatch } from 'react';
import { play, unlockAudio } from '../audio/sfx';
import { Board, type BoardPawn } from '../components/Board';
import { Logo, StatusPill } from '../components/Controls';
import { MuteIcon, PlayIcon, SoundIcon, SwapIcon, ExternalIcon } from '../components/Icons';
import { Pawn, teamInitial } from '../components/Pawn';
import { QrConnect } from '../components/QrConnect';
import { RulesModal } from '../components/RulesModal';
import { LiveFeed, ProgressSlots, Projection, TeamCards, sideVars } from '../components/TablePanels';
import { TimerRing } from '../components/TimerRing';
import { WinScreen } from '../components/WinScreen';
import { markedCount as countMarked, type GameAction } from '../game/reducer';
import type { Rng } from '../game/random';
import { provisionalPosition, type TableView } from '../game/selectors';
import type { ScreenMode } from '../game/types';
import { useKeyboard } from '../hooks/useKeyboard';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useCountdown } from '../hooks/useTimer';
import type { HostLink } from '../hooks/useTransport';
import { useT } from '../i18n';
import { EndTurnPanel, FlyingDie, RollOverlay } from './RollScreen';
import { useTickSounds } from './sounds';
import { ValidationScreen } from './ValidationScreen';
import styles from './TableScreen.module.css';

const HOP_MS = 180;
const TIME_UP_MS = 1800;

export interface TableScreenProps {
  view: TableView;
  dispatch: Dispatch<GameAction>;
  link: HostLink;
  mode: ScreenMode;
  phoneUrl: string | null;
  now: () => number;
  rng: Rng;
  animationScale: number;
  muted: boolean;
  onToggleMute: () => void;
  onOpenDescriberWindow: () => void;
  onNewSetup: () => void;
  onPlayAgain: () => void;
}

/**
 * Animates the pawn square by square, from where it stood during the turn (start + valid
 * words) to its final square — usually backwards by the die. Returns the shown position,
 * or null when not animating.
 */
function useHop(view: TableView, scale: number, onDone: () => void): number | null {
  const turn = view.turn;
  const animating = view.phase === 'moving' && !!turn?.move && !turn.settled;
  const [shown, setShown] = useState<number | null>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const reduced = useReducedMotion();
  const from = provisionalPosition(view) ?? turn?.move?.from ?? 0;
  const to = turn?.move?.to ?? 0;

  useEffect(() => {
    if (!animating) {
      setShown(null);
      return;
    }
    const stepMs = reduced ? 0 : HOP_MS * scale;
    let pos = from;
    setShown(pos);
    let id: ReturnType<typeof setTimeout>;
    const dir = Math.sign(to - from);
    const step = () => {
      if (pos === to) {
        doneRef.current();
        return;
      }
      pos += dir;
      setShown(pos);
      play('hop');
      id = setTimeout(step, stepMs);
    };
    id = setTimeout(step, stepMs + 200 * scale);
    return () => clearTimeout(id);
  }, [animating, from, to, scale, reduced]);

  return animating ? shown : null;
}

export function TableScreen(props: TableScreenProps) {
  const { view, dispatch, link, mode, now, rng, animationScale: scale } = props;
  const t = useT();
  const [rulesOpen, setRulesOpen] = useState(false);
  const turn = view.turn;
  const team = turn ? view.teams[turn.teamIndex] : null;
  const phase = view.phase;
  const withDie = view.settings.scoring === 'die';
  const dieRef = useRef<HTMLDivElement>(null);

  // --- Movement: the pawn hops and the die returns to the board; both finish before DIE_RETURNED.
  const pending = useRef({ hop: false, die: false });
  const turnKey = turn ? `${view.round}-${turn.teamIndex}-${turn.move?.from ?? ''}` : '';
  useEffect(() => {
    pending.current = { hop: false, die: !withDie };
  }, [turnKey, phase, withDie]);
  const settleIfDone = useCallback(() => {
    if (pending.current.hop && pending.current.die) dispatch({ type: 'DIE_RETURNED' });
  }, [dispatch]);
  const shownPosition = useHop(view, scale, () => {
    pending.current.hop = true;
    settleIfDone();
  });
  const onDieBack = useCallback(() => {
    pending.current.die = true;
    settleIfDone();
  }, [settleIfDone]);

  // During the turn the active pawn moves one square per correct word (provisional);
  // at the end it hops to its real square.
  const livePosition = shownPosition ?? (phase === 'moving' ? null : provisionalPosition(view));
  const positions = view.teams.map((tm, i) =>
    livePosition !== null && turn && i === turn.teamIndex ? livePosition : tm.position,
  );
  const pawns: BoardPawn[] = view.teams.map((tm, i) => ({
    id: tm.id,
    name: tm.name,
    color: tm.color,
    label: teamInitial(tm.name),
    position: positions[i],
  }));

  // --- Table sounds: hit, horn.
  const markedCount = turn ? countMarked(turn) : 0;
  const prevMarked = useRef(markedCount);
  useEffect(() => {
    if (phase === 'describing' || phase === 'paused') {
      if (markedCount > prevMarked.current) play('hit');
      else if (markedCount < prevMarked.current) play('unhit');
    }
    prevMarked.current = markedCount;
  }, [markedCount, phase]);
  useEffect(() => {
    if (phase === 'timeUp') play('horn');
  }, [phase]);

  // --- Time's up → validation (automatic, or Space).
  useEffect(() => {
    if (phase !== 'timeUp') return;
    const id = setTimeout(() => dispatch({ type: 'BEGIN_VALIDATION' }), TIME_UP_MS * scale);
    return () => clearTimeout(id);
  }, [phase, dispatch, scale]);

  const remaining = useCountdown(
    turn?.timer.remainingMs ?? 0,
    !!turn?.timer.running,
    turn?.timer.lastTickAt ?? 0,
    now,
  );
  useTickSounds(remaining, phase === 'describing');

  const onRolled = useCallback((value: number) => dispatch({ type: 'ROLL_DIE', value }), [dispatch]);
  const onRollDone = useCallback(() => dispatch({ type: 'APPLY_MOVE' }), [dispatch]);

  // The describer passes the turn on their screen; the table only does it in one-screen
  // mode, or as a fallback when the describer screen is not connected.
  const passOnTable = mode === 'single' || !link.describerOnline;

  const next = () => {
    unlockAudio();
    if (phase === 'timeUp') dispatch({ type: 'BEGIN_VALIDATION' });
    else if (phase === 'validating') dispatch({ type: 'CONFIRM_VALIDATION' });
    else if (phase === 'moving' && turn?.settled && passOnTable) dispatch({ type: 'NEXT_TEAM' });
    else if (phase === 'paused' && (link.describerOnline || mode === 'single')) dispatch({ type: 'RESUME', now: now() });
  };

  useKeyboard(
    {
      Space: next,
      z: () => view.canUndo && dispatch({ type: 'UNDO_TURN' }),
      '?': () => setRulesOpen(true),
      Escape: () => setRulesOpen(false),
    },
    !rulesOpen && phase !== 'won',
  );

  const live = phase === 'handoff' || phase === 'describing' || phase === 'paused';
  const headerLine =
    phase === 'moving' && team ? t.roundEndLine(view.round, team.name) : t.roundLine(view.round);

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <Logo size={64} />
          <div>
            <h1 className={styles.brandTitle}>Tick Talk</h1>
            <p className={styles.brandSub}>{headerLine}</p>
          </div>
        </div>
        <div className={styles.headerCenter}>
          {live && mode !== 'single' &&
            (link.describerOnline ? (
              <StatusPill tone="live">{t.live[mode]}</StatusPill>
            ) : (
              <StatusPill tone="off">{t.describerOffline[mode]}</StatusPill>
            ))}
        </div>
        <div className={styles.headerRight}>
          {phase === 'moving' ? (
            <span className={styles.modePill}>{withDie ? t.modeDie : t.modeNoDie}</span>
          ) : (
            <>
              <button type="button" className="btn btn-outline" onClick={() => setRulesOpen(true)}>
                {t.rules}
              </button>
              <button
                type="button"
                className={styles.iconButton}
                onClick={props.onToggleMute}
                aria-label={props.muted ? t.soundOff : t.soundOn}
                aria-pressed={!props.muted}
              >
                {props.muted ? <MuteIcon size={22} /> : <SoundIcon size={22} />}
              </button>
            </>
          )}
        </div>
      </header>

      <div className={styles.main}>
        <div className={styles.left}>
          <div className={styles.boardBox}>
            <Board
              ref={dieRef}
              pawns={pawns}
              die={view.lastDie}
              showDie={withDie && !(phase === 'moving' && !turn?.settled) && phase !== 'rolling'}
              highlight={phase === 'moving' && turn?.move ? turn.move.to : null}
              movingId={livePosition !== null && team ? team.id : null}
            />
          </div>
          <TeamCards teams={view.teams} activeIndex={turn?.teamIndex ?? null} positions={positions} />
        </div>

        <aside className={styles.right}>
          {phase === 'handoff' && turn && team && (
            <HandoffPanel {...props} />
          )}
          {(phase === 'describing' || phase === 'paused' || phase === 'timeUp') && turn && team && (
            <>
              <section className={`panel ${styles.turnPanel}`} style={{ ...sideVars(turn.up), '--pawn': `var(--pawn-${team.color})` } as CSSProperties}>
                <div className={styles.turnHead}>
                  <Pawn color={team.color} label={teamInitial(team.name)} size={52} />
                  <div>
                    <p className={styles.teamEyebrow}>{t.teamSide(team.name, turn.side)}</p>
                    <h2 className={styles.turnTitle}>{t.isExplaining(turn.describer)}</h2>
                    <p className={styles.muted}>{t.guessing(turn.guessers)}</p>
                  </div>
                </div>
                {phase === 'paused' ? (
                  <div className={styles.pausedBox} role="status">
                    <strong>{turn.pauseReason === 'disconnected' ? t.describerOffline[mode] || t.paused : t.paused}</strong>
                    <span>{turn.pauseReason === 'disconnected' ? t.disconnectedHelp : t.pausedHelp}</span>
                    {(link.describerOnline || mode === 'single') && (
                      <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: 'RESUME', now: now() })}>
                        <PlayIcon size={18} /> {t.resume}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className={styles.timerRow}>
                    <TimerRing
                      size={150}
                      remainingMs={remaining}
                      durationMs={turn.timer.durationMs}
                      caption={t.seconds}
                      running={phase === 'describing'}
                      label={t.secondsLeft(Math.ceil(remaining / 1000))}
                    />
                    <div className={styles.counter}>
                      <strong className={styles.bigCount} data-testid="live-count">
                        {markedCount}
                      </strong>
                      <span>{t.ofTenGuessed}</span>
                    </div>
                  </div>
                )}
                <ProgressSlots marked={turn.marked} up={turn.up} />
                <p className={styles.muted}>
                  {view.settings.validation === 'none' ? t.hiddenNoteNoValidation : t.hiddenNote}{' '}
                  {t.pawnLiveNote(withDie, view.settings.validation !== 'none')}
                </p>
              </section>
              <Projection marked={markedCount} scoring={view.settings.scoring} />
              <LiveFeed hits={turn.hits} />
            </>
          )}
          {phase === 'moving' && turn?.move && (
            <EndTurnPanel
              view={view}
              onNext={passOnTable ? () => dispatch({ type: 'NEXT_TEAM' }) : null}
              onUndo={() => dispatch({ type: 'UNDO_TURN' })}
              passHint={t.passOnDevice[mode]}
            />
          )}
        </aside>
      </div>

      {phase === 'timeUp' && turn && (
        <div className={styles.timeUp} role="alert">
          <div className={styles.timeUpBox}>
            <span className={styles.timeUpTitle}>
              {turn.endReason === 'allWords' ? t.allWords : turn.endReason === 'early' ? t.endedEarly : t.timeUp}
            </span>
            <button type="button" className="btn btn-primary btn-lg" onClick={() => dispatch({ type: 'BEGIN_VALIDATION' })}>
              {t.continue}
            </button>
          </div>
        </div>
      )}

      {phase === 'validating' && (
        <ValidationScreen
          view={view}
          pawns={pawns}
          onSet={(side, index, annulled) => dispatch({ type: 'SET_VALIDATION', side, index, annulled })}
          onConfirm={() => {
            unlockAudio();
            dispatch({ type: 'CONFIRM_VALIDATION' });
          }}
        />
      )}

      {phase === 'rolling' && turn && (
        <RollOverlay
          die={turn.die}
          turnKey={`${view.round}-${turn.teamIndex}-${turn.describer}`}
          rng={rng}
          scale={scale}
          onRolled={onRolled}
          onDone={onRollDone}
        />
      )}

      {phase === 'moving' && withDie && turn && !turn.settled && turn.die !== null && (
        <FlyingDie value={turn.die} targetRef={dieRef} scale={scale} onDone={onDieBack} />
      )}

      {phase === 'won' && (
        <WinScreen teams={view.teams} winnerId={view.winnerId} onPlayAgain={props.onPlayAgain} onNewSetup={props.onNewSetup} />
      )}

      {rulesOpen && <RulesModal onClose={() => setRulesOpen(false)} onBackToSetup={props.onNewSetup} />}
    </div>
  );
}

function HandoffPanel({ view, dispatch, link, mode, phoneUrl, onOpenDescriberWindow }: TableScreenProps) {
  const t = useT();
  const turn = view.turn!;
  const team = view.teams[turn.teamIndex];
  return (
    <section className={`panel ${styles.turnPanel}`} style={{ '--pawn': `var(--pawn-${team.color})` } as CSSProperties}>
      <div className={styles.turnHead}>
        <Pawn color={team.color} label={teamInitial(team.name)} size={52} />
        <div>
          <p className={styles.teamEyebrow}>{t.teamSide(team.name, turn.side)}</p>
          <h2 className={styles.turnTitle}>{t.passTo(mode, turn.describer, team.name)}</h2>
          <p className={styles.muted}>{t.handoffHelp(mode)}</p>
        </div>
      </div>

      {link.describerOnline || mode === 'single' ? (
        turn.ready && <StatusPill tone="ok">{t.readyStatus(turn.describer)}</StatusPill>
      ) : mode === 'phone' ? (
        <QrConnect url={phoneUrl} connected={link.connected} server={link.serverStatus} compact />
      ) : (
        <div className={styles.waitBox}>
          <StatusPill tone="off">{t.waitingDescriber[mode]}</StatusPill>
          <button type="button" className="btn btn-outline" onClick={onOpenDescriberWindow}>
            <ExternalIcon size={18} /> {t.openWindow}
          </button>
        </div>
      )}

      <button type="button" className="btn btn-outline" onClick={() => dispatch({ type: 'HANDOFF', skipDescriber: true })}>
        <SwapIcon size={18} /> {t.skipDescriber}
      </button>
    </section>
  );
}
