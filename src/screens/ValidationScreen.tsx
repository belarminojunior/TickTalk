import { Board, type BoardPawn } from '../components/Board';
import { CardFace } from '../components/Card';
import { ArrowRightIcon, DiceIcon } from '../components/Icons';
import { sideVars } from '../components/TablePanels';
import { RulesList, ValidationRow } from '../components/ValidationRow';
import { turnSummary, validatorTeam, type TableView } from '../game/selectors';
import { useT } from '../i18n';
import styles from './ValidationScreen.module.css';

/** A equipa seguinte valida a vez: a carta revelada, Válida | Anular, e confirmar. */
export function ValidationScreen({
  view,
  pawns,
  onSet,
  onConfirm,
}: {
  view: TableView;
  pawns: BoardPawn[];
  onSet: (index: number, annulled: boolean) => void;
  onConfirm: () => void;
}) {
  const t = useT();
  const turn = view.turn!;
  const team = view.teams[turn.teamIndex];
  const validator = validatorTeam(view);
  const { marked, annulled, valid } = turnSummary(turn);
  const withDie = view.settings.scoring === 'die';
  const words = turn.words ?? [];

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
          <CardFace side={turn.side} header={t.cardHeader(turn.side, turn.cardNumber)} className={styles.card}>
            <ul className={styles.rows} style={sideVars(turn.side)}>
              {words.map((word, i) => (
                <ValidationRow
                  key={i}
                  index={i}
                  word={word}
                  marked={turn.marked[i]}
                  annulled={turn.annulled[i]}
                  onChange={onSet}
                />
              ))}
            </ul>
          </CardFace>

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
            <button type="button" className="btn btn-primary btn-lg btn-block" onClick={onConfirm} autoFocus>
              {withDie ? <DiceIcon size={24} /> : <ArrowRightIcon size={24} />}
              {withDie ? t.confirmRoll : t.confirmAdvance}
            </button>
            <p className={styles.note}>{t.finalNote}</p>
          </aside>
        </div>
      </div>
    </div>
  );
}
