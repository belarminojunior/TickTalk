import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { play } from '../audio/sfx';
import { BigDie } from '../components/BigDie';
import { Pawn, teamInitial } from '../components/Pawn';
import { CardFlipNotice, SquareChange } from '../components/TablePanels';
import { squareColor } from '../game/board';
import { rollDie } from '../game/dice';
import type { Rng } from '../game/random';
import { nextDescriber, teamSequence, turnSummary, type TableView } from '../game/selectors';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useT } from '../i18n';
import { UndoIcon } from '../components/Icons';
import styles from './RollScreen.module.css';

const ROLL_MS = 1200;
const SHOW_MS = 700;

/** "rolling" phase: the die rolls big in the centre (~1.2 s), then the move is applied. */
export function RollOverlay({
  die,
  turnKey,
  rng,
  scale,
  onRolled,
  onDone,
}: {
  die: number | null;
  /** Identifies the turn, so the die is never rolled twice. */
  turnKey: string;
  rng: Rng;
  scale: number;
  onRolled: (value: number) => void;
  onDone: () => void;
}) {
  const t = useT();
  const [rolling, setRolling] = useState(die === null);
  const rolledFor = useRef<string | null>(null);

  useEffect(() => {
    if (die !== null || rolledFor.current === turnKey) return;
    rolledFor.current = turnKey;
    play('dice');
    onRolled(rollDie(rng));
  }, [die, turnKey, rng, onRolled]);

  useEffect(() => {
    if (die === null) return;
    const a = setTimeout(() => setRolling(false), ROLL_MS * scale);
    const b = setTimeout(onDone, (ROLL_MS + SHOW_MS) * scale);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [die, scale, onDone]);

  return (
    <div className={styles.overlay} role="status" aria-live="polite">
      <BigDie value={die} rolling={rolling || die === null} size={220} label={die !== null && !rolling ? t.dieRolled(die) : t.rolling} />
      <p className={styles.caption}>{die !== null && !rolling ? t.dieRolled(die) : t.rolling}</p>
    </div>
  );
}

/** The big die travels from the centre of the screen back to its spot on the board. */
export function FlyingDie({ value, targetRef, scale, onDone }: { value: number; targetRef: RefObject<HTMLElement>; scale: number; onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useLayoutEffect(() => {
    const el = ref.current;
    const target = targetRef.current;
    const duration = 650 * scale;
    if (!el || !target || reduced || typeof el.animate !== 'function' || duration === 0) {
      const id = setTimeout(() => doneRef.current(), duration);
      return () => clearTimeout(id);
    }
    const from = el.getBoundingClientRect();
    const to = target.getBoundingClientRect();
    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    const s = to.width / from.width;
    const anim = el.animate(
      [
        { transform: 'translate(0, 0) scale(1) rotate(-8deg)' },
        { transform: `translate(${dx}px, ${dy}px) scale(${s}) rotate(-8deg)` },
      ],
      { duration, easing: 'cubic-bezier(0.5, 0, 0.2, 1)', fill: 'forwards' },
    );
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      doneRef.current();
    };
    anim.onfinish = finish;
    // Browsers pause animations in hidden or minimised windows; never let that stall the turn.
    const fallback = setTimeout(finish, duration + 400);
    return () => {
      clearTimeout(fallback);
      anim.cancel();
    };
  }, [targetRef, reduced, scale]);

  return (
    <div className={styles.flying} aria-hidden="true">
      <div ref={ref} className={styles.flyingInner}>
        <BigDie value={value} size={220} />
      </div>
    </div>
  );
}

/** End-of-turn panels (5a with die / 5b without). */
export function EndTurnPanel({
  view,
  onNext,
  onUndo,
  passHint,
}: {
  view: TableView;
  /** Pass the turn from the table. Null when the describer's screen does it instead. */
  onNext: (() => void) | null;
  onUndo: () => void;
  /** Shown instead of the button when the turn is passed on the describer's screen. */
  passHint: string;
}) {
  const t = useT();
  const turn = view.turn!;
  const team = view.teams[turn.teamIndex];
  const move = turn.move!;
  const { valid } = turnSummary(turn);
  const withDie = view.settings.scoring === 'die';
  const next = nextDescriber(view);
  const fromSide = squareColor(move.from);
  const toSide = squareColor(move.to);

  return (
    <div className={styles.column}>
      {withDie ? (
        <>
          <section className={`panel ${styles.diePanel}`}>
            <div className={styles.dieHolder}>
              {turn.settled ? <BigDie value={turn.die} size={132} label={t.dieRolled(turn.die ?? 0)} /> : <span className={styles.dieGhost} />}
            </div>
            <div className={styles.dieText}>
              <h3 className={`eyebrow ${styles.center}`}>{t.dieReturned}</h3>
              <p className={styles.faces}>{t.dieFaces}</p>
            </div>
          </section>
          <section className={`panel ${styles.equationPanel}`}>
            <div className={styles.equation} aria-label={`${valid} − ${turn.die} = ${move.steps}`}>
              <div className={styles.term}>
                <strong className={styles.sideNum} data-side={turn.side}>{valid}</strong>
                <span>{t.validLabel(valid)}</span>
              </div>
              <span className={styles.op}>−</span>
              <div className={styles.term}>
                <strong>{turn.die}</strong>
                <span>{t.dieLabel}</span>
              </div>
              <span className={styles.op}>=</span>
              <div className={styles.term}>
                <strong className={styles.yellowNum}>{move.steps}</strong>
                <span>{t.squaresLabel(move.steps)}</span>
              </div>
            </div>
            <SquareChange from={move.from} to={move.to} />
          </section>
        </>
      ) : (
        <section className={`panel ${styles.equationPanel}`}>
          <h3 className="eyebrow">{t.noDieHeader}</h3>
          <div className={styles.equation} aria-label={`${valid} → +${move.steps}`}>
            <div className={styles.term}>
              <strong className={`${styles.big} ${styles.sideNum}`} data-side={turn.side}>{valid}</strong>
              <span>{t.validLabel(valid)}</span>
            </div>
            <span className={styles.op}>→</span>
            <div className={styles.term}>
              <strong className={`${styles.big} ${styles.yellowNum}`}>+{move.steps}</strong>
              <span>{t.squaresLabel(move.steps)}</span>
            </div>
          </div>
          <SquareChange from={move.from} to={move.to} />
        </section>
      )}

      <CardFlipNotice team={team.name} from={fromSide} to={toSide} settled={turn.settled} />

      {!withDie && (
        <section className={`panel ${styles.sequencePanel}`}>
          <h3 className="eyebrow">{t.sequence}</h3>
          <ol className={styles.sequence}>
            {teamSequence(view).map(({ team: tm, label }) => (
              <li key={tm.id} className={`${styles.seqItem} ${label === 'next' ? styles.seqNext : ''}`} data-label={label}>
                <Pawn color={tm.color} label={teamInitial(tm.name)} size={30} />
                <span className={styles.seqName}>{tm.name}</span>
                <span className={styles.seqLabel}>{t.seqLabel[label]}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className={styles.buttons}>
        {onNext ? (
          <button type="button" className="btn btn-primary btn-lg btn-block" onClick={onNext} disabled={!turn.settled}>
            {turn.settled ? t.passTurn(next.player, next.team.name) : t.pawnMoving}
          </button>
        ) : (
          <p className={styles.passHint} role="status">
            <strong>{t.nextUp(next.player, next.team.name)}</strong>
            <span>{passHint}</span>
          </p>
        )}
        <button type="button" className="btn btn-outline btn-lg btn-block" onClick={onUndo} disabled={!view.canUndo}>
          <UndoIcon size={20} /> {t.undo}
        </button>
      </div>
    </div>
  );
}
