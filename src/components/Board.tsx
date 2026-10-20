import { forwardRef, type CSSProperties } from 'react';
import { BOARD_PATH } from '../game/board';
import type { PawnColor } from '../game/types';
import { useT } from '../i18n';
import { ArrowRightIcon, FlagIcon } from './Icons';
import { Pawn } from './Pawn';
import { Square } from './Square';
import { BoardDie } from './BoardDie';
import styles from './Board.module.css';

export interface BoardPawn {
  id: string;
  name: string;
  color: PawnColor;
  label: string;
  /** 0 = Partida, 1..36. */
  position: number;
}

export interface BoardProps {
  pawns: BoardPawn[];
  /** Último valor do dado (ou null). */
  die?: number | null;
  showDie?: boolean;
  /** Casa de destino em destaque. */
  highlight?: number | null;
  /** Peão que está a saltar (anima cada mudança de casa). */
  movingId?: string | null;
  /** Versão desfocada, só decorativa. */
  blurred?: boolean;
  className?: string;
}

function pawnSize(count: number): string {
  if (count <= 1) return '4.7cqw';
  if (count === 2) return '3.6cqw';
  if (count <= 4) return '3.1cqw';
  return '2.5cqw';
}

/** O tabuleiro: grelha 10 × 7 com o percurso em dois "U" ligados por uma ponte. */
export const Board = forwardRef<HTMLDivElement, BoardProps>(function Board(
  { pawns, die = null, showDie = true, highlight = null, movingId = null, blurred = false, className },
  dieRef,
) {
  const t = useT();
  const at = (square: number) => pawns.filter((p) => Math.min(36, p.position) === square);

  const renderPawns = (list: BoardPawn[], startTile = false) =>
    list.length > 0 && (
      <div className={`${styles.pawns} ${startTile ? styles.pawnsStart : ''}`} data-count={list.length}>
        {list.map((p) => (
          <span
            key={movingId === p.id ? `${p.id}-${p.position}` : p.id}
            className={`${styles.pawnSlot} ${movingId === p.id ? styles.hop : ''}`}
            data-pawn={p.id}
          >
            <Pawn color={p.color} label={p.label} size={startTile ? '4.2cqw' : pawnSize(list.length)} />
          </span>
        ))}
      </div>
    );

  const summary = pawns.map((p) => `${p.name}: ${t.squareN(p.position)}`).join('; ');

  return (
    <div
      className={`${styles.wrap} ${blurred ? styles.blurred : ''} ${className ?? ''}`}
      aria-hidden={blurred || undefined}
    >
      <div className={styles.board} role={blurred ? undefined : 'img'} aria-label={blurred ? undefined : summary}>
        {BOARD_PATH.map((cell, i) => {
          const n = i + 1;
          return (
            <Square key={n} number={n} cell={cell} highlight={highlight === n}>
              {renderPawns(at(n))}
            </Square>
          );
        })}

        <div className={`${styles.tile} ${styles.start} ${highlight === 0 ? styles.highlight : ''}`}>
          <span className={styles.tileLabel}>{t.startSquare}</span>
          <ArrowRightIcon className={styles.tileIcon} size="100%" strokeWidth={2.4} />
          {renderPawns(at(0), true)}
        </div>
        <div className={`${styles.tile} ${styles.finish}`}>
          <FlagIcon className={styles.tileIcon} size="100%" strokeWidth={2.4} />
          <span className={styles.tileLabel}>{t.finishSquare}</span>
        </div>

        <div className={`${styles.title} ${styles.titleLeft}`} aria-hidden="true">
          <span>TICK TALK</span>
        </div>
        <div className={`${styles.title} ${styles.titleRight}`} aria-hidden="true">
          <span>TICK TALK</span>
        </div>

        <div className={styles.dieSpot} style={{ visibility: showDie && die !== null ? 'visible' : 'hidden' } as CSSProperties}>
          <BoardDie ref={dieRef} value={die ?? 0} />
        </div>
      </div>
    </div>
  );
});
