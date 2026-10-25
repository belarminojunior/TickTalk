import { UndoIcon } from '../components/Icons';
import { Pawn, teamInitial } from '../components/Pawn';
import { CardFlipNotice, SquareChange } from '../components/TablePanels';
import { squareColor } from '../game/board';
import { nextDescriber, teamSequence, turnSummary, type TableView } from '../game/selectors';
import { useT } from '../i18n';
import styles from './EndTurnPanel.module.css';

/** End of the turn on the table: valid words → squares, the card side, and who plays next. */
export function EndTurnPanel({
  view,
  onNext,
  onUndo,
  passHint,
}: {
  view: TableView;
  /** Pass the turn from the table. Null when the describer's phone does it instead. */
  onNext: (() => void) | null;
  /** Back to validation (one phone per team). Null when there is nothing to go back to. */
  onUndo: (() => void) | null;
  /** Shown instead of the button when the turn is passed on the describer's phone. */
  passHint: string;
}) {
  const t = useT();
  const turn = view.turn!;
  const team = view.teams[turn.teamIndex];
  const move = turn.move!;
  const { valid } = turnSummary(turn);
  const next = nextDescriber(view);

  return (
    <div className={styles.column}>
      <section className={`panel ${styles.equationPanel}`}>
        <h3 className="eyebrow">{t.onePerWordHeader}</h3>
        <div className={styles.equation} aria-label={`${valid} → +${move.steps}`}>
          <div className={styles.term}>
            <strong className={styles.sideNum} data-side={turn.side}>
              {valid}
            </strong>
            <span>{t.validLabel(valid)}</span>
          </div>
          <span className={styles.op}>→</span>
          <div className={styles.term}>
            <strong className={styles.yellowNum}>+{move.steps}</strong>
            <span>{t.squaresLabel(move.steps)}</span>
          </div>
        </div>
        <SquareChange from={move.from} to={move.to} />
      </section>

      <CardFlipNotice team={team.name} from={squareColor(move.from)} to={squareColor(move.to)} settled={turn.settled} />

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
        {onUndo && (
          <button type="button" className="btn btn-outline btn-lg btn-block" onClick={onUndo} disabled={!view.canUndo}>
            <UndoIcon size={20} /> {t.undo}
          </button>
        )}
      </div>
    </div>
  );
}
