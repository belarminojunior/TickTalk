import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfigProvider } from './config';
import { HostApp } from './HostApp';
import { DEFAULT_SETTINGS } from './game/reducer';
import { saveSetup } from './game/storage';
import type { ScoringMode } from './game/types';

/**
 * Ponta a ponta no modo "um só ecrã" (LocalTransport): a mesa e a tela de quem explica
 * vivem na mesma janela e falam pelo barramento local, como falariam pela rede.
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
  // 0.5 → face 3 de [0, 0, 1, 1, 2, 2] → o dado dá 1.
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

const wordButtons = () => screen.getAllByRole('button', { pressed: false }).concat(screen.queryAllByRole('button', { pressed: true }));

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

describe('jogo completo (um só ecrã)', () => {
  it('com dado: 3 marcadas − 1 anulada − dado 1 = casa 1, e a carta continua azul', async () => {
    const { user, rng, setClock } = setup('die');
    await user.click(screen.getByRole('button', { name: 'Começar o jogo' }));

    // Vez dos Leões: a Ana explica.
    expect(await screen.findByText('Passa o ecrã a Ana')).toBeInTheDocument();
    await readyAndStart(user);
    expect(cardSide()).toBe('blue');
    const words = wordButtons();
    for (const [i, at] of [[0, 2000], [2, 5000], [3, 9000]]) {
      setClock(at);
      await user.click(words[i]);
    }
    await waitFor(() => expect(screen.getByRole('heading', { name: '3 de 5 acertadas' })).toBeInTheDocument());

    // O tempo acaba.
    act(() => setClock(31_000));
    const title = await screen.findByRole('heading', { name: 'As Gazelas validam a vez dos Leões' }, { timeout: 3000 });
    expect(title).toBeInTheDocument();
    expect(screen.getAllByText('não acertada')).toHaveLength(2);

    // A adversária anula uma palavra.
    const groups = screen.getAllByRole('group', { name: /^Validar/ });
    expect(groups).toHaveLength(3);
    await user.click(within(groups[1]).getByRole('button', { name: 'Anular' }));
    expect(screen.getByText('palavras válidas').parentElement?.querySelector('strong')).toHaveTextContent('2');

    // Dado = 1 → 2 − 1 = 1 casa.
    await user.click(screen.getByRole('button', { name: 'Confirmar e lançar o dado' }));
    const pass = await screen.findByRole('button', { name: 'Passar a vez · Tomás (As Gazelas)' }, { timeout: 3000 });
    expect(rng).toHaveBeenCalledTimes(1);
    expect(screen.getByText('O dado voltou')).toBeInTheDocument();
    expect(within(teamCard('Os Leões')).getByText('1')).toBeInTheDocument();
    expect(screen.getByText('A carta continua azul')).toBeInTheDocument();
    expect(screen.getByTestId('board-die')).toHaveTextContent('1');

    // Vez das Gazelas (nenhuma palavra), validada pelos Leões.
    await user.click(pass);
    expect(await screen.findByText('Passa o ecrã a Tomás')).toBeInTheDocument();
    await playTurnEndingEarly(user, /Os Leões validam a vez das Gazelas/, 'Confirmar e lançar o dado');
    await user.click(screen.getByRole('button', { name: 'Passar a vez · Pedro (Os Leões)' }));

    // De volta aos Leões, na casa 1 (azul): a carta continua no lado azul.
    expect(await screen.findByText('Os Leões · casa 1 · lado azul')).toBeInTheDocument();
    await readyAndStart(user);
    expect(cardSide()).toBe('blue');
    expect(screen.getByText(/^Lado azul · carta \d+$/)).toBeInTheDocument();
  });

  it('sem dado: 2 válidas → casa 2 (amarela), sem dado, e a carta vira para o amarelo', async () => {
    const { user, rng, setClock } = setup('noDie');
    await user.click(screen.getByRole('button', { name: 'Começar o jogo' }));

    await readyAndStart(user);
    const words = wordButtons();
    for (const i of [0, 1, 4]) {
      setClock(1000 * (i + 1));
      await user.click(words[i]);
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

    // Sequência das equipas: Leões jogaram agora, Gazelas a seguir.
    const sequence = screen.getByRole('heading', { name: 'Sequência das equipas' }).parentElement!;
    const items = within(sequence).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Os Leõesjogou agora');
    expect(items[1]).toHaveTextContent('As Gazelasa seguir');

    await user.click(pass);
    await playTurnEndingEarly(user, /Os Leões validam a vez das Gazelas/, 'Confirmar e avançar');
    await user.click(screen.getByRole('button', { name: 'Passar a vez · Pedro (Os Leões)' }));

    expect(await screen.findByText('Os Leões · casa 2 · lado amarelo')).toBeInTheDocument();
    expect(screen.getByText('A carta virou para o lado amarelo')).toBeInTheDocument();
    await readyAndStart(user);
    expect(cardSide()).toBe('yellow');
    expect(rng).not.toHaveBeenCalled();
  });
});
