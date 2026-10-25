import { act, queries, render, waitFor, within, type BoundFunctions } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfigProvider, useConfig } from './config';
import { HostApp } from './HostApp';
import { DEFAULT_SETTINGS } from './game/reducer';
import { saveSetup } from './game/storage';
import type { ScoringMode, ScreenMode } from './game/types';
import { useDescriberClient } from './hooks/useTransport';
import { I18nProvider } from './i18n';
import { LocalBus, LocalTransport } from './net/local';
import { HOST_ID, type Transport } from './net/transport';
import { DescriberScreen } from './screens/DescriberScreen';

/**
 * End to end: the real table (HostApp) and simulated phones, talking over an in-memory
 * transport exactly as they would over the WebSocket server.
 */

type User = ReturnType<typeof userEvent.setup>;
type Scope = BoundFunctions<typeof queries>;

/** A phone: the same screen the real /explicar page shows, on its own transport. */
function TestPhone({ transport }: { transport: Transport }) {
  const config = useConfig();
  const client = useDescriberClient(transport, config.now);
  return (
    <I18nProvider language="pt">
      <DescriberScreen
        view={client.view}
        anchor={client.anchor}
        status={client.status}
        mode={client.view?.mode ?? 'phone'}
        now={config.now}
        onCommand={client.send}
        onJoinTeam={client.joinTeam}
      />
    </I18nProvider>
  );
}

function setup(scoring: ScoringMode, mode: ScreenMode = 'phone', phones = 1) {
  saveSetup({
    settings: { ...DEFAULT_SETTINGS, screenMode: mode, scoring },
    teams: [
      { name: 'Os Leões', color: 'red', players: 'Ana, Pedro' },
      { name: 'As Gazelas', color: 'green', players: 'Tomás, Rita' },
    ],
  });
  let clock = 0;
  // 0.5 → face 3 of [0, 0, 1, 1, 2, 2] → the die rolls 1.
  const rng = vi.fn(() => 0.5);
  const user = userEvent.setup();
  const bus = new LocalBus();
  const config = {
    now: () => clock,
    rng,
    seed: () => 7,
    animationScale: 0,
    createHostTransport: () => new LocalTransport(bus, HOST_ID),
  };
  const table = render(
    <ConfigProvider config={config}>
      <HostApp />
    </ConfigProvider>,
  );
  const phoneScopes = Array.from({ length: phones }, (_, i) => {
    const { container } = render(
      <ConfigProvider config={config}>
        <TestPhone transport={new LocalTransport(bus, `phone-${i + 1}`)} />
      </ConfigProvider>,
    );
    return within(container);
  });
  return {
    rng,
    user,
    table: within(table.container),
    phones: phoneScopes,
    setClock: (ms: number) => {
      clock = ms;
    },
  };
}

const faceUp = (phone: Scope) => phone.queryByRole('main')?.querySelector('[data-up]')?.getAttribute('data-up');

/** Marks the word at `index` on whichever side is up; the card then turns over. */
async function markWord(user: User, phone: Scope, index: number) {
  const before = faceUp(phone);
  const words = [...phone.getByRole('main').querySelectorAll<HTMLButtonElement>('section[data-side] button[aria-pressed]')];
  await user.click(words.filter((b) => b.closest('section')?.getAttribute('data-side') === before)[index]);
  await waitFor(() => expect(faceUp(phone)).not.toBe(before));
}

async function readyAndStart(user: User, phone: Scope) {
  await user.click(await phone.findByRole('button', { name: 'Estou pronto/a' }));
  await user.click(await phone.findByRole('button', { name: 'Começar' }));
  await waitFor(() => expect(phone.getAllByRole('button', { pressed: false })).toHaveLength(5));
}

function teamCard(table: Scope, name: string) {
  return table.getAllByRole('listitem').find((li: HTMLElement) => within(li).queryByText(name, { selector: 'strong' }))!;
}

function cardSide(phone: Scope): string | null {
  return phone.getAllByRole('button', { pressed: false })[0].closest('section[data-side]')?.getAttribute('data-side') ?? null;
}

async function passTurn(user: User, phone: Scope, name: string) {
  await user.click(await phone.findByRole('button', { name }, { timeout: 3000 }));
}

