import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfigProvider } from './config';
import { HostApp } from './HostApp';
import { DEFAULT_SETTINGS } from './game/reducer';
import { saveSetup } from './game/storage';
import type { ScoringMode } from './game/types';

/**
 * End to end in "one screen" mode (LocalTransport): the table and the describer screen
 * live in the same window and talk over the local bus, as they would over the network.
 */
function setup(scoring: ScoringMode) {
  saveSetup({
    settings: { ...DEFAULT_SETTINGS, screenMode: 'single', scoring },
    teams: [
      { name: 'Os Leões', color: 'red', players: 'Ana, Pedro' },
      { name: 'As Gazelas', color: 'green', players: 'Tomás, Rita' },
    ],
  });
  let clock = 0;
  // 0.5 → face 3 of [0, 0, 1, 1, 2, 2] → the die rolls 1.
  const rng = vi.fn(() => 0.5);
  const user = userEvent.setup();
  render(
    <ConfigProvider config={{ now: () => clock, rng, seed: () => 7, animationScale: 0 }}>
      <HostApp />
    </ConfigProvider>,
  );
  return {
    rng,
    user,
    setClock: (ms: number) => {
      clock = ms;
    },
  };
}

/** Word buttons on the face-up side (the other face is hidden from the accessibility tree). */
const faceUpWords = () => screen.getAllByRole('button', { pressed: false }).concat(screen.queryAllByRole('button', { pressed: true }));
const faceUp = () => document.querySelector('main [data-up]')?.getAttribute('data-up');

/** Marks the word at `index` on whichever side is up; the card then turns over. */
async function markWord(user: ReturnType<typeof userEvent.setup>, index: number) {
  const before = faceUp();
  const word = [...document.querySelectorAll<HTMLButtonElement>('main section[data-side] button[aria-pressed]')].filter(
    (b) => b.closest('section')?.getAttribute('data-side') === before,
  )[index];
  await user.click(word);
  await waitFor(() => expect(faceUp()).not.toBe(before));
}

async function readyAndStart(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Estou pronto/a' }));
  await user.click(await screen.findByRole('button', { name: 'Começar' }));
  await waitFor(() => expect(screen.getAllByRole('button', { pressed: false })).toHaveLength(5));
}

function teamCard(name: string) {
  return screen.getAllByRole('listitem').find((li) => within(li).queryByText(name, { selector: 'strong' }))!;
}

function cardSide(): string | null {
  const words = screen.getAllByRole('button', { pressed: false })[0];
  return words.closest('section[data-side]')?.getAttribute('data-side') ?? null;
}

async function playTurnEndingEarly(user: ReturnType<typeof userEvent.setup>, validator: RegExp, confirm: string) {
  await readyAndStart(user);
  await user.click(screen.getByRole('button', { name: 'Terminar a vez' }));
  await screen.findByRole('heading', { name: validator });
  await user.click(screen.getByRole('button', { name: confirm }));
  return screen.findByRole('button', { name: /Passar a vez/ }, { timeout: 3000 });
}

