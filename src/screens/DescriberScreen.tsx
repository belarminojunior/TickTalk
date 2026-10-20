import { useEffect, useRef, type ReactNode } from 'react';
import { play, unlockAudio } from '../audio/sfx';
import { Board } from '../components/Board';
import { CardBack, CardFace, FlipCard } from '../components/Card';
import { PauseIcon, PlayIcon } from '../components/Icons';
import { Pawn, teamInitial } from '../components/Pawn';
import { TimerRing } from '../components/TimerRing';
import { WordButton } from '../components/WordButton';
import type { DescriberView } from '../game/selectors';
import type { ScreenMode } from '../game/types';
import { useKeyboard } from '../hooks/useKeyboard';
import { useCountdown } from '../hooks/useTimer';
import type { DescriberCommand } from '../net/protocol';
import type { DescriberStatus } from '../hooks/useTransport';
import { useT } from '../i18n';
import { useTickSounds } from './sounds';
import styles from './DescriberScreen.module.css';

export interface DescriberScreenProps {
  view: DescriberView | null;
  anchor: number;
  status: DescriberStatus;
  mode: ScreenMode;
  now: () => number;
  onCommand: (command: DescriberCommand) => void;
  /** Ações extra no handoff (no modo "um só ecrã", por exemplo trocar quem explica). */
  handoffExtra?: ReactNode;
  /** Quando outro separador ficou com a ligação: voltar a usar este. */
  onTakeOver?: () => void;
}

const LOCKED_PHASES = ['timeUp', 'validating', 'rolling', 'moving'];