/** A turn with no words, ended early, checked on the table. */
async function emptyTurn(user: User, table: Scope, phone: Scope, validator: RegExp, confirm: string) {
  await readyAndStart(user, phone);
  await user.click(phone.getByRole('button', { name: 'Terminar a vez' }));
  await table.findByRole('heading', { name: validator }, { timeout: 3000 });
  await user.click(table.getByRole('button', { name: confirm }));
}

describe('full game (PC + phone)', () => {
  it('with die: 3 marked − 1 cancelled − die 1 = square 1 (yellow), and the card flips to yellow', async () => {
    const { user, rng, setClock, table, phones } = setup('die');
    const [phone] = phones;
    await user.click(table.getByRole('button', { name: 'Começar o jogo' }));

    // The Lions' turn: Ana describes on the phone; the table says who has the phone.
    expect(await phone.findByText('Passa o telemóvel a Ana')).toBeInTheDocument();
    expect(table.getByText('Passa o telemóvel a Ana (Os Leões)')).toBeInTheDocument();
    await readyAndStart(user, phone);
    expect(cardSide(phone)).toBe('blue');
    // Each correct word turns the card over: blue 1 → yellow 3 → blue 4.
    for (const [i, at] of [[0, 2000], [2, 5000], [3, 9000]]) {
      setClock(at);
      await markWord(user, phone, i);
    }
    expect(faceUp(phone)).toBe('yellow');
    expect(await phone.findByRole('heading', { name: '3 de 10 acertadas' })).toBeInTheDocument();
    // The table follows live, without the words.
    await waitFor(() => expect(table.getByTestId('live-count')).toHaveTextContent('3'));

    // Time runs out: the table shows the card to the other team.
    act(() => setClock(31_000));
    await table.findByRole('heading', { name: 'As Gazelas validam a vez dos Leões' }, { timeout: 3000 });
    expect(table.getAllByText('não acertada')).toHaveLength(7);
    expect(await phone.findByText('Tempo! Olha para a mesa.')).toBeInTheDocument();

    const groups = table.getAllByRole('group', { name: /^Validar/ });
    expect(groups).toHaveLength(3);
    // The pawn moved one square per correct word: 3, until a word is cancelled.
    expect(within(teamCard(table, 'Os Leões')).getByText('3')).toBeInTheDocument();
    await user.click(within(groups[1]).getByRole('button', { name: 'Anular' }));
    expect(within(teamCard(table, 'Os Leões')).getByText('2')).toBeInTheDocument();

    // Die = 1 → 2 − 1 = 1 square. The describer passes the turn on the phone.
    await user.click(table.getByRole('button', { name: 'Confirmar e lançar o dado' }));
    await passTurn(user, phone, 'Passar a vez · Tomás (As Gazelas)');
    expect(rng).toHaveBeenCalledTimes(1);
    expect(table.getByTestId('board-die')).toHaveTextContent('1');
    expect(within(teamCard(table, 'Os Leões')).getByText('1')).toBeInTheDocument();

    // The Gazelles' turn (no words), checked by the Lions on the table.
    expect(await phone.findByText('Passa o telemóvel a Tomás')).toBeInTheDocument();
    await emptyTurn(user, table, phone, /Os Leões validam a vez das Gazelas/, 'Confirmar e lançar o dado');
    await passTurn(user, phone, 'Passar a vez · Pedro (Os Leões)');

    // Back to the Lions on square 1 (yellow): the turn starts on the yellow side.
    expect(await phone.findByText('Os Leões · casa 1 · lado amarelo')).toBeInTheDocument();
    await readyAndStart(user, phone);
    expect(cardSide(phone)).toBe('yellow');
  });

  it('no die: 2 valid → square 2 (blue), no die roll, and the card stays blue', async () => {
    const { user, rng, setClock, table, phones } = setup('noDie');
    const [phone] = phones;
    await user.click(table.getByRole('button', { name: 'Começar o jogo' }));

    await readyAndStart(user, phone);
    for (const i of [0, 1, 4]) {
      setClock(1000 * (i + 1));
      await markWord(user, phone, i);
    }
    act(() => setClock(31_000));
    await table.findByRole('heading', { name: 'As Gazelas validam a vez dos Leões' }, { timeout: 3000 });
    await user.click(within(table.getAllByRole('group', { name: /^Validar/ })[0]).getByRole('button', { name: 'Anular' }));
    await user.click(table.getByRole('button', { name: 'Confirmar e avançar' }));

    await phone.findByRole('button', { name: 'Passar a vez · Tomás (As Gazelas)' }, { timeout: 3000 });
    expect(table.queryByText('O dado voltou')).not.toBeInTheDocument();
    expect(within(teamCard(table, 'Os Leões')).getByText('2')).toBeInTheDocument();
    expect(table.getByText('A carta continua azul')).toBeInTheDocument();
    // The table has no pass button while the phone is connected.
    expect(table.queryByRole('button', { name: /Passar a vez/ })).not.toBeInTheDocument();
    expect(table.getByText('Quem explica passa a vez no telemóvel.')).toBeInTheDocument();
    expect(rng).not.toHaveBeenCalled();
  });

  it('can leave the game mid-turn (after confirming) and pick it up again', async () => {
    const { user, table, phones } = setup('die');
    const [phone] = phones;
    await user.click(table.getByRole('button', { name: 'Começar o jogo' }));
    await readyAndStart(user, phone);

    await user.click(table.getByRole('button', { name: 'Sair' }));
    expect(table.getByRole('dialog', { name: 'Sair do jogo?' })).toBeInTheDocument();
    await user.click(table.getByRole('button', { name: 'Continuar a jogar' }));
    expect(table.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(table.getByRole('button', { name: 'Sair' }));
    await user.click(table.getByRole('button', { name: 'Sair do jogo' }));
    expect(await table.findByRole('button', { name: 'Começar o jogo' })).toBeInTheDocument();
    expect(await phone.findByText('À espera que o jogo comece…')).toBeInTheDocument();

    // The game was saved; it comes back paused, in the middle of the same turn.
    await user.click(table.getByRole('button', { name: 'Continuar jogo guardado' }));
    expect((await phone.findAllByRole('button', { name: /Retomar/ })).length).toBeGreaterThan(0);
  });
});

describe('full game (one phone per team)', () => {
  it('the other team validates on its own phone; the table never shows the validation', async () => {
    const { user, setClock, table, phones } = setup('die', 'teamPhones', 2);
    const [lions, gazelles] = phones;
    await user.click(table.getByRole('button', { name: 'Começar o jogo' }));

    // Each phone picks its team.
    await user.click(await lions.findByRole('button', { name: /Os Leões/ }));
    await user.click(await gazelles.findByRole('button', { name: /As Gazelas/ }));
    await waitFor(() => expect(table.getAllByText('telemóvel ligado')).toHaveLength(2));

    // The Lions play; the Gazelles' phone follows without the words.
    await readyAndStart(user, lions);
    setClock(1000);
    await markWord(user, lions, 0);
    setClock(2000);
    await markWord(user, lions, 1);
    expect(await gazelles.findByText('2 de 10 acertadas')).toBeInTheDocument();
    expect(gazelles.queryAllByRole('button', { pressed: false })).toHaveLength(0);

    // Time is up: only the Gazelles' phone gets the card to validate.
    act(() => setClock(31_000));
    expect(await gazelles.findByRole('heading', { name: 'Validem a vez dos Leões' }, { timeout: 3000 })).toBeInTheDocument();
    expect(await table.findByText('A validar no telemóvel das Gazelas…')).toBeInTheDocument();
    expect(table.queryByRole('heading', { name: /validam a vez/ })).not.toBeInTheDocument();
    expect(table.queryAllByRole('group', { name: /^Validar/ })).toHaveLength(0);
    expect(table.queryByRole('button', { name: /Confirmar/ })).not.toBeInTheDocument();
    expect(lions.queryByRole('heading', { name: /Validem/ })).not.toBeInTheDocument();

    // The Gazelles cancel one word and confirm on their phone; the die rolls 1 → 1 − 1 = 0.
    await user.click(within(gazelles.getAllByRole('group', { name: /^Validar/ })[0]).getByRole('button', { name: 'Anular' }));
    await user.click(gazelles.getByRole('button', { name: 'Confirmar e lançar o dado' }));

    // The Lions pass the turn on their phone; now the Gazelles' phone holds the card.
    await passTurn(user, lions, 'Passar a vez · Tomás (As Gazelas)');
    expect(await gazelles.findByRole('button', { name: 'Estou pronto/a' })).toBeInTheDocument();
    expect(await lions.findByText('Vez das Gazelas')).toBeInTheDocument();
  });
});
