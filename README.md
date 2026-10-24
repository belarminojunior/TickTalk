# Tick Talk

**Explica cinco palavras antes que o tempo acabe.**

Um jogo de tabuleiro para o browser, para jogar em equipas à volta de um PC. Quem explica vê uma carta com 5 palavras e tenta que a sua equipa as adivinhe em 30 segundos. No fim, a equipa adversária valida as palavras, lança-se o dado (0–2) e o peão avança no tabuleiro. Ganha quem chegar primeiro à Chegada.

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
- o endereço para o telemóvel: `http://<IP do PC>:5174/explicar`;
- um QR code com esse endereço.

Depois, no PC:

1. Escolhe **como vão jogar** (ver abaixo).
2. Escreve as **equipas** (2 a 6) e os jogadores de cada uma, **pela ordem em que explicam**, separados por vírgulas. Toca no peão para mudar a cor.
3. Escolhe as **regras da casa**: tempo por vez, quem valida, com ou sem dado, língua das cartas e pacotes de palavras.
4. Carrega em **Começar o jogo**.

O jogo fica guardado no browser do PC a cada jogada. Se fechares a página, aparece **Continuar jogo guardado** na configuração.

### Os três modos de ecrã

| Modo | Mesa | Quem explica |
|---|---|---|
| **PC + telemóvel** (recomendado) | PC/TV em `/` | Telemóvel em `/explicar`, passa de mão em mão a cada vez |
| **Duas janelas no PC** | Janela principal | Segunda janela (botão “Abrir janela de quem explica”), por exemplo num segundo monitor |
| **Um só ecrã** | Aparece antes e depois da vez | Ocupa o ecrã durante a vez |

## Ligar o telemóvel

1. O telemóvel tem de estar **na mesma rede Wi-Fi** que o PC.
2. Lê o QR code (no terminal ou no ecrã de configuração) com a câmara, ou escreve o endereço `http://<IP do PC>:5174/explicar` no browser do telemóvel.
3. Na configuração aparece **“1 telemóvel ligado”**.

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

## Regras

- **Tabuleiro:** 36 casas, alternadas azul e amarela (ímpar = azul, par = amarela). A Partida conta como azul.
- **Cartas:** cada carta tem dois lados, azul e amarelo, com 5 palavras cada. A vez começa no lado da **cor da casa onde está o peão** da equipa.
- **A vez:** quem explica toca na palavra quando a equipa acerta, e **a carta vira para o outro lado**. Há 10 palavras por vez (5 azuis + 5 amarelas). Um toque por engano desfaz-se com **Desfazer último acerto** (ou Backspace). A mesa vê o contador e as 10 ranhuras a encher, e qual lado está virado para cima, mas não as palavras. **O peão avança uma casa no tabuleiro a cada acerto, em tempo real**; é provisório: no fim recua as palavras anuladas e o valor do dado.
- **Não vale:** dizer a palavra ou parte dela, soletrar ou dizer a letra inicial, usar “rima com” / “soa como”, traduzir diretamente para outra língua, apontar para um objeto com o nome.
- **Validação:** a equipa seguinte vê os dois lados da carta, com as palavras marcadas, e pode anular as que quebraram as regras (ou escolhe-se “Sem validação”).
- **Com dado (0, 0, 1, 1, 2, 2):** avança-se `válidas − dado` casas (nunca para trás).
- **Sem dado:** avança-se uma casa por cada palavra válida.
- **Passar a vez:** no fim da vez, quem explica carrega em **Passar a vez** no telemóvel (ou na janela de quem explica) e entrega-o a quem joga a seguir. A mesa só mostra este botão no modo "Um só ecrã", ou se a tela de quem explica estiver desligada.
- **Desfazer esta vez** (na mesa) volta à validação (um nível).
- **Vitória:** a primeira equipa a chegar ou passar a casa 36.

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

A porta do servidor pode ser mudada com a variável `TICKTALK_PORT` (por omissão 5174).

### Estrutura

```
server/            servidor Node: serve dist/, /api/info, relay WebSocket em /ws, QR no terminal
scripts/           gerador das cartas (listas de palavras PT e EN)
src/
  game/            regras puras: reducer, seletores (vistas da mesa e de quem explica), tabuleiro,
                   baralho, dado, gravação
  net/             protocolo versionado, DescriberHub (um explicador de cada vez) e os 3 transportes:
                   LocalTransport, BroadcastChannelTransport, WebSocketTransport
  components/      Tabuleiro, peões, dados, cartas, painéis…
  screens/         Configuração, Mesa, Quem explica, Validação, Dado/fim da vez
  hooks/, audio/, i18n/, data/
```

O **anfitrião (a mesa) é a fonte da verdade**: o estado vive só aí, num reducer puro. A tela de quem explica envia apenas comandos (`READY`, `START`, `TOGGLE_WORD`, `PAUSE`, `RESUME`, `END_EARLY`) e recebe a sua vista. As palavras da carta só são enviadas para a tela de quem explica; a mesa só as mostra a partir da validação.

### Cartas

`src/data/cards.pt.json` e `src/data/cards.en.json` têm 160 cartas cada, geradas por `scripts/generate-cards.mjs` a partir de listas de palavras originais (pacotes Pessoas, Lugares, Coisas, Entretenimento e Moçambique). Uma carta entra no baralho só se os pacotes dos dois lados estiverem selecionados. As cartas não se repetem até o baralho acabar.

## Limitações conhecidas

- O servidor guarda só uma mesa de cada vez (uma partida por servidor).
- O modo telemóvel precisa do servidor (`npm run play` ou `npm run dev`); `vite preview` sozinho não chega.
- Sem HTTPS, alguns browsers de telemóvel não dão Wake Lock; nesse caso, aumenta o tempo de bloqueio do ecrã do telemóvel.
- O modo "Duas janelas" usa `BroadcastChannel`: as duas janelas têm de estar no mesmo browser do mesmo PC.
- As palavras repetem-se entre cartas diferentes (cada palavra aparece em média 1–2 vezes no baralho).
