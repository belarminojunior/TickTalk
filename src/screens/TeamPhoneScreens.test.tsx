import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createInitialState, gameReducer, type GameAction } from '../game/reducer';
import { phoneView } from '../game/selectors';
import { TEST_CARDS, TWO_TEAMS, settings } from '../test/fixtures';
import { DescriberScreen } from './DescriberScreen';

function state(...actions: GameAction[]) {
  return [
    { type: 'SETUP', settings: settings({ screenMode: 'teamPhones' }), teams: TWO_TEAMS, cards: TEST_CARDS, seed: 1 } as GameAction,
    ...actions,
  ].reduce(gameReducer, createInitialState());
}

function renderPhone(view: ReturnType<typeof phoneView>) {
  const onCommand = vi.fn();
  const onJoinTeam = vi.fn();
  render(
    <DescriberScreen view={view} anchor={0} status="ready" mode="phone" now={() => 0} onCommand={onCommand} onJoinTeam={onJoinTeam} />,
  );
  return { onCommand, onJoinTeam };
}

describe('phone screens (one phone per team)', () => {
  it('a phone without a team picks one; taken teams are disabled', async () => {
    const { onJoinTeam } = renderPhone(phoneView(state(), 0, { teamId: null, refusedTeam: null, takenTeams: ['t1'] }));
    expect(screen.getByRole('heading', { name: 'Qual é a tua equipa?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Os Leões/ })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: /As Gazelas/ }));
    expect(onJoinTeam).toHaveBeenCalledWith('t2');
  });

  it('the other team sees the turn live, without the words', () => {
    const s = state({ type: 'READY' }, { type: 'START_TURN', now: 0 }, { type: 'TOGGLE_WORD', index: 0, now: 1 });
    renderPhone(phoneView(s, 0, { teamId: 't2', refusedTeam: null, takenTeams: ['t1', 't2'] }));
    expect(screen.getByText('Vez dos Leões')).toBeInTheDocument();
    expect(screen.getByText('1 de 10 acertadas')).toBeInTheDocument();
    expect(screen.queryAllByRole('button', { pressed: false })).toHaveLength(0);
    expect(document.body.textContent).not.toMatch(/Yellow\d|Blue\d/);
  });

  it('the checking team validates on its phone', async () => {
    const s = state(
      { type: 'READY' },
      { type: 'START_TURN', now: 0 },
      { type: 'TOGGLE_WORD', index: 0, now: 1 },
      { type: 'TOGGLE_WORD', index: 1, now: 2 },
      { type: 'END_EARLY', now: 3 },
      { type: 'BEGIN_VALIDATION' },
    );
    const { onCommand } = renderPhone(phoneView(s, 0, { teamId: 't2', refusedTeam: null, takenTeams: ['t1', 't2'] }));
    expect(screen.getByRole('heading', { name: 'Validem a vez dos Leões' })).toBeInTheDocument();
    const groups = screen.getAllByRole('group', { name: /^Validar/ });
    expect(groups).toHaveLength(2);
    await userEvent.click(within(groups[0]).getByRole('button', { name: 'Anular' }));
    expect(onCommand).toHaveBeenCalledWith({ type: 'SET_VALIDATION', side: 'blue', index: 0, annulled: true });
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar e lançar o dado' }));
    expect(onCommand).toHaveBeenCalledWith({ type: 'CONFIRM_VALIDATION' });
  });
});
