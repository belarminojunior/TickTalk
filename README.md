# Tick Talk

**Explica cinco palavras antes que o tempo acabe.**

Um jogo de tabuleiro para o browser, para jogar em equipas à volta de um PC. Quem explica vê uma carta com 5 palavras e tenta que a sua equipa as adivinhe em 30 segundos. O peão avança uma casa por cada palavra acertada (com um telemóvel por equipa ou por pessoa, a equipa adversária pode anular as que quebraram as regras). Ganha quem chegar primeiro à Chegada.

Cada mesa abre uma **sala** com um código de 4 letras (por exemplo `KQTR`): os telemóveis entram nessa sala, na mesma rede Wi-Fi ou pela internet, se o jogo estiver publicado num servidor (ver [Publicar](#publicar-deploy)).

A novidade são as **telas separadas**: quem explica vê a carta (no telemóvel, numa segunda janela ou no próprio PC) e os outros veem a mesa, com os acertos a aparecer ao vivo, sem revelar as palavras.

> "Tick Talk" é um jogo original. As palavras das cartas foram todas escritas para este projeto.

---

## Instalar

Precisas do [Node.js](https://nodejs.org/) 20 ou mais recente.

```bash
npm install
```

## Jogar

```bash
npm run play
```

Isto faz a build e arranca o servidor local em `0.0.0.0:5174`. No terminal aparecem:

- o endereço da mesa: **http://localhost:5174/** (abre no PC, de preferência em ecrã inteiro com F11);
- o endereço do PC na rede local, `http://<IP do PC>:5174/`.

Na mesa aparece o **código da sala** e um **QR code** que abre `…/explicar?sala=CÓDIGO` no telemóvel. Quem abrir só `…/explicar` escreve o código no telemóvel.

Depois, no PC:

1. Escolhe **como vão jogar** (ver abaixo).
2. Escreve as **equipas** (2 a 6) e os jogadores de cada uma, **pela ordem em que explicam**, separados por vírgulas. Toca no peão para mudar a cor. Para equipas ao calhas, carrega em **Sortear equipas**, escreve os nomes de todas as pessoas e escolhe quantas equipas: o jogo reparte-as ao acaso e os nomes das equipas ficam como estão.
3. Escolhe as **regras da casa**: tempo por vez e língua das cartas. Joga-se sempre com o baralho todo.
4. Carrega em **Começar o jogo**.

O jogo fica guardado no browser do PC a cada jogada. Se fechares a página, aparece **Continuar jogo guardado** na configuração.

### Os três modos de jogo

| Modo | Mesa | Telemóveis |
|---|---|---|
| **PC + telemóvel** | PC/TV em `/` | Um telemóvel, passa de mão em mão a cada vez. Sem validação |
| **Um telemóvel por equipa** | PC/TV em `/` | Cada equipa tem o seu: quem explica usa o da sua equipa e a equipa adversária valida no dela |
| **Um telemóvel por pessoa** | PC/TV em `/` | Cada pessoa usa o seu: escreve o nome, escolhe a equipa, e vê a carta quando é a sua vez de explicar |

### Um telemóvel por equipa

- Todas as equipas abrem o **mesmo endereço** (ou leem o mesmo QR code). Quando o jogo começa, cada telemóvel escolhe a sua equipa ("Qual é a tua equipa?") e fica a lembrar-se dela. Cada equipa só pode ter um telemóvel.
- **Na vez da tua equipa**, o telemóvel funciona como no modo normal: carta, palavras, "Passar a vez".
- **Quando a tua equipa valida** a vez de outra, o telemóvel mostra os dois lados da carta com **Válida | Anular** e o botão para confirmar. A validação aparece só no telemóvel dessa equipa; a mesa mostra apenas "A validar no telemóvel das Gazelas…".
- **Nas outras alturas**, o telemóvel mostra de quem é a vez, o contador e o tempo, mas nunca as palavras.
- Se o telemóvel da equipa que valida não estiver ligado, valida-se na mesa. Se o telemóvel da equipa que joga cair, o tempo pára.
- Nos cartões das equipas, na mesa, aparece "telemóvel ligado" ou "sem telemóvel".

### Um telemóvel por pessoa

- Cada pessoa lê o QR code da mesa (ou escreve o código da sala), escreve **o seu nome** e toca na **sua equipa**. Pode trocar de equipa ou de nome até o jogo começar. Dois telemóveis ligados não podem ter o mesmo nome.
- Na mesa, cada equipa mostra quem entrou (com um × para tirar alguém). **Sortear equipas** mistura toda a gente que entrou pelas equipas, ao acaso. Quem explica primeiro, em cada equipa, é quem entrou primeiro nela.
- Os nomes e as cores das equipas escrevem-se na mesa, como nos outros modos.
- **Durante a vez**, só o telemóvel de quem explica mostra a carta. Os colegas de equipa veem "A tua equipa está a jogar: adivinha!", o tempo e os acertos; as outras equipas veem a vez sem as palavras.
- **No fim da vez**, todos os telemóveis da equipa adversária (a seguinte) recebem a carta para validar: qualquer pessoa dessa equipa pode anular palavras e confirmar. A mesa só mostra "A validar no telemóvel das Gazelas…".
- Quem explica passa a vez no seu telemóvel. Se o telemóvel de quem explica cair, o tempo pára.
- Se alguém trocar de telemóvel a meio do jogo, o telemóvel novo pergunta "Quem és tu?" e mostra os nomes dos jogadores.

## Ligar o telemóvel

1. Com `npm run play`, o telemóvel tem de estar **na mesma rede Wi-Fi** que o PC. Com o jogo publicado num servidor, basta ter internet.
2. Lê o QR code do ecrã de configuração com a câmara, ou abre `…/explicar` no browser do telemóvel e escreve o **código da sala** que aparece na mesa.
3. Na configuração aparece **“1 telemóvel ligado”**.

O código da sala fica guardado no PC: se recarregares a mesa, ela volta à mesma sala e os telemóveis voltam a ligar-se sozinhos. Um código errado mostra “Não encontrei a sala”.

Durante o jogo o telemóvel passa de mão em mão: em cada vez, quem explica carrega em **Estou pronto/a** e depois em **Começar**. O ecrã do telemóvel não se apaga enquanto o jogo está aberto (Wake Lock, nos browsers que o suportam).

Se a ligação cair, o tempo pára e a mesa mostra **“Telemóvel desligado”**. O telemóvel volta a ligar-se sozinho; carrega em **Retomar** para continuar. Só um telemóvel pode explicar de cada vez: um segundo telemóvel vê “Já há alguém a explicar”.

### Firewall do Windows

Na primeira vez que corres `npm run play`, o Windows pode perguntar se deixa o **Node.js** comunicar na rede. Escolhe **Redes privadas** e carrega em **Permitir acesso**.

Se o telemóvel não abrir a página:

1. Confirma que a rede Wi-Fi do PC está marcada como **Privada** (Definições → Rede e Internet → Wi-Fi → a tua rede → Tipo de perfil de rede: Privada).
2. Abre **Segurança do Windows → Firewall e proteção de rede → Permitir uma aplicação através da firewall**, carrega em **Alterar definições** e marca **Node.js JavaScript Runtime** na coluna **Privada**.
3. Em alternativa, numa janela do PowerShell **como administrador**:

   ```powershell
   New-NetFirewallRule -DisplayName "Tick Talk" -Direction Inbound -Protocol TCP -LocalPort 5174 -Action Allow -Profile Private
   ```

Se o PC tiver várias redes (VPN, máquinas virtuais), o terminal mostra todos os endereços; usa o da rede Wi-Fi.

## Publicar (deploy)

O jogo é um único servidor Node (páginas + WebSocket), por isso pode ser publicado em qualquer serviço que corra Node ou Docker com WebSockets (por exemplo Render, Railway, Fly.io ou um VPS). Cada mesa abre a sua sala, por isso vários grupos podem jogar ao mesmo tempo no mesmo servidor.

- **Com Node:** comando de build `npm ci && npm run build`, comando de arranque `npm start`. O servidor escuta na porta da variável `PORT` (que estes serviços definem).
- **Com Docker:** há um `Dockerfile` pronto (`docker build -t tick-talk .` e `docker run -p 8080:8080 tick-talk`).
- **Verificação de saúde:** `GET /healthz` responde `{"ok":true,…}`.
- Usa **HTTPS** (os serviços acima dão-no de origem): a página liga-se por `wss://` sozinha e o ecrã do telemóvel não se apaga (Wake Lock).
- As salas vivem na memória do servidor. Se o servidor reiniciar, cada mesa recria a sua sala com o mesmo código quando se volta a ligar, e o jogo continua (o estado está guardado no browser do PC). Usa **uma só instância** do servidor: as salas não são partilhadas entre instâncias.
- Uma sala vazia é apagada ao fim de 6 horas. Cada sala aceita até 40 telemóveis.

## Regras

- **Tabuleiro:** Partida, 36 casas e Chegada, com as cores sempre alternadas do princípio ao fim: Partida azul, casa 1 amarela, casa 2 azul, … casa 36 azul, Chegada amarela.
- **Cartas:** cada carta tem dois lados, azul e amarelo, com 5 palavras cada. A vez começa no lado da **cor da casa onde está o peão** da equipa.
- **A vez:** quem explica toca na palavra quando a equipa acerta, e **a carta vira para o outro lado**. Há 10 palavras por vez (5 azuis + 5 amarelas). Um toque por engano desfaz-se com **Desfazer último acerto** (ou Backspace). A mesa vê o contador e as 10 ranhuras a encher, e qual lado está virado para cima, mas não as palavras. **O peão avança uma casa no tabuleiro a cada acerto, em tempo real**; com validação, no fim recua as palavras anuladas.
- **Não vale:** dizer a palavra ou parte dela, soletrar ou dizer a letra inicial, usar “rima com” / “soa como”, traduzir diretamente para outra língua, apontar para um objeto com o nome.
- **Avanço:** uma casa por cada palavra válida.
- **Validação (só com um telemóvel por equipa):** a equipa seguinte vê, no telemóvel dela, os dois lados da carta com as palavras marcadas e pode anular as que quebraram as regras. Com um só telemóvel não há validação: todas as palavras marcadas contam.
- **Passar a vez:** no fim da vez, quem explica carrega em **Passar a vez** no telemóvel e entrega-o a quem joga a seguir. A mesa só mostra este botão se o telemóvel estiver desligado.
- **Desfazer esta vez** (na mesa, só com validação) volta à validação (um nível).
- **Vitória:** a primeira equipa cujo peão entra na Chegada (depois da casa 36). Parar na casa 36 ainda não ganha.

### Atalhos de teclado

| Tela de quem explica | | Mesa | |
|---|---|---|---|
| `Espaço` | pronto/a, começar; no fim, passar a vez | `Espaço` | continuar |
| `1`–`5` | marcar palavra (a carta vira) | `Z` | desfazer esta vez |
| `Backspace` | desfazer último acerto | | |
| `P` | pausar / retomar | `?` | regras |
| `Enter` | terminar a vez | `Esc` | fechar |

## Desenvolvimento

```bash
npm run dev     # Vite (5173) + servidor WebSocket (5174), acessível na rede local
npm test        # testes (Vitest + React Testing Library)
npm run build   # verificação de tipos + build de produção em dist/
npm run cards   # volta a gerar as cartas a partir de scripts/generate-cards.mjs
```

No modo `dev`, abre `http://localhost:5173/` no PC e `http://<IP do PC>:5173/explicar` no telemóvel (o Vite reencaminha `/ws` e `/api` para o servidor).

A porta do servidor pode ser mudada com a variável `TICKTALK_PORT` (ou `PORT`; por omissão 5174). `TICKTALK_PORT` tem prioridade.

### Estrutura

```
server/            servidor Node: serve dist/, /api/info, /healthz, salas e relay WebSocket em /ws
scripts/           gerador das cartas (listas de palavras PT e EN)
src/
  game/            regras puras: reducer, seletores (vistas da mesa e de quem explica), tabuleiro,
                   baralho, gravação
  net/             protocolo versionado, DescriberHub (um explicador de cada vez), TeamHub (um telemóvel por equipa),
                   PlayerHub (um telemóvel por pessoa) e o transporte:
                   WebSocketTransport (e LocalTransport, em memória, para os testes)
  components/      Tabuleiro, peões, cartas, painéis…
  screens/         Configuração, Mesa, Quem explica, Validação, fim da vez
  hooks/, audio/, i18n/, data/
```

O **anfitrião (a mesa) é a fonte da verdade**: o estado vive só aí, num reducer puro. A tela de quem explica envia apenas comandos (`READY`, `START`, `TOGGLE_WORD`, `PAUSE`, `RESUME`, `END_EARLY`) e recebe a sua vista. As palavras da carta só são enviadas para a tela de quem explica; a mesa só as mostra a partir da validação.

### Cartas

`src/data/cards.pt.json` e `src/data/cards.en.json` têm 240 cartas cada (cerca de 1500 palavras por língua), geradas por `scripts/generate-cards.mjs` a partir de listas de palavras originais, em sete pacotes: Pessoas (famosos e personagens), Lugares (países, cidades e monumentos do mundo), Coisas, Entretenimento, Futebol (jogadores, clubes e estádios), Anime e Moçambique. Cada jogo usa as 240 cartas da língua escolhida. As cartas não se repetem até o baralho acabar.

## Limitações conhecidas

- As salas vivem na memória de uma instância do servidor (não escala para várias instâncias).
- Com um telemóvel por pessoa, quem chega depois de o jogo começar não pode entrar numa equipa: começa-se um jogo novo (as equipas ficam).
- O modo telemóvel precisa do servidor (`npm run play` ou `npm run dev`); `vite preview` sozinho não chega.
- Sem HTTPS, alguns browsers de telemóvel não dão Wake Lock; nesse caso, aumenta o tempo de bloqueio do ecrã do telemóvel.
- As palavras repetem-se entre cartas diferentes (cada palavra aparece em média 1–2 vezes no baralho).
