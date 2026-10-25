import { act, render, screen } from '@testing-library/react';
import { useState } from 'react';
import userEvent from '@testing-library/user-event';
import { parsePlayers, type TeamDraft } from '../game/setup';
import { ShuffleTeamsModal } from './ShuffleTeamsModal';

const TEAMS: TeamDraft[] = [
  { name: 'Os Leões', color: 'red', players: 'Ana, Pedro' },
  { name: 'As Gazelas', color: 'green', players: 'Tomás' },
];

describe('ShuffleTeamsModal', () => {
  it('starts with the players already written and splits everyone into the chosen number of teams', async () => {
    const onApply = vi.fn();
    const onClose = vi.fn();
    render(<ShuffleTeamsModal teams={TEAMS} onApply={onApply} onClose={onClose} />);
    const box = screen.getByLabelText('Quem vai jogar');
    expect(box).toHaveValue('Ana, Pedro, Tomás');

    await userEvent.type(box, ', Rita\nJoão\nBia');
    expect(screen.getByText('6 pessoas · 3 por equipa')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: '3' }));
    expect(screen.getByText('6 pessoas · 2 por equipa')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Sortear' }));

    const teams: TeamDraft[] = onApply.mock.calls[0][0];
    expect(teams.map((t) => t.name)).toEqual(['Os Leões', 'As Gazelas', '']);
    expect(teams.flatMap((t) => parsePlayers(t.players)).sort()).toEqual(['Ana', 'Bia', 'João', 'Pedro', 'Rita', 'Tomás']);
    expect(teams.every((t) => parsePlayers(t.players).length === 2)).toBe(true);
    expect(onClose).toHaveBeenCalled();
  });

  it('does not shuffle with too few people', async () => {
    const onApply = vi.fn();
    render(<ShuffleTeamsModal teams={TEAMS} onApply={onApply} onClose={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Sortear' }));
    expect(screen.getByRole('alert')).toHaveTextContent('São precisas pelo menos 4 pessoas (2 por equipa).');
    expect(onApply).not.toHaveBeenCalled();
  });

  it('keeps the cursor in the names box when the page behind re-renders (e.g. a phone connects)', async () => {
    let rerender = () => {};
    function Page() {
      const [, setTick] = useState(0);
      const [open, setOpen] = useState(false);
      rerender = () => setTick((n) => n + 1);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Sortear equipas
          </button>
          {/* A new onClose on every render, as the setup page passes it. */}
          {open && <ShuffleTeamsModal teams={TEAMS} onApply={() => {}} onClose={() => setOpen(false)} />}
        </>
      );
    }
    render(<Page />);
    await userEvent.click(screen.getByRole('button', { name: 'Sortear equipas' }));
    const box = screen.getByLabelText('Quem vai jogar');
    await userEvent.type(box, ', Rita');
    act(() => rerender());
    expect(box).toHaveFocus();
    await userEvent.keyboard(', João');
    expect(box).toHaveValue('Ana, Pedro, Tomás, Rita, João');

    // Closing puts focus back on the button that opened it.
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Sortear equipas' })).toHaveFocus();
  });
});
