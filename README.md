# Tick Talk

**Explica cinco palavras antes que o tempo acabe.**

Um jogo de tabuleiro para o browser, para jogar em equipas à volta de um PC. Quem explica vê uma carta com 5 palavras e tenta que a sua equipa as adivinhe em 30 segundos. O peão avança uma casa por cada palavra acertada (com um telemóvel por equipa ou por pessoa, a equipa adversária pode anular as que quebraram as regras). Ganha quem chegar primeiro à Chegada.

Na página inicial há **Criar sala** (este ecrã fica a mesa) e **Entrar numa sala** (para os telemóveis). Cada sala tem um código de 4 letras (por exemplo `KQTR`). Não é preciso servidor: a mesa e os telemóveis ligam-se diretamente uns aos outros pela internet (WebRTC), por isso o jogo é só um site estático (por exemplo na Vercel).

A novidade são as **telas separadas**: quem explica vê a carta (no telemóvel, numa segunda janela ou no próprio PC) e os outros veem a mesa, com os acertos a aparecer ao vivo, sem revelar as palavras.

> "Tick Talk" é um jogo original. As palavras das cartas foram todas escritas para este projeto.

---

## Instalar

Precisas do [Node.js](https://nodejs.org/) 20 ou mais recente.

```bash
npm install
```

## Jogar

Abre o site (publicado, ou `npm run play` no PC) e escolhe:

- **Criar sala** no PC ou TV que vai ser a mesa (de preferência em ecrã inteiro, com F11). A mesa abre em `/mesa` e mostra o **código da sala** e um **QR code**.
- **Entrar numa sala** em cada telemóvel: escreve o código, ou lê o QR code da mesa (abre `/explicar?sala=CÓDIGO`).

Depois, na mesa:

1. Escolhe **como vão jogar** (ver abaixo).
2. Escreve as **equipas** (2 a 6) e os jogadores de cada uma, **pela ordem em que explicam**, separados por vírgulas. Toca no peão para mudar a cor. Para equipas ao calhas, carrega em **Sortear equipas**, escreve os nomes de todas as pessoas e escolhe quantas equipas: o jogo reparte-as ao acaso e os nomes das equipas ficam como estão.
3. Escolhe as **regras da casa**: tempo por vez e língua das cartas. Joga-se sempre com o baralho todo.
4. Carrega em **Começar o jogo**.

O jogo fica guardado no browser do PC a cada jogada. Se fechares a página, aparece **Continuar jogo guardado** na configuração. A mesa guarda também o código da sala: se recarregares, volta à mesma sala e os telemóveis voltam a ligar-se sozinhos.

Para jogar no PC sem publicar, `npm run play` faz a build e abre o site em `http://localhost:5174/`; os telemóveis abrem o endereço de rede que o terminal mostra (`http://<IP do PC>:5174/`). Mesmo assim precisa de internet, para a mesa e os telemóveis se encontrarem.

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

1. No telemóvel, abre o site e carrega em **Entrar numa sala**, ou lê o QR code da mesa com a câmara.
2. Escreve o **código da sala** que aparece na mesa. Um código errado mostra “Não encontrei a sala” (e o telemóvel entra sozinho assim que a mesa abrir essa sala).
3. Na mesa aparece **“1 telemóvel ligado”**.

O telemóvel e a mesa só precisam de internet; não têm de estar na mesma rede Wi-Fi. O ecrã do telemóvel não se apaga enquanto o jogo está aberto (Wake Lock, nos browsers que o suportam, em HTTPS).

Se a ligação cair, o tempo pára e a mesa mostra **“Telemóvel desligado”**. O telemóvel volta a ligar-se sozinho; carrega em **Retomar** para continuar.

### Como funciona a ligação

A mesa e os telemóveis falam diretamente uns com os outros (WebRTC, com a biblioteca [PeerJS](https://peerjs.com/)). Para se encontrarem, usam por um instante o serviço público e gratuito do PeerJS (só para a apresentação; o jogo não passa por lá). Em redes que bloqueiam ligações diretas (algumas redes móveis ou de empresas), o PeerJS usa um retransmissor gratuito.

## Publicar (deploy)

O jogo é um **site estático**: não há servidor para manter.

- **Vercel:** importa o repositório. O `vercel.json` já tem o comando de build (`npm run build`), a pasta (`dist`) e o encaminhamento de `/mesa` e `/explicar` para a aplicação.
- **Outros (Netlify, GitHub Pages, Cloudflare Pages…):** publica a pasta `dist` e encaminha todas as rotas para `index.html`.
- Usa HTTPS (os serviços acima dão-no de origem): o WebRTC e o Wake Lock precisam dele fora do `localhost`.

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
npm run dev     # Vite em 5173, acessível na rede local
npm test        # testes (Vitest + React Testing Library)
npm run build   # verificação de tipos + build de produção em dist/
npm run play    # build + vite preview em 5174 (rede local)
npm run cards   # volta a gerar as cartas a partir de scripts/generate-cards.mjs
```

### Estrutura

```
scripts/           gerador das cartas (listas de palavras PT e EN)
src/
  game/            regras puras: reducer, seletores (vistas da mesa e de quem explica), tabuleiro,
                   baralho, gravação
  net/             protocolo versionado, DescriberHub (um explicador de cada vez), TeamHub (um telemóvel por equipa),
                   PlayerHub (um telemóvel por pessoa) e o transporte: PeerTransport (WebRTC/PeerJS, salas)
                   e LocalTransport (em memória, para os testes)
  components/      Tabuleiro, peões, cartas, painéis…
  screens/         Início, Configuração, Mesa, Quem explica, Validação, fim da vez
  hooks/, audio/, i18n/, data/
```

O **anfitrião (a mesa) é a fonte da verdade**: o estado vive só aí, num reducer puro. Os telemóveis enviam apenas comandos (`READY`, `START`, `TOGGLE_WORD`, `PAUSE`, `RESUME`, `END_EARLY`, validação…) e recebem a sua vista. As palavras da carta só são enviadas para o telemóvel de quem explica (e, no fim, para a equipa que valida); a mesa só as mostra a partir da validação.

### Cartas

`src/data/cards.pt.json` e `src/data/cards.en.json` têm 240 cartas cada (cerca de 1500 palavras por língua), geradas por `scripts/generate-cards.mjs` a partir de listas de palavras originais, em sete pacotes: Pessoas (famosos e personagens), Lugares (países, cidades e monumentos do mundo), Coisas, Entretenimento, Futebol (jogadores, clubes e estádios), Anime e Moçambique. Cada jogo usa as 240 cartas da língua escolhida. As cartas não se repetem até o baralho acabar.

## Limitações conhecidas

- Para a mesa e os telemóveis se encontrarem, o jogo usa o serviço público do PeerJS; se esse serviço estiver em baixo, não é possível abrir salas.
- Em algumas redes muito fechadas a ligação direta falha e passa pelo retransmissor do PeerJS, que pode ser mais lento.
- Com um telemóvel por pessoa, quem chega depois de o jogo começar não pode entrar numa equipa: começa-se um jogo novo (as equipas ficam).
- As palavras repetem-se entre cartas diferentes (cada palavra aparece em média 1–2 vezes no baralho).
