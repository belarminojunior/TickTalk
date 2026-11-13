import { act, queries, render, waitFor, within, type BoundFunctions } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfigProvider, useConfig } from './config';
import { HostApp } from './HostApp';
import { DEFAULT_SETTINGS } from './game/reducer';
import { saveSetup } from './game/storage';
import type { ScreenMode } from './game/types';
import { memoryPlayerStore, useDescriberClient, type PlayerStore } from './hooks/useTransport';
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
function TestPhone({ transport, store }: { transport: Transport; store: PlayerStore }) {
  const config = useConfig();
  // Each phone remembers its own person (they all share one page here).
  const client = useDescriberClient(transport, config.now, store);
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
        onPlayer={client.setPlayer}
        onEditTeam={client.editTeam}
      />
    </I18nProvider>
  );
}

const NAMED_TEAMS = [
  { name: 'Os Leões', color: 'red' as const, players: 'Ana, Pedro' },
  { name: 'As Gazelas', color: 'green' as const, players: 'Tomás, Rita' },
];
/** A fresh setup: groups without names or people yet. */
const FRESH_GROUPS = [
  { name: '', color: 'red' as const, players: '' },
  { name: '', color: 'green' as const, players: '' },
];

function setup(mode: ScreenMode = 'phone', phones = 1, teams = NAMED_TEAMS) {
  saveSetup({ settings: { ...DEFAULT_SETTINGS, screenMode: mode }, teams });
  let clock = 0;
  const user = userEvent.setup();
  const bus = new LocalBus();
  const config = {
    now: () => clock,
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
        <TestPhone transport={new LocalTransport(bus, `phone-${i + 1}`)} store={memoryPlayerStore(`key-phone-${i + 1}`)} />
      </ConfigProvider>,
    );
    return within(container);
  });
  return {
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

/** A turn with no words, ended early; with one phone there is nothing to check. */
async function emptyTurn(user: User, phone: Scope, pass: string) {
  await readyAndStart(user, phone);
  await user.click(phone.getByRole('button', { name: 'Terminar a vez' }));
  await passTurn(user, phone, pass);
}

describe('full game (PC + phone)', () => {
  it('no checking: 3 correct words = square 3 (yellow), and the card flips to yellow', async () => {
    const { user, setClock, table, phones } = setup();
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

    // Time runs out: with a single phone nobody checks, the pawn just lands on square 3.
    act(() => setClock(31_000));
    const pass = await phone.findByRole('button', { name: 'Passar a vez · Tomás (As Gazelas)' }, { timeout: 3000 });
    expect(table.queryByRole('heading', { name: /validam a vez/ })).not.toBeInTheDocument();
    expect(table.queryAllByRole('group', { name: /^Validar/ })).toHaveLength(0);
    expect(within(teamCard(table, 'Os Leões')).getByText('3')).toBeInTheDocument();
    expect(table.getByText('A carta vira para o amarelo')).toBeInTheDocument();
    // The table has no pass button (nor undo) while the phone is connected.
    expect(table.queryByRole('button', { name: /Passar a vez/ })).not.toBeInTheDocument();
    expect(table.queryByRole('button', { name: /Desfazer/ })).not.toBeInTheDocument();
    expect(table.getByText('Quem explica passa a vez no telemóvel.')).toBeInTheDocument();
    await user.click(pass);

    // The Gazelles' turn (no words).
    expect(await phone.findByText('Passa o telemóvel a Tomás')).toBeInTheDocument();
    await emptyTurn(user, phone, 'Passar a vez · Pedro (Os Leões)');

    // Back to the Lions on square 3 (yellow): the turn starts on the yellow side.
    expect(await phone.findByText('Os Leões · casa 3 · lado amarelo')).toBeInTheDocument();
    await readyAndStart(user, phone);
    expect(cardSide(phone)).toBe('yellow');
  });

  it('can leave the game mid-turn (after confirming) and pick it up again', async () => {
    const { user, table, phones } = setup();
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
    const { user, setClock, table, phones } = setup('teamPhones', 2);
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

    // The turn ends: only the Gazelles' phone gets the card to validate. (Ended from the phone,
    // not by jumping the test clock, which would also make the table think the phones went quiet.)
    await user.click(lions.getByRole('button', { name: 'Terminar a vez' }));
    expect(await gazelles.findByRole('heading', { name: 'Validem a vez dos Leões' }, { timeout: 3000 })).toBeInTheDocument();
    expect(await table.findByText('A validar no telemóvel das Gazelas…')).toBeInTheDocument();
    expect(table.queryByRole('heading', { name: /validam a vez/ })).not.toBeInTheDocument();
    expect(table.queryAllByRole('group', { name: /^Validar/ })).toHaveLength(0);
    expect(table.queryByRole('button', { name: /Confirmar/ })).not.toBeInTheDocument();
    expect(lions.queryByRole('heading', { name: /Validem/ })).not.toBeInTheDocument();

    // The Gazelles cancel one word and confirm on their phone: 2 − 1 = 1 square.
    await user.click(within(gazelles.getAllByRole('group', { name: /^Validar/ })[0]).getByRole('button', { name: 'Anular' }));
    await user.click(gazelles.getByRole('button', { name: 'Confirmar e avançar' }));

    // The Lions pass the turn on their phone; now the Gazelles' phone holds the card.
    await passTurn(user, lions, 'Passar a vez · Tomás (As Gazelas)');
    expect(within(teamCard(table, 'Os Leões')).getByText('1')).toBeInTheDocument();
    expect(await gazelles.findByRole('button', { name: 'Estou pronto/a' })).toBeInTheDocument();
    expect(await lions.findByText('Vez das Gazelas')).toBeInTheDocument();
  });
});

describe('full game (one phone per person)', () => {
  /** On a phone: write the name, then pick the team. */
  async function join(user: User, phone: Scope, name: string, team: RegExp) {
    await user.type(await phone.findByLabelText('O teu nome'), name);
    await user.click(phone.getByRole('button', { name: 'Continuar' }));
    await user.click(await phone.findByRole('button', { name: team }));
    await phone.findByRole('heading', { name: /A tua equipa/ });
  }

  it('everyone joins from their own phone; only the describer sees the words; the other team checks', async () => {
    const { user, setClock, table, phones } = setup('playerPhones', 4);
    const [ana, pedro, tomas, rita] = phones;

    await join(user, ana, 'Ana', /Os Leões/);
    await join(user, pedro, 'Pedro', /Os Leões/);
    await join(user, tomas, 'Tomás', /As Gazelas/);
    await join(user, rita, 'Rita', /As Gazelas/);
    // The table lists who joined each team; the phones see their teammates.
    expect(await table.findByRole('button', { name: 'Tirar Rita da equipa' })).toBeInTheDocument();
    expect(await ana.findByText('Pedro')).toBeInTheDocument();
    await user.click(table.getByRole('button', { name: 'Começar o jogo' }));

    // Ana describes; Pedro guesses on his phone, without the words; the Gazelles watch.
    await readyAndStart(user, ana);
    expect(await pedro.findByText('A tua equipa está a jogar: adivinha!')).toBeInTheDocument();
    expect(pedro.queryAllByRole('button', { pressed: false })).toHaveLength(0);
    expect(await tomas.findByText('Vez dos Leões')).toBeInTheDocument();
    setClock(1000);
    await markWord(user, ana, 0);
    setClock(2000);
    await markWord(user, ana, 1);
    expect(await pedro.findByText('2 de 10 acertadas')).toBeInTheDocument();

    // The turn ends: both Gazelles' phones get the card; Rita cancels a word, Tomás confirms.
    await user.click(ana.getByRole('button', { name: 'Terminar a vez' }));
    expect(await tomas.findByRole('heading', { name: 'Validem a vez dos Leões' }, { timeout: 3000 })).toBeInTheDocument();
    expect(await rita.findByRole('heading', { name: 'Validem a vez dos Leões' })).toBeInTheDocument();
    expect(table.queryAllByRole('group', { name: /^Validar/ })).toHaveLength(0);
    await user.click(within(rita.getAllByRole('group', { name: /^Validar/ })[0]).getByRole('button', { name: 'Anular' }));
    await user.click(tomas.getByRole('button', { name: 'Confirmar e avançar' }));

    // Only Ana passes the turn; then Tomás describes, on his own phone.
    const pass = await ana.findByRole('button', { name: 'Passar a vez · Tomás (As Gazelas)' }, { timeout: 3000 });
    expect(pedro.queryByRole('button', { name: /Passar a vez/ })).not.toBeInTheDocument();
    await user.click(pass);
    expect(within(teamCard(table, 'Os Leões')).getByText('1')).toBeInTheDocument();
    expect(await tomas.findByRole('button', { name: 'Estou pronto/a' })).toBeInTheDocument();
    expect(rita.queryByRole('button', { name: 'Estou pronto/a' })).not.toBeInTheDocument();
  });
});

describe('setting up the groups', () => {
  it('PC + one phone: no names to type; each group just has a number of people', async () => {
    const { user, table, phones } = setup('phone', 1, FRESH_GROUPS);
    expect(table.queryByRole('textbox')).not.toBeInTheDocument();
    expect(table.getByText('Grupo A')).toBeInTheDocument();
    const groupA = table.getByRole('group', { name: 'Grupo A: 2 pessoas' });
    await user.click(within(groupA).getByRole('button', { name: 'Mais uma pessoa no Grupo A' }));
    expect(within(groupA).getByText('3 pessoas')).toBeInTheDocument();
    await user.click(table.getByRole('button', { name: 'Mais um grupo' }));
    expect(table.getByText('Grupo C')).toBeInTheDocument();

    await user.click(table.getByRole('button', { name: 'Começar o jogo' }));
    expect(await phones[0].findByText('Passa o telemóvel a Pessoa 1')).toBeInTheDocument();
    expect(table.getByText('Passa o telemóvel a Pessoa 1 (Grupo A)')).toBeInTheDocument();
  });

  it('one phone per team: each phone picks its group and writes the team name and who plays', async () => {
    const { user, table, phones } = setup('teamPhones', 2, FRESH_GROUPS);
    const [first, second] = phones;
    expect(await first.findByRole('heading', { name: 'Qual é o teu grupo?' })).toBeInTheDocument();
    await user.click(first.getByRole('button', { name: /Grupo A/ }));
    await user.click(await second.findByRole('button', { name: /Grupo B/ }));

    // The first group writes its team on its phone; the PC shows it as it arrives.
    await user.type(await first.findByLabelText('Nome da equipa'), 'Os Leões');
    await user.type(first.getByLabelText('Nome 1'), 'Ana');
    await user.type(first.getByLabelText('Nome 2'), 'Pedro');
    expect(await table.findByText('Os Leões', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(table.getByText('Pedro')).toBeInTheDocument();
    expect(await first.findByText('Já aparece no PC.')).toBeInTheDocument();

    // The second group adds a third person and keeps the default name.
    await user.type(await second.findByLabelText('Nome 1'), 'Tomás');
    await user.type(second.getByLabelText('Nome 2'), 'Rita');
    await user.click(second.getByRole('button', { name: 'Adicionar pessoa' }));
    await user.type(second.getByLabelText('Nome 3'), 'Bia');
    expect(await table.findByText('Bia', {}, { timeout: 3000 })).toBeInTheDocument();

    await user.click(table.getByRole('button', { name: 'Começar o jogo' }));
    // The game starts with those teams; each phone keeps its group.
    expect(await first.findByRole('button', { name: 'Estou pronto/a' })).toBeInTheDocument();
    expect(await second.findByText('Vez dos Leões')).toBeInTheDocument();
    expect(within(teamCard(table, 'Grupo B')).getByText('Grupo B')).toBeInTheDocument();
  });

  it('one phone per person: someone in the group names the team on their phone', async () => {
    const { user, table, phones } = setup('playerPhones', 2, FRESH_GROUPS);
    const [ana, pedro] = phones;
    await user.type(await ana.findByLabelText('O teu nome'), 'Ana');
    await user.click(ana.getByRole('button', { name: 'Continuar' }));
    await user.click(await ana.findByRole('button', { name: /Grupo A/ }));
    await user.type(await pedro.findByLabelText('O teu nome'), 'Pedro');
    await user.click(pedro.getByRole('button', { name: 'Continuar' }));
    await user.click(await pedro.findByRole('button', { name: /Grupo A/ }));

    await user.type(await pedro.findByLabelText('Nome da equipa'), 'Os Leões');
    expect(await table.findByText('Os Leões', {}, { timeout: 3000 })).toBeInTheDocument();
    // Ana's phone shows the name Pedro chose.
    await waitFor(() => expect(ana.getByLabelText('Nome da equipa')).toHaveValue('Os Leões'));
  });
});
