import type { Language, ScreenMode, Side } from '../game/types';
import { FINISH } from '../game/types';

/** Joins names: "Pedro e Lúcia", "Ana, Pedro e Lúcia". */
function joinNames(names: string[], and: string): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} ${and} ${names[names.length - 1]}`;
}

const ARTICLES: [RegExp, string, boolean][] = [
  [/^os\s+/i, 'dos ', true],
  [/^as\s+/i, 'das ', true],
  [/^o\s+/i, 'do ', false],
  [/^a\s+/i, 'da ', false],
];

/** Portuguese contraction: "Os Leões" → "dos Leões"; "Tigres" → "de Tigres". */
export function ofTeamPt(name: string): string {
  for (const [re, contracted] of ARTICLES) if (re.test(name)) return contracted + name.replace(re, '');
  return `de ${name}`;
}

/** "Os Leões" is plural → "validam"; "Equipa Azul" → "valida". */
export function isPluralPt(name: string): boolean {
  return /^(os|as)\s+/i.test(name);
}

/** Player gender is unknown, so names go without an article ("a Tomás", not "à"/"ao"). */
function toPersonPt(name: string): string {
  return name;
}

const pt = {
  langName: 'Português',
  tagline: 'Explica cinco palavras antes que o tempo acabe.',
  interfaceLanguage: 'Língua da interface',

  // Setup
  howToPlay: 'Como vão jogar?',
  modeTitle: {
    phone: 'PC + telemóvel de quem explica',
    teamPhones: 'Um telemóvel por equipa',
    playerPhones: 'Um telemóvel por pessoa',
  } as Record<ScreenMode, string>,
  modeDesc: {
    phone: 'O PC mostra a mesa a todos. Quem explica abre a carta no telemóvel, na mesma rede Wi-Fi.',
    teamPhones: 'Cada equipa usa o seu telemóvel: quem explica vê a carta e, no fim, a equipa adversária valida no telemóvel dela.',
    playerPhones: 'Cada pessoa usa o seu telemóvel: escreve o nome, escolhe a equipa e vê a carta quando for a sua vez de explicar.',
  } as Record<ScreenMode, string>,
  recommended: 'Recomendado',
  connectPhone: 'Liga o telemóvel',
  connectPhoneHelpBefore: 'Lê o código com a câmara ou abre ',
  connectPhoneHelpAfter: '. O telemóvel passa de mão em mão a cada vez.',
  qrAlt: (url: string): string => `Código QR para abrir ${url}`,
  phonesConnected: (n: number): string =>
    n === 0 ? 'Nenhum telemóvel ligado' : n === 1 ? '1 telemóvel ligado' : `${n} telemóveis ligados`,
  serverConnecting: 'A abrir a sala…',
  serverUnreachable: 'Não consegui abrir a sala. Confirma a ligação à internet; o jogo tenta outra vez sozinho.',
  sameWifi: 'Confirma que o telemóvel tem internet.',
  teams: 'Equipas',
  teamName: 'Nome da equipa',
  players: 'Jogadores, pela ordem em que explicam',
  playersPlaceholder: 'Ana, Pedro, Lúcia',
  teamPlaceholder: (n: number): string => `Equipa ${n}`,
  addTeam: 'Adicionar equipa (até 6)',
  shuffleTeams: 'Sortear equipas',
  shuffleHelp:
    'Escreve os nomes de todas as pessoas que vão jogar, separados por vírgulas ou um por linha. O jogo baralha-os e reparte-os pelas equipas. Os nomes e as cores das equipas ficam como estão.',
  everyone: 'Quem vai jogar',
  everyonePlaceholder: 'Ana, Pedro, Lúcia, Tomás, Rita, João',
  teamCount: 'Número de equipas',
  shuffleSummary: (people: number, min: number, max: number): string =>
    `${people === 1 ? '1 pessoa' : `${people} pessoas`} · ${min === max ? min : `${min} a ${max}`} por equipa`,
  shuffleErrors: {
    tooFewPlayers: (needed: number): string => `São precisas pelo menos ${needed} pessoas (2 por equipa).`,
    repeatedName: (name: string): string => `O nome “${name}” está repetido. Usa nomes diferentes.`,
  },
  shuffle: 'Sortear',
  cancel: 'Cancelar',
  removeTeam: (name: string): string => `Remover ${name || 'equipa'}`,
  changeColor: (name: string): string => `Mudar a cor do peão de ${name || 'equipa'}`,
  houseRules: 'Regras da casa',
  timePerTurn: 'Tempo por vez',
  cardLanguage: 'Língua das cartas',
  continueSaved: 'Continuar jogo guardado',
  startGame: 'Começar o jogo',
  errors: {
    tooFewTeams: 'Precisam de pelo menos 2 equipas.',
    teamName: 'Dá um nome a esta equipa.',
    teamPlayers: 'Cada equipa precisa de pelo menos 2 jogadores, separados por vírgulas.',
    duplicatePlayers: 'Há nomes repetidos nesta equipa.',
  },
  noPhoneWarning: 'Ainda não há nenhum telemóvel ligado. Podes começar na mesma e ligá-lo depois.',
  noWindowWarning: 'A janela de quem explica ainda não está aberta. Podes começar e abri-la depois.',

  // Table
  roundLine: (round: number): string => `Ronda ${round} · ganha quem chegar primeiro à chegada`,
  roundEndLine: (round: number, team: string): string => `Ronda ${round} · fim da vez ${ofTeamPt(team)}`,
  live: {
    phone: 'Ao vivo · a tela de quem explica está ligada',
    teamPhones: 'Ao vivo · o telemóvel da equipa está ligado',
    playerPhones: 'Ao vivo · o telemóvel de quem explica está ligado',
  } as Record<ScreenMode, string>,
  describerOffline: {
    phone: 'Telemóvel desligado',
    teamPhones: 'Telemóvel da equipa desligado',
    playerPhones: 'Telemóvel de quem explica desligado',
  } as Record<ScreenMode, string>,
  rules: 'Regras',
  soundOn: 'Som ligado',
  soundOff: 'Som desligado',
  startSquare: 'Partida',
  finishSquare: 'Chegada',
  houseColor: (side: Side): string => (side === 'blue' ? 'Casa azul' : 'Casa amarela'),
  sideName: (side: Side): string => (side === 'blue' ? 'azul' : 'amarelo'),
  sideLabel: (side: Side): string => (side === 'blue' ? 'Lado azul' : 'Lado amarelo'),
  teamSide: (team: string, side: Side): string => `${team} · lado ${side === 'blue' ? 'azul' : 'amarelo'}`,
  isExplaining: (name: string): string => `${name} está a explicar`,
  guessing: (names: string[]): string => `${joinNames(names, 'e')} ${names.length === 1 ? 'adivinha' : 'adivinham'}`,
  seconds: 'segundos',
  ofTenGuessed: 'de 10 acertadas',
  faceUp: (side: Side): string => `Agora: lado ${side === 'blue' ? 'azul' : 'amarelo'}`,
  hiddenNote: 'As palavras ficam escondidas até o tempo acabar. Depois, a equipa adversária valida.',
  hiddenNoteNoValidation: 'As palavras ficam escondidas até o tempo acabar.',
  pawnLiveNote: (validation: boolean): string =>
    `O peão avança uma casa a cada acerto.${validation ? ' No fim descontam-se as palavras anuladas.' : ''}`,
  ifTimeEndedNow: 'Se o tempo acabasse agora',
  plusSquares: (n: number): string => (n === 1 ? '+1 casa' : `+${n} casas`),
  onePerWord: '1 casa por palavra válida',
  liveHits: 'Acertos ao vivo',
  hitLine: (n: number, side: Side): string => `Palavra ${n} · lado ${side === 'blue' ? 'azul' : 'amarelo'}`,
  atSeconds: (s: number): string => `aos ${s} s`,
  noHitsYet: 'Ainda sem acertos.',
  slotLabel: (side: Side, n: number, hit: boolean): string =>
    `Lado ${side === 'blue' ? 'azul' : 'amarelo'}, palavra ${n}: ${hit ? 'acertada' : 'por acertar'}`,
  passDevice: {
    phone: 'Passa o telemóvel',
    teamPhones: 'Passa o telemóvel da equipa',
    playerPhones: 'Vez de explicar',
  } as Record<ScreenMode, string>,
  passTo: (mode: ScreenMode, name: string, team: string): string =>
    mode === 'playerPhones'
      ? `${name} explica (${team}), no próprio telemóvel`
      : mode === 'teamPhones'
        ? `${name} explica, com o telemóvel ${ofTeamPt(team)}`
        : `Passa o telemóvel a ${name} (${team})`,
  handoffHelp: (mode: ScreenMode): string =>
    mode === 'playerPhones'
      ? 'Quando estiver tudo pronto, quem explica carrega em Começar no seu telemóvel.'
      : mode === 'teamPhones'
        ? 'Quando estiver tudo pronto, carrega em Começar no telemóvel da equipa.'
        : 'Quando estiver tudo pronto, carrega em Começar no telemóvel.',
  readyStatus: (name: string): string => `${name} está pronto/a. O tempo começa já a seguir.`,
  skipDescriber: 'Trocar quem explica',
  waitingDescriber: {
    phone: 'À espera do telemóvel…',
    teamPhones: 'À espera do telemóvel da equipa…',
    playerPhones: 'À espera do telemóvel de quem explica…',
  } as Record<ScreenMode, string>,
  paused: 'Pausa',
  pausedHelp: 'O tempo parou.',
  disconnectedHelp: 'O tempo parou. Abre outra vez a página no telemóvel para continuar.',
  reconnectedHelp: 'A ligação caiu e o tempo parou. Carrega em Retomar quando estiverem prontos.',
  resume: 'Retomar',
  pause: 'Pausar',
  timeUp: 'Tempo esgotado!',
  allWords: 'Dez em dez!',
  endedEarly: 'Vez terminada',
  continue: 'Continuar',

  // Validation
  timeUpPill: 'Tempo esgotado',
  validatesTitle: (validator: string, team: string): string =>
    `${validator} ${isPluralPt(validator) ? 'validam' : 'valida'} a vez ${ofTeamPt(team)}`,
  checkTitle: (team: string): string => `Confirmem a vez ${ofTeamPt(team)}`,
  validateSubtitle: (describer: string): string =>
    `Vejam as palavras que ${toPersonPt(describer)} marcou como acertadas. Se alguma regra foi quebrada, anulem essa palavra. Depois o peão avança.`,
  valid: 'Válida',
  annul: 'Anular',
  annulled: 'Anulada',
  notGuessed: 'não acertada',
  validationGroup: (word: string): string => `Validar “${word}”`,
  cardHeader: (side: Side, n: number | null): string => `${side === 'blue' ? 'Lado azul' : 'Lado amarelo'}${n ? ` · carta ${n}` : ''}`,
  turnResult: 'Resultado da vez',
  markedWord: (n: number): string => (n === 1 ? 'marcada' : 'marcadas'),
  annulledWord: (n: number): string => (n === 1 ? 'anulada' : 'anuladas'),
  validWords: (n: number): string => (n === 1 ? 'palavra válida' : 'palavras válidas'),
  annulIf: 'Anula se quem explicou',
  annulRules: [
    'disse a palavra ou uma parte dela',
    'soletrou ou disse a letra inicial',
    'usou “rima com” ou “soa como”',
    'traduziu diretamente para outra língua',
    'apontou para um objeto com o nome',
  ],
  confirmAdvance: 'Confirmar e avançar',
  finalNote: 'Só a equipa adversária pode anular. A decisão é final.',

  // Die and end of turn
  validLabel: (n: number): string => (n === 1 ? 'válida' : 'válidas'),
  squaresLabel: (n: number): string => (n === 1 ? 'casa' : 'casas'),
  squareN: (n: number): string => (n <= 0 ? 'Partida' : n >= FINISH ? 'Chegada' : `Casa ${n}`),
  onePerWordHeader: 'Cada palavra válida = 1 casa',
  cardFlips: (side: Side): string => `A carta vira para o ${side === 'blue' ? 'azul' : 'amarelo'}`,
  cardFlipsHelp: (team: string, side: Side): string =>
    `${team} ${isPluralPt(team) ? 'estão' : 'está'} agora numa casa ${side === 'blue' ? 'azul' : 'amarela'}. Na próxima vez ${isPluralPt(team) ? 'leem' : 'lê'} o lado ${side === 'blue' ? 'azul' : 'amarelo'}.`,
  cardStays: (side: Side): string => `A carta continua ${side === 'blue' ? 'azul' : 'amarela'}`,
  cardStaysHelp: (team: string, side: Side): string =>
    `${team} ${isPluralPt(team) ? 'continuam' : 'continua'} numa casa ${side === 'blue' ? 'azul' : 'amarela'}, por isso ${isPluralPt(team) ? 'leem' : 'lê'} o mesmo lado.`,
  sequence: 'Sequência das equipas',
  seqLabel: { justPlayed: 'jogou agora', next: 'a seguir', later: 'depois' },
  passTurn: (player: string, team: string): string => `Passar a vez · ${player} (${team})`,
  undo: 'Desfazer esta vez',
  pawnMoving: 'O peão está a andar…',
  turnOver: 'Fim da vez',
  nextUp: (player: string, team: string): string => `A seguir: ${player} (${team})`,
  passOnDevice: {
    phone: 'Quem explica passa a vez no telemóvel.',
    teamPhones: 'Quem explica passa a vez no telemóvel da equipa.',
    playerPhones: 'Quem explica passa a vez no seu telemóvel.',
  } as Record<ScreenMode, string>,
  noMove: 'O peão fica onde está.',

  // Victory
  victory: (team: string): string => `Vitória ${ofTeamPt(team)}!`,
  victorySub: 'Chegaram primeiro à Chegada.',
  ranking: 'Classificação',
  playAgain: 'Jogar outra vez',
  newSetup: 'Nova configuração',

  // Rules
  rulesTitle: 'Regras do Tick Talk',
  exit: 'Sair',
  exitTitle: 'Sair do jogo?',
  exitBody: 'O jogo fica guardado. Podes continuá-lo depois em “Continuar jogo guardado”.',
  exitConfirm: 'Sair do jogo',
  keepPlaying: 'Continuar a jogar',
  close: 'Fechar',
  rulesSections: [
    {
      title: 'O objetivo',
      body: 'Entrar primeiro na Chegada, depois da casa 36. As casas alternam azul e amarela do princípio ao fim: Partida azul, casa 1 amarela, casa 2 azul… As equipas jogam por ordem e, dentro de cada equipa, quem explica muda a cada vez.',
    },
    {
      title: 'A vez',
      body: 'A carta tem dois lados, azul e amarelo, com 5 palavras cada. A vez começa no lado da cor da casa onde está o peão (casa azul, lado azul; casa amarela, lado amarelo). Sempre que a equipa acerta uma palavra, a carta vira para o outro lado: há 10 palavras para explicar antes que o tempo acabe.',
    },
    {
      title: 'Não vale',
      body: 'Dizer a palavra ou parte dela, soletrar ou dizer a letra inicial, usar “rima com” ou “soa como”, traduzir para outra língua, ou apontar para um objeto com o nome.',
    },
    {
      title: 'Avanço',
      body: 'O peão avança uma casa por cada palavra acertada e a vez passa à equipa seguinte, pela ordem.',
    },
    {
      title: 'Validação (telemóvel por equipa ou por pessoa)',
      body: 'Quando cada equipa (ou cada pessoa) tem o seu telemóvel, no fim da vez a equipa seguinte vê as palavras marcadas e pode anular as que quebraram as regras. A decisão é final. Com um só telemóvel não há validação.',
    },
  ],
  shortcuts: 'Atalhos de teclado',
  shortcutsDescriber: 'Na tela de quem explica',
  shortcutsTable: 'Na mesa',
  shortcutList: {
    describer: [
      ['Espaço', 'pronto/a, começar; no fim, passar a vez'],
      ['1–5', 'marcar uma palavra (a carta vira)'],
      ['Backspace', 'desfazer o último acerto'],
      ['P', 'pausar ou retomar'],
      ['Enter', 'terminar a vez'],
    ],
    table: [
      ['Espaço', 'continuar'],
      ['Z', 'desfazer esta vez'],
      ['?', 'regras'],
      ['Esc', 'fechar'],
    ],
  } as Record<'describer' | 'table', [string, string][]>,

  // Describer
  youExplain: (name: string): string => `${name}, és tu a explicar`,
  teamLine: (team: string, square: number, side: Side): string =>
    `${team} · ${square <= 0 ? 'Partida' : `casa ${square}`} · lado ${side === 'blue' ? 'azul' : 'amarelo'}`,
  hitsCount: (n: number): string => `${n} de 10 acertadas`,
  describerHelp1: 'Toca na palavra quando a tua equipa acertar (ou tecla 1–5): a carta vira para o outro lado.',
  undoHit: 'Desfazer último acerto',
  describerHelp2: 'Não digas a palavra, partes dela, nem “rima com”.',
  endTurn: 'Terminar a vez',
  handoffTitle: (mode: ScreenMode, name: string): string =>
    mode === 'playerPhones' ? `${name}, és tu a explicar` : `Passa o telemóvel a ${toPersonPt(name)}`,
  handoffDevice: { phone: 'Passa o telemóvel', teamPhones: 'Passa o telemóvel', playerPhones: 'É a tua vez' } as Record<ScreenMode, string>,

  // One phone per team
  connectTeamPhones: 'Liga os telemóveis das equipas',
  connectTeamPhonesHelpBefore: 'Cada equipa lê o código ou abre ',
  connectTeamPhonesHelpAfter: '. Quando o jogo começar, cada telemóvel escolhe a sua equipa.',
  pickTeamTitle: 'Qual é a tua equipa?',
  pickTeamHelp: 'Este telemóvel fica com a equipa que escolheres. Cada equipa usa um telemóvel.',
  teamTaken: 'já tem telemóvel',
  refusedTeam: (name: string): string => `${name} já tem um telemóvel. Escolhe outra equipa.`,
  yourTeam: (name: string): string => `A tua equipa: ${name}`,
  changeTeam: 'Trocar de equipa',

  // Home
  homeCreate: 'Criar sala',
  homeCreateHelp: 'Este ecrã fica a mesa: mostra o tabuleiro a todos e o código da sala para os telemóveis entrarem.',
  homeJoin: 'Entrar numa sala',
  homeJoinHelp: 'Escreve o código de 4 letras que aparece na mesa.',

  // Rooms
  roomLabel: 'Sala',
  roomTitle: 'Em que sala vais jogar?',
  roomHelp: 'Escreve o código de 4 letras que aparece no ecrã do PC.',
  roomCode: 'Código da sala',
  roomNotFound: (code: string): string => `Não encontrei a sala ${code}. Confirma o código no PC (ou espera que a mesa abra).`,
  roomInvalid: 'O código tem 4 letras.',
  enterRoom: 'Entrar',

  // One phone per person
  connectEveryone: 'Liga os telemóveis de todos',
  connectEveryoneHelpBefore: 'Cada pessoa lê o código ou abre ',
  connectEveryoneHelpAfter: ', escreve o seu nome e escolhe a equipa.',
  playersFromPhones: 'Jogadores (entram pelo telemóvel)',
  noPlayersYet: 'Ainda ninguém escolheu esta equipa.',
  withoutTeam: (names: string[]): string => `Ainda sem equipa: ${joinNames(names, 'e')}`,
  removePlayer: (name: string): string => `Tirar ${name} da equipa`,
  playerOffline: (name: string): string => `${name} (desligado)`,
  needPhonesPerTeam: 'Esta equipa precisa de pelo menos 2 pessoas. Peçam a mais alguém para a escolher no telemóvel.',
  nameTitle: 'Como te chamas?',
  nameHelp: 'É o nome que a tua equipa e a mesa vão ver.',
  nameLabel: 'O teu nome',
  namePlaceholder: 'Ana',
  nameTaken: 'Já há alguém ligado com esse nome. Usa outro (por exemplo, com a inicial do apelido).',
  removedByTable: 'A mesa tirou-te da lista. Escreve o teu nome para voltares a entrar.',
  hello: (name: string): string => `Olá, ${name}!`,
  pickTeamHelpPlayer: 'Toca na equipa em que vais jogar. Podes trocar até o jogo começar.',
  nobodyYet: 'Ainda ninguém',
  lobbyWaiting: 'À espera que o jogo comece no PC. Deixa esta página aberta.',
  changeName: 'Mudar o nome',
  whoAreYouTitle: 'Quem és tu?',
  whoAreYouHelp: 'O jogo já começou. Toca no teu nome.',
  alreadyConnected: 'já ligado',
  notInList: 'Não estás na lista? Quem está no PC pode começar um jogo novo contigo.',
  yourTeamPlaying: 'A tua equipa está a jogar: adivinha!',
  youAre: (name: string, team: string): string => `${name} · ${team}`,
  turnOf: (team: string): string => `Vez ${ofTeamPt(team)}`,
  spectatorHelp: 'As palavras só aparecem no telemóvel de quem explica.',
  checkingNow: (validator: string): string => `${validator} ${isPluralPt(validator) ? 'estão' : 'está'} a validar.`,
  phoneValidateTitle: (team: string): string => `Validem a vez ${ofTeamPt(team)}`,
  validatingOnPhone: (validator: string): string => `A validar no telemóvel ${ofTeamPt(validator)}…`,
  validatingOnPhoneHelp: 'A equipa adversária vê as palavras e valida no telemóvel dela. O jogo continua quando confirmarem.',
  teamPhoneOn: 'telemóvel ligado',
  teamPhoneOff: 'sem telemóvel',
  waitingNextTurn: 'À espera da próxima vez.',
  aboutToExplain: (name: string): string => `${name} vai explicar`,
  startsSoon: 'O tempo começa quando carregarem em Começar.',
  imReady: 'Estou pronto/a',
  start: 'Começar',
  readyHint: 'Esconde o ecrã dos outros. O tempo começa quando carregares em Começar.',
  flippedNotice: (side: Side): string => `A carta virou para o lado ${side === 'blue' ? 'azul' : 'amarelo'}`,
  lookAtTable: 'Tempo! Olha para a mesa.',
  lookAtTableHelp: 'A equipa adversária está a validar as palavras.',
  lookAtTableHelpNoValidation: 'O resultado aparece na mesa.',
  waitingGame: 'À espera que o jogo comece…',
  waitingGameHelp: 'Escolhe as equipas no PC e carrega em “Começar o jogo”.',
  waitingHost: 'À espera da mesa…',
  waitingHostHelp: 'Confirma que o jogo está aberto no PC.',
  reconnecting: 'A ligar outra vez…',
  replacedHostTitle: 'O Tick Talk está aberto noutra janela',
  replacedHostHelp: 'Só uma mesa pode estar ligada ao servidor de cada vez. Fecha a outra janela ou separador, ou continua aqui.',
  replacedDescriberTitle: 'Esta página está aberta noutro separador',
  replacedDescriberHelp: 'Só um separador pode estar ligado de cada vez. Fecha o outro, ou continua aqui.',
  useThisWindow: 'Usar esta janela',
  busy: 'Já há alguém a explicar',
  busyHelp: 'Só um telemóvel pode explicar de cada vez. Esta página liga-se sozinha quando o outro sair.',
  gameOver: 'Fim do jogo!',
  pausedWordsHidden: 'As palavras ficam escondidas durante a pausa.',
  wordButton: (n: number, word: string): string => `${n}. ${word}`,
  secondsLeft: (s: number): string => `${s} segundos`,
};

export type Strings = typeof pt;

/** "The Lions" → "the Lions'"; usado em frases como "check the Lions' turn". */
function possessiveEn(name: string): string {
  return /s$/i.test(name) ? `${name}’` : `${name}’s`;
}

const en: Strings = {
  langName: 'English',
  tagline: 'Describe five words before time runs out.',
  interfaceLanguage: 'Interface language',

  howToPlay: 'How will you play?',
  modeTitle: { phone: 'PC + describer’s phone', teamPhones: 'One phone per team', playerPhones: 'One phone per person' },
  modeDesc: {
    phone: 'The PC shows the table to everyone. The describer opens the card on a phone, on the same Wi-Fi.',
    teamPhones: 'Each team uses its own phone: the describer sees the card and, at the end, the other team checks it on theirs.',
    playerPhones: 'Everyone uses their own phone: write your name, pick a team, and see the card when it’s your turn to describe.',
  },
  recommended: 'Recommended',
  connectPhone: 'Connect the phone',
  connectPhoneHelpBefore: 'Scan the code with the camera or open ',
  connectPhoneHelpAfter: '. The phone is passed from hand to hand each turn.',
  qrAlt: (url) => `QR code to open ${url}`,
  phonesConnected: (n) => (n === 0 ? 'No phone connected' : n === 1 ? '1 phone connected' : `${n} phones connected`),
  serverConnecting: 'Opening the room…',
  serverUnreachable: 'Couldn’t open the room. Check the internet connection; the game keeps trying.',
  sameWifi: 'Check that the phone is online.',
  teams: 'Teams',
  teamName: 'Team name',
  players: 'Players, in the order they describe',
  playersPlaceholder: 'Ann, Peter, Lucy',
  teamPlaceholder: (n) => `Team ${n}`,
  addTeam: 'Add team (up to 6)',
  shuffleTeams: 'Random teams',
  shuffleHelp:
    'Write the names of everyone who is playing, separated by commas or one per line. The game shuffles them and splits them into the teams. Team names and colours stay as they are.',
  everyone: 'Who is playing',
  everyonePlaceholder: 'Ann, Peter, Lucy, Tom, Rita, John',
  teamCount: 'Number of teams',
  shuffleSummary: (people, min, max) =>
    `${people === 1 ? '1 person' : `${people} people`} · ${min === max ? min : `${min} to ${max}`} per team`,
  shuffleErrors: {
    tooFewPlayers: (needed) => `You need at least ${needed} people (2 per team).`,
    repeatedName: (name) => `The name “${name}” is repeated. Use different names.`,
  },
  shuffle: 'Shuffle',
  cancel: 'Cancel',
  removeTeam: (name) => `Remove ${name || 'team'}`,
  changeColor: (name) => `Change ${name || 'team'} pawn colour`,
  houseRules: 'House rules',
  timePerTurn: 'Time per turn',
  cardLanguage: 'Card language',
  continueSaved: 'Continue saved game',
  startGame: 'Start the game',
  errors: {
    tooFewTeams: 'You need at least 2 teams.',
    teamName: 'Give this team a name.',
    teamPlayers: 'Each team needs at least 2 players, separated by commas.',
    duplicatePlayers: 'There are repeated names in this team.',
  },
  noPhoneWarning: 'No phone is connected yet. You can start anyway and connect it later.',
  noWindowWarning: 'The describer window isn’t open yet. You can start and open it later.',

  roundLine: (round) => `Round ${round} · first to the finish wins`,
  roundEndLine: (round, team) => `Round ${round} · end of ${possessiveEn(team)} turn`,
  live: {
    phone: 'Live · the describer’s screen is connected',
    teamPhones: 'Live · the team’s phone is connected',
    playerPhones: 'Live · the describer’s phone is connected',
  },
  describerOffline: { phone: 'Phone disconnected', teamPhones: 'Team phone disconnected', playerPhones: 'Describer’s phone disconnected' },
  rules: 'Rules',
  soundOn: 'Sound on',
  soundOff: 'Sound off',
  startSquare: 'Start',
  finishSquare: 'Finish',
  houseColor: (side) => (side === 'blue' ? 'Blue square' : 'Yellow square'),
  sideName: (side) => (side === 'blue' ? 'blue' : 'yellow'),
  sideLabel: (side) => (side === 'blue' ? 'Blue side' : 'Yellow side'),
  teamSide: (team, side) => `${team} · ${side} side`,
  isExplaining: (name) => `${name} is describing`,
  guessing: (names) => `${joinNames(names, 'and')} ${names.length === 1 ? 'guesses' : 'guess'}`,
  seconds: 'seconds',
  ofTenGuessed: 'of 10 guessed',
  faceUp: (side) => `Now: ${side} side`,
  hiddenNote: 'The words stay hidden until time runs out. Then the other team checks them.',
  hiddenNoteNoValidation: 'The words stay hidden until time runs out.',
  pawnLiveNote: (validation) => `The pawn moves one square per correct word.${validation ? ' At the end, cancelled words are taken off.' : ''}`,
  ifTimeEndedNow: 'If time ran out now',
  plusSquares: (n) => (n === 1 ? '+1 square' : `+${n} squares`),
  onePerWord: '1 square per valid word',
  liveHits: 'Live hits',
  hitLine: (n, side) => `Word ${n} · ${side} side`,
  atSeconds: (s) => `at ${s} s`,
  noHitsYet: 'No hits yet.',
  slotLabel: (side, n, hit) => `${side === 'blue' ? 'Blue' : 'Yellow'} side, word ${n}: ${hit ? 'guessed' : 'not yet'}`,
  passDevice: { phone: 'Pass the phone', teamPhones: 'Pass the team phone', playerPhones: 'Turn to describe' },
  passTo: (mode, name, team) =>
    mode === 'playerPhones'
      ? `${name} describes (${team}), on their own phone`
      : mode === 'teamPhones'
        ? `${name} describes, on ${possessiveEn(team)} phone`
        : `Pass the phone to ${name} (${team})`,
  handoffHelp: (mode) =>
    mode === 'playerPhones'
      ? 'When everyone is ready, the describer presses Start on their phone.'
      : mode === 'teamPhones'
        ? 'When everyone is ready, press Start on the team phone.'
        : 'When everyone is ready, press Start on the phone.',
  readyStatus: (name) => `${name} is ready. The timer starts next.`,
  skipDescriber: 'Change describer',
  waitingDescriber: {
    phone: 'Waiting for the phone…',
    teamPhones: 'Waiting for the team phone…',
    playerPhones: 'Waiting for the describer’s phone…',
  },
  paused: 'Paused',
  pausedHelp: 'The timer is stopped.',
  disconnectedHelp: 'The timer is stopped. Open the page on the phone again to continue.',
  reconnectedHelp: 'The connection dropped and the timer stopped. Press Resume when you’re ready.',
  resume: 'Resume',
  pause: 'Pause',
  timeUp: 'Time’s up!',
  allWords: 'Ten out of ten!',
  endedEarly: 'Turn ended',
  continue: 'Continue',

  timeUpPill: 'Time’s up',
  validatesTitle: (validator, team) => `${validator} check ${possessiveEn(team)} turn`,
  checkTitle: (team) => `Confirm ${possessiveEn(team)} turn`,
  validateSubtitle: (describer) =>
    `Look at the words ${describer} marked as guessed. If a rule was broken, cancel that word. Then the pawn moves.`,
  valid: 'Valid',
  annul: 'Cancel',
  annulled: 'Cancelled',
  notGuessed: 'not guessed',
  validationGroup: (word) => `Check “${word}”`,
  cardHeader: (side, n) => `${side === 'blue' ? 'Blue side' : 'Yellow side'}${n ? ` · card ${n}` : ''}`,
  turnResult: 'Turn result',
  markedWord: () => 'marked',
  annulledWord: () => 'cancelled',
  validWords: (n) => (n === 1 ? 'valid word' : 'valid words'),
  annulIf: 'Cancel if the describer',
  annulRules: [
    'said the word or part of it',
    'spelled it or said the first letter',
    'used “rhymes with” or “sounds like”',
    'translated it directly into another language',
    'pointed at an object with the name',
  ],
  confirmAdvance: 'Confirm and move',
  finalNote: 'Only the other team can cancel. The decision is final.',
  validLabel: () => 'valid',
  squaresLabel: (n) => (n === 1 ? 'square' : 'squares'),
  squareN: (n) => (n <= 0 ? 'Start' : n >= FINISH ? 'Finish' : `Square ${n}`),
  onePerWordHeader: 'Each valid word = 1 square',
  cardFlips: (side) => `The card flips to ${side}`,
  cardFlipsHelp: (team, side) => `${team} are now on a ${side} square. Next turn they read the ${side} side.`,
  cardStays: (side) => `The card stays ${side}`,
  cardStaysHelp: (team, side) => `${team} are still on a ${side} square, so they read the same side.`,
  sequence: 'Team order',
  seqLabel: { justPlayed: 'just played', next: 'up next', later: 'later' },
  passTurn: (player, team) => `Next turn · ${player} (${team})`,
  undo: 'Undo this turn',
  pawnMoving: 'The pawn is moving…',
  turnOver: 'Turn over',
  nextUp: (player, team) => `Up next: ${player} (${team})`,
  passOnDevice: {
    phone: 'The describer passes the turn on the phone.',
    teamPhones: 'The describer passes the turn on the team phone.',
    playerPhones: 'The describer passes the turn on their phone.',
  },
  noMove: 'The pawn stays put.',

  victory: (team) => `${team} win!`,
  victorySub: 'First to reach the finish.',
  ranking: 'Standings',
  playAgain: 'Play again',
  newSetup: 'New setup',

  rulesTitle: 'Tick Talk rules',
  exit: 'Exit',
  exitTitle: 'Leave the game?',
  exitBody: 'The game is saved. You can pick it up later with “Continue saved game”.',
  exitConfirm: 'Leave game',
  keepPlaying: 'Keep playing',
  close: 'Close',
  rulesSections: [
    {
      title: 'The goal',
      body: 'Be the first to enter the Finish, after square 36. Squares alternate blue and yellow all the way: Start blue, square 1 yellow, square 2 blue… Teams play in order and, within each team, the describer changes every turn.',
    },
    {
      title: 'A turn',
      body: 'The card has two sides, blue and yellow, with 5 words each. The turn starts on the side matching your pawn’s square (blue square, blue side; yellow square, yellow side). Every time the team guesses a word, the card turns over to the other side: 10 words to describe before time runs out.',
    },
    {
      title: 'Not allowed',
      body: 'Saying the word or part of it, spelling it or saying the first letter, using “rhymes with” or “sounds like”, translating it, or pointing at an object with the name.',
    },
    {
      title: 'Moving',
      body: 'The pawn moves one square per guessed word, and play passes to the next team, in order.',
    },
    {
      title: 'Checking (a phone per team or per person)',
      body: 'When each team (or each person) has a phone, at the end of the turn the next team sees the marked words and may cancel any that broke the rules. Their decision is final. With a single phone there is no checking.',
    },
  ],
  shortcuts: 'Keyboard shortcuts',
  shortcutsDescriber: 'On the describer screen',
  shortcutsTable: 'On the table',
  shortcutList: {
    describer: [
      ['Space', 'ready, start; at the end, next turn'],
      ['1–5', 'mark a word (the card turns over)'],
      ['Backspace', 'undo the last hit'],
      ['P', 'pause or resume'],
      ['Enter', 'end the turn'],
    ],
    table: [
      ['Space', 'continue'],
      ['Z', 'undo this turn'],
      ['?', 'rules'],
      ['Esc', 'close'],
    ],
  },

  youExplain: (name) => `${name}, you’re describing`,
  teamLine: (team, square, side) => `${team} · ${square <= 0 ? 'Start' : `square ${square}`} · ${side} side`,
  hitsCount: (n) => `${n} of 10 guessed`,
  describerHelp1: 'Tap a word when your team gets it (or press 1–5): the card turns over to the other side.',
  undoHit: 'Undo last hit',
  describerHelp2: 'Don’t say the word, parts of it, or “rhymes with”.',
  endTurn: 'End turn',
  handoffTitle: (mode, name) => (mode === 'playerPhones' ? `${name}, you’re describing` : `Pass the phone to ${name}`),
  handoffDevice: { phone: 'Pass the phone', teamPhones: 'Pass the phone', playerPhones: 'Your turn' },

  connectTeamPhones: 'Connect the team phones',
  connectTeamPhonesHelpBefore: 'Each team scans the code or opens ',
  connectTeamPhonesHelpAfter: '. Once the game starts, each phone picks its team.',
  pickTeamTitle: 'Which team are you?',
  pickTeamHelp: 'This phone stays with the team you choose. Each team uses one phone.',
  teamTaken: 'already has a phone',
  refusedTeam: (name) => `${name} already has a phone. Pick another team.`,
  yourTeam: (name) => `Your team: ${name}`,
  changeTeam: 'Change team',

  homeCreate: 'Create room',
  homeCreateHelp: 'This screen becomes the table: it shows everyone the board, and the room code for the phones to join.',
  homeJoin: 'Join a room',
  homeJoinHelp: 'Type the 4-letter code shown on the table.',

  roomLabel: 'Room',
  roomTitle: 'Which room are you playing in?',
  roomHelp: 'Type the 4-letter code shown on the PC screen.',
  roomCode: 'Room code',
  roomNotFound: (code) => `Couldn’t find room ${code}. Check the code on the PC (or wait for the table to open).`,
  roomInvalid: 'The code has 4 letters.',
  enterRoom: 'Join',

  connectEveryone: 'Connect everyone’s phones',
  connectEveryoneHelpBefore: 'Each person scans the code or opens ',
  connectEveryoneHelpAfter: ', writes their name and picks a team.',
  playersFromPhones: 'Players (join from their phones)',
  noPlayersYet: 'Nobody has picked this team yet.',
  withoutTeam: (names) => `No team yet: ${joinNames(names, 'and')}`,
  removePlayer: (name) => `Take ${name} off the team`,
  playerOffline: (name) => `${name} (disconnected)`,
  needPhonesPerTeam: 'This team needs at least 2 people. Ask someone else to pick it on their phone.',
  nameTitle: 'What’s your name?',
  nameHelp: 'It’s the name your team and the table will see.',
  nameLabel: 'Your name',
  namePlaceholder: 'Ann',
  nameTaken: 'Someone with that name is already connected. Use another (for example, with your surname’s initial).',
  removedByTable: 'The table took you off the list. Write your name to join again.',
  hello: (name) => `Hi, ${name}!`,
  pickTeamHelpPlayer: 'Tap the team you’ll play for. You can change until the game starts.',
  nobodyYet: 'Nobody yet',
  lobbyWaiting: 'Waiting for the game to start on the PC. Keep this page open.',
  changeName: 'Change name',
  whoAreYouTitle: 'Who are you?',
  whoAreYouHelp: 'The game has started. Tap your name.',
  alreadyConnected: 'already connected',
  notInList: 'Not on the list? Whoever is at the PC can start a new game with you.',
  yourTeamPlaying: 'Your team is playing: guess!',
  youAre: (name, team) => `${name} · ${team}`,
  turnOf: (team) => `${possessiveEn(team)} turn`,
  spectatorHelp: 'The words only show on the describer’s phone.',
  checkingNow: (validator) => `${validator} are checking.`,
  phoneValidateTitle: (team) => `Check ${possessiveEn(team)} turn`,
  validatingOnPhone: (validator) => `Being checked on ${possessiveEn(validator)} phone…`,
  validatingOnPhoneHelp: 'The other team sees the words and checks them on their phone. The game carries on once they confirm.',
  teamPhoneOn: 'phone connected',
  teamPhoneOff: 'no phone',
  waitingNextTurn: 'Waiting for the next turn.',
  aboutToExplain: (name) => `${name} is about to describe`,
  startsSoon: 'The timer starts when they press Start.',
  imReady: 'I’m ready',
  start: 'Start',
  readyHint: 'Hide the screen from the others. The timer starts when you press Start.',
  flippedNotice: (side) => `The card flipped to the ${side} side`,
  lookAtTable: 'Time! Look at the table.',
  lookAtTableHelp: 'The other team is checking your words.',
  lookAtTableHelpNoValidation: 'The result shows on the table.',
  waitingGame: 'Waiting for the game to start…',
  waitingGameHelp: 'Set up the teams on the PC and press “Start the game”.',
  waitingHost: 'Waiting for the table…',
  waitingHostHelp: 'Check that the game is open on the PC.',
  reconnecting: 'Reconnecting…',
  replacedHostTitle: 'Tick Talk is open in another window',
  replacedHostHelp: 'Only one table can be connected to the server at a time. Close the other window or tab, or carry on here.',
  replacedDescriberTitle: 'This page is open in another tab',
  replacedDescriberHelp: 'Only one tab can be connected at a time. Close the other one, or carry on here.',
  useThisWindow: 'Use this window',
  busy: 'Someone is already describing',
  busyHelp: 'Only one phone can describe at a time. This page connects by itself when the other one leaves.',
  gameOver: 'Game over!',
  pausedWordsHidden: 'The words are hidden while paused.',
  wordButton: (n, word) => `${n}. ${word}`,
  secondsLeft: (s) => `${s} seconds`,
};

export const STRINGS: Record<Language, Strings> = { pt, en };
