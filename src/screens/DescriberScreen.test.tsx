import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createInitialState, gameReducer, type GameAction } from '../game/reducer';
import { describerView } from '../game/selectors';
import type { GameState } from '../game/types';
import { TEST_CARDS, TWO_TEAMS, settings } from '../test/fixtures';
import { DescriberScreen } from './DescriberScreen';

function endOfTurnState(settled: boolean): GameState {
  const actions: GameAction[] = [
    { type: 'SETUP', settings: settings({ screenMode: 'phone' }), teams: TWO_TEAMS, cards: TEST_CARDS, seed: 1 },
    { type: 'READY' },
    { type: 'START_TURN', now: 0 },
    { type: 'TOGGLE_WORD', index: 0, now: 1 },
    { type: 'END_EARLY', now: 2 },
    { type: 'BEGIN_VALIDATION' },
  ];
  if (settled) actions.push({ type: 'MOVE_DONE' });
  return actions.reduce(gameReducer, createInitialState());
}

describe('DescriberScreen', () => {
  it('passes the turn from the describer screen once the pawn has landed', async () => {
    const onCommand = vi.fn();
    const { rerender } = render(
      <DescriberScreen view={describerView(endOfTurnState(false), 0)} anchor={0} status="ready" mode="phone" now={() => 0} onCommand={onCommand} />,
    );
    expect(screen.getByRole('button', { name: 'O peão está a andar…' })).toBeDisabled();

    rerender(
      <DescriberScreen view={describerView(endOfTurnState(true), 0)} anchor={0} status="ready" mode="phone" now={() => 0} onCommand={onCommand} />,
    );
    expect(screen.getByText('A seguir: Tomás (As Gazelas)')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Passar a vez · Tomás (As Gazelas)' }));
    expect(onCommand).toHaveBeenCalledWith({ type: 'NEXT_TEAM' });
  });

  it('asks for the room code when the phone has none, and says when a code is wrong', async () => {
    const onRoom = vi.fn();
    const { rerender } = render(
      <DescriberScreen view={null} anchor={0} status="connecting" mode="phone" now={() => 0} onCommand={vi.fn()} room={null} onRoom={onRoom} />,
    );
    expect(screen.getByRole('heading', { name: 'Em que sala vais jogar?' })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Código da sala'), 'kq');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(screen.getByText('O código tem 4 letras.')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Código da sala'), 'tr');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(onRoom).toHaveBeenCalledWith('KQTR');

    rerender(<DescriberScreen view={null} anchor={0} status="noRoom" mode="phone" now={() => 0} onCommand={vi.fn()} room="ZZZZ" onRoom={onRoom} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Não encontrei a sala ZZZZ.');
  });
});