/** A tela de quem explica: a carta grande ao centro e o tabuleiro desfocado ao fundo. */
export function DescriberScreen({ view, anchor, status, mode, now, onCommand, handoffExtra, onTakeOver }: DescriberScreenProps) {
  const t = useT();
  const remaining = useCountdown(view?.timer.remainingMs ?? 0, !!view?.timer.running, anchor, now);
  const phase = view?.phase ?? 'setup';
  const describing = phase === 'describing';
  const markedTotal = view?.marked.filter(Boolean).length ?? 0;

  useTickSounds(remaining, describing);

  // Buzina quando o tempo acaba (só uma vez por vez).
  const prevPhase = useRef(phase);
  useEffect(() => {
    if (prevPhase.current !== phase) {
      if (phase === 'timeUp') play('horn');
      if (phase === 'describing' && prevPhase.current === 'handoff') play('start');
      prevPhase.current = phase;
    }
  }, [phase]);

  const toggle = (index: number) => {
    if (!view || !describing) return;
    play(view.marked[index] ? 'unhit' : 'hit');
    onCommand({ type: 'TOGGLE_WORD', index });
  };

  const readyOrStart = () => {
    if (!view || phase !== 'handoff') return;
    unlockAudio();
    onCommand(view.ready ? { type: 'START' } : { type: 'READY' });
  };

  useKeyboard({
    Space: readyOrStart,
    '1': () => toggle(0),
    '2': () => toggle(1),
    '3': () => toggle(2),
    '4': () => toggle(3),
    '5': () => toggle(4),
    p: () => {
      if (phase === 'describing') onCommand({ type: 'PAUSE' });
      else if (phase === 'paused') onCommand({ type: 'RESUME' });
    },
    Enter: () => {
      if (phase === 'describing' || phase === 'paused') onCommand({ type: 'END_EARLY' });
    },
  });

  const statusMessage = (() => {
    if (status === 'replaced') return { title: t.replacedDescriberTitle, body: t.replacedDescriberHelp, takeOver: true };
    if (status === 'busy') return { title: t.busy, body: t.busyHelp };
    if (status === 'reconnecting') return { title: t.reconnecting, body: t.sameWifi };
    if (status === 'connecting') return { title: t.reconnecting, body: t.waitingHostHelp };
    if (status === 'waitingHost') return { title: t.waitingHost, body: t.waitingHostHelp };
    if (!view || phase === 'setup') return { title: t.waitingGame, body: t.waitingGameHelp };
    return null;
  })();

  const side = view?.side ?? 'blue';
  const team = view?.team;
  const describer = view?.describer ?? '';
  const showFace = (describing || phase === 'paused') && !!view?.words;

  const cardFace = (
    <CardFace side={side} header={t.cardHeader(side, view?.cardNumber ?? null)}>
      {phase === 'paused' ? (
        <div className={styles.pausedCover}>
          <strong>{t.paused}</strong>
          <span>{view?.pauseReason === 'disconnected' ? t.reconnectedHelp : t.pausedWordsHidden}</span>
          <button type="button" className="btn btn-dark btn-lg" onClick={() => onCommand({ type: 'RESUME' })}>
            <PlayIcon size={20} /> {t.resume}
          </button>
        </div>
      ) : (
        (view?.words ?? []).map((word, i) => (
          <WordButton
            key={`${view?.cardNumber}-${i}`}
            index={i}
            word={word}
            marked={!!view?.marked[i]}
            side={side}
            disabled={!describing}
            onToggle={toggle}
          />
        ))
      )}
    </CardFace>
  );

  return (
    <div className={styles.screen} data-side={side}>
      <div className={styles.background} aria-hidden="true">
        <Board
          blurred
          showDie={false}
          pawns={(view?.pawns ?? []).map((p) => ({ ...p, label: teamInitial(p.name) }))}
        />
        <div className={styles.scrim} />
      </div>

      <main className={styles.content}>
        {statusMessage ? (
          <div className={styles.message}>
            <h1>{statusMessage.title}</h1>
            <p>{statusMessage.body}</p>
            {'takeOver' in statusMessage && onTakeOver && (
              <button type="button" className="btn btn-primary btn-lg" onClick={onTakeOver}>
                {t.useThisWindow}
              </button>
            )}
          </div>
        ) : (
          view &&
          team && (
            <>
              <header className={styles.top}>
                <Pawn color={team.color} label={teamInitial(team.name)} size={52} />
                <div className={styles.who}>
                  <h1 className={styles.whoTitle}>
                    {phase === 'handoff' ? t.handoffTitle(mode, describer) : t.youExplain(describer)}
                  </h1>
                  <p className={styles.whoSub}>{t.teamLine(team.name, team.position, side)}</p>
                </div>
                <TimerRing
                  size={76}
                  remainingMs={remaining}
                  durationMs={view.timer.durationMs}
                  running={describing}
                  label={t.secondsLeft(Math.ceil(remaining / 1000))}
                />
                <button
                  type="button"
                  className={styles.roundButton}
                  onClick={() => onCommand({ type: phase === 'paused' ? 'RESUME' : 'PAUSE' })}
                  disabled={!describing && phase !== 'paused'}
                  aria-label={phase === 'paused' ? t.resume : t.pause}
                >
                  {phase === 'paused' ? <PlayIcon size={22} /> : <PauseIcon size={22} />}
                </button>
              </header>

              {phase === 'won' ? (
                <div className={styles.message}>
                  <h1>{t.gameOver}</h1>
                  {view.winner && <p>{t.victory(view.winner)}</p>}
                </div>
              ) : LOCKED_PHASES.includes(phase) ? (
                <CardBack label={t.cardBack}>
                  <div className={styles.lockNote} role="status">
                    <strong>{t.lookAtTable}</strong>
                    <span>{phase === 'validating' ? t.lookAtTableHelp : t.lookAtTableHelpNoValidation}</span>
                  </div>
                </CardBack>
              ) : (
                <FlipCard flipped={showFace} back={<CardBack label={t.cardBack} />} front={cardFace} />
              )}

              {phase === 'handoff' && (
                <div className={styles.below}>
                  <div className={styles.handoffText}>
                    <h2>{t.youExplain(describer)}</h2>
                    <p>{view.flipped ? t.flippedNotice(side) : t.readyHint}</p>
                  </div>
                  <div className={styles.actions}>
                    {handoffExtra}
                    {view.ready ? (
                      <button type="button" className="btn btn-primary btn-lg" onClick={readyOrStart} autoFocus>
                        {t.start}
                      </button>
                    ) : (
                      <button type="button" className="btn btn-primary btn-lg" onClick={readyOrStart} autoFocus>
                        {t.imReady}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {(describing || phase === 'paused') && (
                <div className={styles.below}>
                  <div>
                    <h2 className={styles.count} aria-live="polite">
                      {t.hitsCount(markedTotal)}
                    </h2>
                    <p className={styles.help}>
                      {t.describerHelp1}
                      <br />
                      {t.describerHelp2}
                    </p>
                  </div>
                  <button type="button" className="btn btn-dark btn-lg" onClick={() => onCommand({ type: 'END_EARLY' })}>
                    {t.endTurn}
                  </button>
                </div>
              )}
            </>
          )
        )}
      </main>
    </div>
  );
}
