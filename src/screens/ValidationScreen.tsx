import { Board, type BoardPawn } from '../components/Board';
import { CardFace } from '../components/Card';
import { ArrowRightIcon, DiceIcon } from '../components/Icons';
import { sideVars } from '../components/TablePanels';
import { RulesList, ValidationRow } from '../components/ValidationRow';
import { otherSide } from '../game/reducer';
import { turnSummary, validatorTeam, type TableView } from '../game/selectors';
import type { Side } from '../game/types';
import { useT } from '../i18n';
import styles from './ValidationScreen.module.css';

/** The next team checks the turn: the revealed card, Valid | Cancel, then confirm. */
export function ValidationScreen({
  view,
  pawns,
  onSet,
  onConfirm,
  checkedOnPhone = false,
}: {
  view: TableView;
  pawns: BoardPawn[];
  onSet: (side: Side, index: number, annulled: boolean) => void;
  onConfirm: () => void;
  /** One phone per team: the checking team validates on its phone; the table only follows. */
  checkedOnPhone?: boolean;
}) {
  const t = useT();
  const turn = view.turn!;
  const team = view.teams[turn.teamIndex];
  const validator = validatorTeam(view);
  const { marked, annulled, valid } = turnSummary(turn);
  const withDie = view.settings.scoring === 'die';
  // The side the turn started on comes first.
  const sides: Side[] = [turn.side, otherSide(turn.side)];

  return (
    <div className={styles.screen}>
      <div className={styles.background} aria-hidden="true">
        <Board blurred pawns={pawns} die={view.lastDie} showDie={withDie} />
        <div className={styles.scrim} />
      </div>

      <div className={styles.content}>
        <header className={styles.head}>
          <span className={styles.pill}>{t.timeUpPill}</span>
          <h1 className={styles.title}>{t.validatesTitle(validator.name, team.name)}</h1>
          <p className={styles.subtitle}>{t.validateSubtitle(turn.describer, withDie)}</p>
        </header>

        <div className={styles.grid}>
          <div className={styles.cards}>
            {sides.map((side) => (
              <CardFace key={side} side={side} header={t.cardHeader(side, turn.cardNumber)} className={styles.card}>
                <ul className={styles.rows} style={sideVars(side)}>
                  {(turn.words?.[side] ?? []).map((word, i) => (
                    <ValidationRow
                      key={i}
                      index={i}
                      word={word}
                      marked={turn.marked[side][i]}
                      annulled={turn.annulled[side][i]}
                      onChange={(index, annulled) => onSet(side, index, annulled)}
                      readOnly={checkedOnPhone}
                      compact
                    />
                  ))}
                </ul>
              </CardFace>
            ))}
          </div>

          <aside className={styles.side}>
            <section className={`panel ${styles.result}`} style={sideVars(turn.side)}>
              <h2 className="eyebrow">{t.turnResult}</h2>
              <p className={styles.sum}>
                <b>{marked}</b> {t.markedWord(marked)} <span className={styles.minus}>−</span>{' '}
                <b className={styles.annulledNum}>{annulled}</b> {t.annulledWord(annulled)}
              </p>
              <div className={styles.validBox} aria-live="polite">
                <strong>{valid}</strong> <span>{t.validWords(valid)}</span>
              </div>
            </section>
            <RulesList />
            {checkedOnPhone ? (
              <p className={styles.onPhone} role="status">
                {t.validatingOnPhone(validator.name)}
              </p>
            ) : (
              <button type="button" className="btn btn-primary btn-lg btn-block" onClick={onConfirm} autoFocus>
                {withDie ? <DiceIcon size={24} /> : <ArrowRightIcon size={24} />}
                {withDie ? t.confirmRoll : t.confirmAdvance}
              </button>
            )}
            <p className={styles.note}>{t.finalNote}</p>
          </aside>
        </div>
      </div>
    </div>
  );
}