describe('full game (one screen)', () => {
  it('with die: 3 marked − 1 cancelled − die 1 = square 1, and the card stays blue', async () => {
    const { user, rng, setClock } = setup('die');
    await user.click(screen.getByRole('button', { name: 'Começar o jogo' }));

    // The Lions' turn: Ana describes.
    expect(await screen.findByText('Passa o ecrã a Ana')).toBeInTheDocument();
    await readyAndStart(user);
    expect(cardSide()).toBe('blue');
    expect(faceUpWords()).toHaveLength(5);
    // Each correct word turns the card over: blue 1 → yellow 3 → blue 4.
    for (const [i, at] of [[0, 2000], [2, 5000], [3, 9000]]) {
      setClock(at);
      await markWord(user, i);
    }
    expect(faceUp()).toBe('yellow');
    await waitFor(() => expect(screen.getByRole('heading', { name: '3 de 10 acertadas' })).toBeInTheDocument());

    // Time runs out.
    act(() => setClock(31_000));
    const title = await screen.findByRole('heading', { name: 'As Gazelas validam a vez dos Leões' }, { timeout: 3000 });
    expect(title).toBeInTheDocument();
    // Both sides of the card are shown: 3 guessed, 7 not.
    expect(screen.getAllByText('não acertada')).toHaveLength(7);

    // The other team cancels one word.
    const groups = screen.getAllByRole('group', { name: /^Validar/ });
    expect(groups).toHaveLength(3);
    await user.click(within(groups[1]).getByRole('button', { name: 'Anular' }));
    expect(screen.getByText('palavras válidas').parentElement?.querySelector('strong')).toHaveTextContent('2');

    // Die = 1 → 2 − 1 = 1 square.
    await user.click(screen.getByRole('button', { name: 'Confirmar e lançar o dado' }));
    const pass = await screen.findByRole('button', { name: 'Passar a vez · Tomás (As Gazelas)' }, { timeout: 3000 });
    expect(rng).toHaveBeenCalledTimes(1);
    expect(screen.getByText('O dado voltou')).toBeInTheDocument();
    expect(within(teamCard('Os Leões')).getByText('1')).toBeInTheDocument();
    expect(screen.getByText('A carta continua azul')).toBeInTheDocument();
    expect(screen.getByTestId('board-die')).toHaveTextContent('1');

    // The Gazelles' turn (no words), checked by the Lions.
    await user.click(pass);
    expect(await screen.findByText('Passa o ecrã a Tomás')).toBeInTheDocument();
    await playTurnEndingEarly(user, /Os Leões validam a vez das Gazelas/, 'Confirmar e lançar o dado');
    await user.click(screen.getByRole('button', { name: 'Passar a vez · Pedro (Os Leões)' }));

    // Back to the Lions on square 1 (blue): the card stays on the blue side.
    expect(await screen.findByText('Os Leões · casa 1 · lado azul')).toBeInTheDocument();
    await readyAndStart(user);
    expect(cardSide()).toBe('blue');
    expect(screen.getByText(/^Lado azul · carta \d+$/)).toBeInTheDocument();
  });

  it('no die: 2 valid → square 2 (yellow), no die shown, and the card flips to yellow', async () => {
    const { user, rng, setClock } = setup('noDie');
    await user.click(screen.getByRole('button', { name: 'Começar o jogo' }));

    await readyAndStart(user);
    for (const i of [0, 1, 4]) {
      setClock(1000 * (i + 1));
      await markWord(user, i);
    }
    act(() => setClock(31_000));
    await screen.findByRole('heading', { name: 'As Gazelas validam a vez dos Leões' }, { timeout: 3000 });
    const groups = screen.getAllByRole('group', { name: /^Validar/ });
    await user.click(within(groups[0]).getByRole('button', { name: 'Anular' }));

    await user.click(screen.getByRole('button', { name: 'Confirmar e avançar' }));
    const pass = await screen.findByRole('button', { name: 'Passar a vez · Tomás (As Gazelas)' }, { timeout: 3000 });
    expect(screen.queryByText('A lançar o dado…')).not.toBeInTheDocument();
    expect(screen.queryByText('O dado voltou')).not.toBeInTheDocument();
    expect(screen.queryByTestId('board-die')?.parentElement).toHaveStyle({ visibility: 'hidden' });
    expect(within(teamCard('Os Leões')).getByText('2')).toBeInTheDocument();
    expect(screen.getByText('A carta vira para o amarelo')).toBeInTheDocument();
    // Once the pawn has landed, the table's two-sided card has turned over to yellow.
    const tableCard = screen.getByText('A carta vira para o amarelo').closest('section')!.querySelector('[data-up]');
    expect(tableCard).toHaveAttribute('data-up', 'yellow');

    // Team order: the Lions just played, the Gazelles are next.
    const sequence = screen.getByRole('heading', { name: 'Sequência das equipas' }).parentElement!;
    const items = within(sequence).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Os Leõesjogou agora');
    expect(items[1]).toHaveTextContent('As Gazelasa seguir');

    await user.click(pass);
    await playTurnEndingEarly(user, /Os Leões validam a vez das Gazelas/, 'Confirmar e avançar');
    await user.click(screen.getByRole('button', { name: 'Passar a vez · Pedro (Os Leões)' }));

    expect(await screen.findByText('Os Leões · casa 2 · lado amarelo')).toBeInTheDocument();
    expect(screen.getByText('A carta virou para o lado amarelo')).toBeInTheDocument();
    // The turn starts on the yellow side, and a correct word turns it over to blue.
    expect(faceUp()).toBe('yellow');
    await readyAndStart(user);
    expect(cardSide()).toBe('yellow');
    await markWord(user, 0);
    expect(faceUp()).toBe('blue');
    expect(rng).not.toHaveBeenCalled();
  });
});
