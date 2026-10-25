#!/usr/bin/env node
/**
 * Generates src/data/cards.pt.json and src/data/cards.en.json from the word lists below.
 * Every word was written for Tick Talk. Edit the lists and run `npm run cards`.
 *
 * Rules: each side has 5 unique words from a single pack; the two sides of a card come from
 * different packs (so they never share words); generation is deterministic (fixed seed).
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CARDS_PER_LANGUAGE = 240;
const WORDS_PER_SIDE = 5;

const list = (text) =>
  text
    .split('\n')
    .flatMap((line) => line.split(';'))
    .map((w) => w.trim())
    .filter(Boolean);

// Names that are the same in both languages.
const FOOTBALL_PLAYERS = list(`
  Cristiano Ronaldo; Lionel Messi; Pelé; Maradona; Eusébio; Mário Coluna; Zinedine Zidane; Ronaldinho
  Ronaldo Nazário; Neymar; Kylian Mbappé; Erling Haaland; Mohamed Salah; Sadio Mané; Didier Drogba
  Samuel Eto'o; George Weah; Yaya Touré; Jay-Jay Okocha; Luís Figo; Rui Costa; Deco; Pepe
  Bruno Fernandes; Bernardo Silva; João Félix; Rafael Leão; Rúben Dias; Vitinha; João Cancelo
  Ricardo Quaresma; Nani; Iker Casillas; Sergio Ramos; Xavi; Andrés Iniesta; Carles Puyol
  Fernando Torres; David Villa; Thierry Henry; Michel Platini; Franz Beckenbauer; Gerd Müller
  Johan Cruyff; Marco van Basten; Ruud Gullit; Paolo Maldini; Roberto Baggio; Francesco Totti
  Andrea Pirlo; Gianluigi Buffon; Alessandro Del Piero; Kaká; Romário; Rivaldo; Roberto Carlos
  Cafu; Zico; Garrincha; Vinícius Júnior; Rodrygo; Alisson; David Beckham; Wayne Rooney
  Steven Gerrard; Frank Lampard; Harry Kane; Jude Bellingham; Bukayo Saka; Luka Modrić
  Karim Benzema; Antoine Griezmann; Robert Lewandowski; Kevin De Bruyne; Eden Hazard
  Virgil van Dijk; Arjen Robben; Zlatan Ibrahimović; Gareth Bale; Lamine Yamal; Pedri; Rodri
  Son Heung-min; Thiago Silva; Casemiro; Manuel Neuer; Thomas Müller; Toni Kroos; Oliver Kahn
  Lev Yashin; Alfredo Di Stéfano; Ferenc Puskás; Eric Cantona; Ryan Giggs; Marta
  Alexia Putellas; Aitana Bonmatí; Sam Kerr; José Mourinho; Pep Guardiola; Jürgen Klopp
  Carlo Ancelotti; Alex Ferguson; Reinildo Mandava; Geny Catamo; Mexer
`);

const ANIME_SHARED = list(`
  Goku; Vegeta; Gohan; Piccolo; Freeza; Bulma; Krillin; Naruto; Sasuke; Kakashi; Hinata; Itachi
  Gaara; Luffy; Zoro; Nami; Sanji; Usopp; Chopper; Nico Robin; Shanks; Ichigo; Light Yagami; Ryuk
  Eren Yeager; Mikasa; Levi; Armin; Tanjiro; Nezuko; Zenitsu; Inosuke; Gon; Killua; Edward Elric
  Saitama; Genos; Deku; All Might; Bakugo; Todoroki; Sailor Moon; Totoro; Ponyo; Kiki
  Ash Ketchum; Pikachu; Charmander; Bulbasaur; Squirtle; Mewtwo; Jigglypuff; Eevee; Snorlax
  Doraemon; Nobita; Astro Boy; Shin-chan; Seiya; Yugi; Spike Spiegel; Lupin III; Inuyasha; Kirito
  Anya Forger; Loid Forger; Gojo Satoru; Itadori Yuji; Hamtaro; Agumon; Kenshin; Ranma
  Captain Tsubasa; Heidi; Marco; Dragon Ball; One Piece; Pokémon; Death Note; Bleach
  Hunter x Hunter; One Punch Man; Fullmetal Alchemist; Spy x Family; Jujutsu Kaisen; Demon Slayer
  My Hero Academia; Studio Ghibli; Kamehameha; Rasengan; Sharingan; Super Saiyajin; Shenlong
  Nuvem Voadora; Bola de Cristal; Detetive Conan; Digimon; Beyblade; Yu-Gi-Oh!; Sakura Card Captor
`);

const PT = {
  people: list(`
    Albert Einstein; Leonardo da Vinci; Cleópatra; Napoleão; Mozart; Beethoven; Pablo Picasso; Shakespeare
    Luís de Camões; Fernando Pessoa; Vasco da Gama; Cristóvão Colombo; Nelson Mandela; Mahatma Gandhi
    Martin Luther King; Marie Curie; Isaac Newton; Galileu; Charles Darwin; Frida Kahlo; Michael Jackson
    Elvis Presley; Bob Marley; Usain Bolt; Serena Williams; Michael Jordan; Muhammad Ali; Charlie Chaplin
    Walt Disney; Pai Natal; Fada dos Dentes; Branca de Neve; Cinderela; Capuchinho Vermelho; Pinóquio
    Peter Pan; Robin dos Bosques; Tarzan; Sherlock Holmes; Drácula; Frankenstein; Super-Homem
    Homem-Aranha; Batman; Mulher-Maravilha; Rato Mickey; Pato Donald; Astérix; Obélix; Tintim; Popeye
    Shrek; Bob Esponja; Harry Potter; Aladino; Mowgli; Dom Quixote; Romeu e Julieta; Hércules; Zeus
    Rainha Isabel II; Barack Obama; Abraham Lincoln; Júlio César; Joana d'Arc; Tutankamon; Buda
    Confúcio; Steve Jobs; Bill Gates; Neil Armstrong; Iuri Gagarin; Thomas Edison; Nikola Tesla
    Pitágoras; Aristóteles; Platão; Van Gogh; Miguel Ângelo; Salvador Dalí; Bach; Chopin; Vivaldi
    Amália Rodrigues; Cesária Évora; Madonna; Beyoncé; Shakira; Freddie Mercury; Mr. Bean
    Charlie Brown; Garfield; Snoopy; Homer Simpson; Scooby-Doo; Super Mario; Sonic; James Bond
    Indiana Jones; Darth Vader; Yoda; Gandalf; Elsa; Moana; Mulan; Pocahontas; Rapunzel
    Bela Adormecida; Pequena Sereia; Gato das Botas; Lobo Mau; Três Porquinhos
    Alice no País das Maravilhas; Capitão Gancho; Sininho; Rei Artur; Merlin; Ulisses; Aquiles; Cupido
    Coelho da Páscoa; Infante D. Henrique; Pedro Álvares Cabral; Fernão de Magalhães; José Saramago
    Eça de Queirós; Samora Machel; Eduardo Mondlane; Malangatana; Mia Couto; Maria Mutola
    Paulina Chiziane; Agatha Christie; Júlio Verne; Hans Christian Andersen; Irmãos Grimm
    Charles Dickens; Miguel de Cervantes; Homero; Florence Nightingale; Rosa Parks; Anne Frank
    Madre Teresa; Marco Polo; Jacques Cousteau; Steven Spielberg; Alfred Hitchcock; Marilyn Monroe
    Luciano Pavarotti; Stevie Wonder; Louis Armstrong; Whitney Houston; Ed Sheeran; Adele
    Taylor Swift; Roger Federer; Rafael Nadal; Lewis Hamilton; Ayrton Senna; Michael Phelps
    Simone Biles; Capitão América; Hulk; Thor; Homem de Ferro; Pantera Negra; Dumbo; Bambi; Simba
    Nemo; Buzz Lightyear; Woody; Minions; Estrumpfes; Pantera Cor-de-Rosa; Pica-Pau; Tom e Jerry
    Bugs Bunny; Piu-Piu; Mafalda; Lucky Luke; Zorro; Barbie; Hello Kitty; Peppa Pig; Kung Fu Panda
    Rei Salomão; Rainha de Sabá; Noé; Moisés; Gulliver; Robinson Crusoé; Ali Babá; Simbad, o Marinheiro
    Oprah Winfrey; Elon Musk; Mark Zuckerberg; Rainha Vitória; Winston Churchill; Simón Bolívar
    Kofi Annan; Desmond Tutu; Wangari Maathai; Chimamanda Ngozi Adichie; Fela Kuti; Miriam Makeba
    Youssou N'Dour; Angélique Kidjo; Burna Boy; Wizkid; Drake; Eminem; Justin Bieber; Bruno Mars
    Billie Eilish; Ariana Grande; Celine Dion; Mariah Carey; Elton John; Paul McCartney; John Lennon
    Mick Jagger; Bob Dylan; Ray Charles; Aretha Franklin; Frank Sinatra; Tina Turner; David Bowie
    Leonardo DiCaprio; Tom Hanks; Meryl Streep; Will Smith; Denzel Washington; Morgan Freeman
    Brad Pitt; Angelina Jolie; Jackie Chan; Bruce Lee; Arnold Schwarzenegger; Keanu Reeves
    Dwayne Johnson; Zendaya; Tom Cruise; Emma Watson; Stephen Hawking; Carl Sagan; Ada Lovelace
    Alan Turing; Louis Pasteur; Alexander Fleming; Johannes Gutenberg; Irmãos Wright
    Alexander Graham Bell; Hipócrates; Arquimedes; Ramsés II; Nefertiti; Carlos Magno; Rainha Ginga
    Shaka Zulu; Mansa Musa; Kwame Nkrumah; Patrice Lumumba; Julius Nyerere; Amílcar Cabral
    Agostinho Neto; Graça Machel; José Craveirinha; Noémia de Sousa; Stewart Sukuma; Lizha James
    Neyma; Wazimbo; Fany Pfumo; Dilon Djindji; Mr. Bow
  `),
  places: list(`
    Portugal; Brasil; Angola; Cabo Verde; Guiné-Bissau; São Tomé e Príncipe; Timor-Leste; África do Sul
    Zimbabué; Malawi; Tanzânia; Zâmbia; Quénia; Egito; Marrocos; Nigéria; Gana; Etiópia; Madagáscar
    Maurícias; França; Espanha; Itália; Alemanha; Inglaterra; Irlanda; Grécia; Suíça; Holanda; Rússia
    China; Japão; Índia; Austrália; Nova Zelândia; Canadá; Estados Unidos; México; Argentina; Chile
    Cuba; Jamaica; Islândia; Noruega; Suécia; Turquia; Coreia do Sul; Tailândia; Indonésia; Escócia
    Lisboa; Porto; Paris; Londres; Roma; Madrid; Barcelona; Veneza; Nova Iorque; Rio de Janeiro
    São Paulo; Luanda; Joanesburgo; Cidade do Cabo; Cairo; Tóquio; Pequim; Dubai; Moscovo; Berlim
    Amesterdão; Atenas; Istambul; Los Angeles; Las Vegas; Hollywood; Sydney; Nairobi; Lagos; Dakar
    Marraquexe; Jerusalém; Vaticano; Mónaco; Hong Kong; Singapura; Havana; Buenos Aires
    Viena; Praga; Budapeste; Varsóvia; Copenhaga; Estocolmo; Oslo; Helsínquia; Dublin; Edimburgo
    Bruxelas; Genebra; Milão; Florença; Nápoles; Sevilha; Munique; Marselha; São Petersburgo
    Toronto; Vancouver; Chicago; São Francisco; Miami; Washington; Cidade do México; Bogotá; Lima
    Montevideu; Salvador da Bahia; Brasília; Casablanca; Acra; Adis Abeba; Kigali; Harare; Lusaka
    Lilongwe; Windhoek; Durban; Pretória; Zanzibar; Seul; Banguecoque; Bali; Xangai; Mumbai; Doha
    Torre Eiffel; Estátua da Liberdade; Grande Muralha da China; Pirâmides; Coliseu; Torre de Pisa
    Big Ben; Taj Mahal; Machu Picchu; Cristo Redentor; Torre de Belém; Sagrada Família; Monte Evereste
    Kilimanjaro; Cataratas Vitória; Rio Nilo; Rio Amazonas; Deserto do Sara; Polo Norte; Polo Sul
    Antártida; Oceano Atlântico; Oceano Índico; Oceano Pacífico; Mar Mediterrâneo; Himalaias; Alpes
    Grand Canyon; Cataratas do Niágara; Stonehenge; Ópera de Sydney; Acrópole; Ilha da Páscoa; Amazónia
    Savana; Galápagos; Havai; Maldivas; Caraíbas; Madeira; Açores; Algarve; Sintra; Lua; Marte
    Petra; Angkor Wat; Chichén Itzá; Monte Fuji; Burj Khalifa; Muro de Berlim; Arco do Triunfo
    Museu do Louvre; Palácio de Buckingham; Kremlin; Times Square; Central Park; Ponte Golden Gate
    Monte Rushmore; Casa Branca; Alhambra; Mosteiro dos Jerónimos; Palácio da Pena; Ponte 25 de Abril
    Cabo da Roca; Óbidos; Coimbra; Serengeti; Delta do Okavango; Montanha da Mesa; Lago Vitória
    Rio Congo; Deserto do Kalahari; Seychelles; Cabo da Boa Esperança; Uluru; Grande Barreira de Coral
    Praia; Hospital; Escola; Aeroporto; Biblioteca; Museu; Supermercado; Farmácia; Cinema; Teatro
    Estádio; Piscina; Igreja; Mesquita; Mercado; Padaria; Talho; Restaurante; Hotel; Prisão
    Quartel de bombeiros; Esquadra da polícia; Estação de comboios; Farol; Castelo; Palácio; Ponte
    Túnel; Montanha; Vulcão; Floresta; Selva; Deserto; Ilha; Lago; Cascata; Gruta; Quinta
    Jardim zoológico; Parque de diversões; Circo; Universidade; Banco; Correios; Ginásio; Cabeleireiro
    Lavandaria; Fábrica; Oficina; Garagem; Cozinha; Casa de banho; Quarto; Sala de estar; Varanda
    Sótão; Cave; Elevador; Escada rolante; Centro comercial; Sala de aula; Recreio; Campo de futebol
    Aquário; Planetário; Observatório; Estação espacial; Iglu; Cabana; Tenda; Moinho; Arranha-céus
    Bombas de gasolina; Parque de estacionamento; Rotunda; Passadeira; Semáforo; Porto de pesca
  `),
  things: list(`
    Arco-íris; Guarda-chuva; Bicicleta; Avião; Helicóptero; Comboio; Autocarro; Barco; Submarino
    Foguetão; Mota; Ambulância; Trator; Telemóvel; Computador; Televisão; Rádio; Frigorífico
    Micro-ondas; Máquina de lavar; Aspirador; Ventoinha; Candeeiro; Vela; Lanterna; Relógio; Despertador
    Óculos; Chapéu; Sapatos; Chinelos; Meias; Camisola; Casaco; Gravata; Cachecol; Luvas; Mochila
    Carteira; Chave; Cadeado; Tesoura; Martelo; Prego; Parafuso; Escada; Pá; Balde; Vassoura
    Escova de dentes; Pasta de dentes; Sabonete; Toalha; Espelho; Pente; Secador de cabelo; Almofada
    Cobertor; Cama; Sofá; Cadeira; Armário; Gaveta; Janela; Porta; Telhado; Chaminé; Lareira; Garfo
    Faca; Colher; Prato; Copo; Chávena; Panela; Frigideira; Garrafa; Lápis; Caneta; Borracha; Régua
    Caderno; Livro; Jornal; Envelope; Selo; Mapa; Bússola; Telescópio; Microscópio; Íman; Pilha
    Lâmpada; Tomada; Balão; Papagaio de papel; Bola; Boneca; Pião; Ioiô; Puzzle; Moeda; Coroa; Anel
    Colar; Pulseira; Medalha; Troféu; Bandeira; Sino; Apito; Robô; Drone; Tablet; Impressora
    Calculadora; Teclado; Rato de computador; Pen USB; Carregador; Comando da televisão; Satélite
    Paraquedas; Trotinete; Camião; Táxi; Cofre; Lupa; Termómetro; Estetoscópio; Seringa; Penso rápido
    Óculos de sol; Elefante; Girafa; Leão; Tigre; Zebra; Hipopótamo; Rinoceronte; Crocodilo; Macaco
    Gorila; Chita; Leopardo; Hiena; Camelo; Canguru; Coala; Panda; Urso polar; Pinguim; Golfinho
    Baleia; Tubarão; Polvo; Caranguejo; Tartaruga; Cobra; Lagarto; Camaleão; Sapo; Borboleta; Abelha
    Formiga; Aranha; Mosquito; Joaninha; Caracol; Minhoca; Galinha; Galo; Pato; Vaca; Porco; Ovelha
    Cabra; Cavalo; Burro; Coelho; Rato; Gato; Cão; Papagaio; Coruja; Águia; Pombo; Flamingo; Avestruz
    Pavão; Morcego; Esquilo; Lobo; Raposa; Veado; Dinossauro; Dragão; Unicórnio; Lince; Tucano
    Beija-flor; Cisne; Gaivota; Foca; Lontra; Castor; Javali; Bisonte; Alce; Lhama; Preguiça
    Ornitorrinco; Suricata; Gnu; Búfalo; Orangotango; Chimpanzé; Lémure; Escorpião; Gafanhoto
    Libélula; Vespa; Cavalo-marinho; Estrela-do-mar; Ouriço; Toupeira; Hamster; Peixe-palhaço; Piranha
    Salmão; Pão; Queijo; Manteiga; Ovo; Leite; Iogurte; Arroz; Esparguete; Pizza; Hambúrguer
    Batatas fritas; Sopa; Salada; Bolo; Bolacha; Chocolate; Gelado; Rebuçado; Pipocas; Mel; Compota
    Sanduíche; Cachorro-quente; Gelatina; Panqueca; Croissant; Pastel de nata; Feijoada; Bacalhau
    Sushi; Tacos; Kebab; Paella; Lasanha; Croquete; Francesinha; Caldo verde; Arroz doce; Pudim
    Crepe; Waffle; Donut; Banana; Maçã; Laranja; Morango; Ananás; Melancia; Uvas; Limão; Abacate
    Kiwi; Pera; Pêssego; Cereja; Framboesa; Tomate; Cenoura; Cebola; Alho; Batata; Milho; Feijão
    Couve; Pepino; Cogumelo; Sal; Açúcar; Café; Chá; Sumo; Sol; Chuva; Neve; Trovoada; Relâmpago
    Vento; Nuvem; Estrela; Cometa; Árvore; Flor; Rosa; Girassol; Cato; Palmeira; Folha; Pedra
    Areia; Concha; Fogo; Gelo; Onda; Furacão; Eclipse; Boneco de neve; Castelo de areia
  `),
  entertainment: list(`
    Futebol; Basquetebol; Voleibol; Andebol; Ténis; Natação; Atletismo; Ciclismo; Boxe; Judo; Karaté
    Xadrez; Damas; Golfe; Surf; Esqui; Patinagem; Ginástica; Râguebi; Críquete; Basebol; Hóquei
    Fórmula 1; Maratona; Jogos Olímpicos; Campeonato do Mundo; Ioga; Ballet; Salto em altura
    Corrida de sacos; Escondidas; Apanhada; Saltar à corda; Berlindes; Jogo de cartas; Dominó; Bingo
    Karaoke; Matraquilhos; Bowling; Ténis de mesa; Pesca; Rock; Jazz; Hip-hop; Reggae; Samba; Fado
    Kizomba; Kuduro; Ópera; Música clássica; Rap; Blues; Música pop; Salsa; Tango; Valsa; Orquestra
    Banda; Coro; Concerto; Festival de música; DJ; Microfone; Auscultadores; Guitarra; Piano; Violino
    Bateria; Trompete; Saxofone; Flauta; Harpa; Acordeão; Tambor; Xilofone; Maracas; Violoncelo
    Ukulele; Filme de terror; Desenhos animados; Telenovela; Documentário; Concurso de televisão
    Telejornal; Banda desenhada; Super-herói; Realizador; Ator; Óscar; Passadeira vermelha
    Câmara de filmar; Claquete; Legendas; Trailer; Série; Episódio; Comédia; Mágico; Palhaço
    Malabarista; Acrobata; Marioneta; Musical; Videojogo; Consola; Comando; Realidade virtual; Podcast
    Selfie; Fotografia; Pintura; Escultura; Desenho; Origami; Tricô; Jardinagem; Culinária; Campismo
    Piquenique; Fogo de artifício; Carnaval; Natal; Páscoa; Ano Novo; Aniversário; Casamento; Desfile
    Montanha-russa; Carrossel; Roda gigante; Carrinhos de choque; Escorrega; Baloiço; Trampolim
    Caça ao tesouro; Sudoku; Palavras cruzadas; Adivinha; Anedota; Truque de magia; Titanic; Toy Story
    Frozen; Jurassic Park; Star Wars; O Feiticeiro de Oz; Avatar; Os Simpsons; Procurar o Nemo
    O Rei Leão; Mamma Mia; Os Incríveis; Ratatui; Divertida-Mente; Mundial de futebol; Liga dos Campeões
    Dança contemporânea; Breakdance; Flash mob; Concurso de talentos; Cabra-cega
    Jogo do galo; Pedra, papel, tesoura; Mímica; Charadas; Stand-up comedy; Teatro de fantoches
    Desporto radical; Paraquedismo; Escalada; Canoagem; Vela desportiva; Mergulho; Skate; Patins
    Minecraft; Fortnite; Tetris; Pac-Man; Roblox; Mario Kart; Among Us; Candy Crush; Jogo da glória
    Redes sociais; Influenciador; Youtuber; Emoji; Meme; Streaming; Afrobeats; Amapiano; Semba; Morna
    Funaná; Bossa nova; Flamenco; K-pop; Heavy metal; Gospel; Zouk; Reggaeton; Eurovisão; Super Bowl
    Grammy; O Senhor dos Anéis; Piratas das Caraíbas; Vingadores; Monstros e Companhia; Up
    Encanto; Zootrópolis; Gru, o Maldisposto; Mary Poppins
  `),
  football: list(`
    Benfica; FC Porto; Sporting CP; Sporting de Braga; Vitória de Guimarães; Real Madrid; FC Barcelona
    Atlético de Madrid; Sevilla FC; Manchester United; Manchester City; Liverpool; Chelsea; Arsenal
    Tottenham; Newcastle; Juventus; AC Milan; Inter de Milão; AS Roma; SSC Napoli; Bayern de Munique
    Borussia Dortmund; Paris Saint-Germain; Olympique de Marselha; Ajax; PSV Eindhoven; Celtic
    Galatasaray; Flamengo; Corinthians; Palmeiras; Santos FC; São Paulo FC; Boca Juniors; River Plate
    Al-Nassr; Inter Miami; Al Ahly; Kaizer Chiefs; Orlando Pirates; Mamelodi Sundowns; TP Mazembe
    Petro de Luanda; Primeiro de Agosto; Camp Nou; Santiago Bernabéu; Old Trafford; Anfield; Wembley
    Maracanã; Estádio da Luz; Estádio do Dragão; Estádio José Alvalade; San Siro; Allianz Arena
    La Bombonera; Bola de Ouro; Penálti; Fora de jogo; Cartão vermelho; Cartão amarelo; Guarda-redes
    Pontapé de bicicleta; Hat-trick; Árbitro; Golo de cabeça
  `).concat(FOOTBALL_PLAYERS),
  anime: list(`
    Sakura Haruno; Mestre Kame; Kame House; Ataque dos Titãs; A Viagem de Chihiro; O Meu Vizinho Totoro
    Princesa Mononoke; O Castelo Andante; Os Cavaleiros do Zodíaco; Oliver e Benji; Caderno da Morte
    Pokébola; Mochila do Doraemon; Porta Mágica; Esferas do Dragão; Titã Colossal; Espada de Samurai
  `).concat(ANIME_SHARED),
  mozambique: list(`
    Maputo; Matola; Beira; Nampula; Quelimane; Tete; Pemba; Inhambane; Xai-Xai; Lichinga; Chimoio
    Nacala; Vilankulo; Ilha de Moçambique; Ilha do Ibo; Ilha da Inhaca; Baía de Maputo; Catembe
    Ponta do Ouro; Praia do Tofo; Bilene; Arquipélago de Bazaruto; Gorongosa; Parque do Limpopo
    Reserva do Niassa; Monte Binga; Monte Namúli; Rio Zambeze; Rio Limpopo; Rio Save; Rio Rovuma
    Lago Niassa; Cahora Bassa; Ponte Maputo-Katembe; Estação Central de Maputo; Fortaleza de Maputo
    Mercado Central; Mercado do Peixe; Costa do Sol; Marginal de Maputo; Mafalala; Jardim Tunduru
    Casa de Ferro; Catedral de Maputo; Praça da Independência; Museu de História Natural
    Feira Popular; Xipamanine; Polana; Cabo Delgado; Zambézia; Sofala; Manica; Gaza
    Matapa; Xima; Mucapata; Caril de amendoim; Caril de caranguejo; Frango à zambeziana; Piri-piri
    Badjias; Chamuças; Rissóis de camarão; Camarão grelhado; Lulas grelhadas; Castanha de caju
    Mandioca; Coco; Manga; Papaia; Maçala; Matata; Tihove; Feijão nhemba; Amendoim torrado
    Sumo de maçala; Peixe seco; Lagosta; Bolo de mandioca; Pão de Inhambane
    Marrabenta; Pandza; Timbila; Mapiko; Tufo; Xigubo; Makwaela; Ngalanga; Xitende; Majika
    Capulana; Chapa; Machimbombo; Txopela; Metical; Mussiro; Esteira; Pilão; Pote de barro
    Cesto de palha; Arte maconde; Batuque; Dhow; Embondeiro; Cajueiro; Coqueiro; Mangal
    Recife de coral; Dugongo; Tubarão-baleia; Raia-manta; Tartaruga marinha; Moçambola; Mambas
    Estádio do Zimpeto; Estádio da Machava; Dia da Independência; Bandeira de Moçambique
    Hino nacional; Rádio Moçambique; Corredor da Beira; Caminho de ferro; Machamba; Palhota
    Ilha de Santa Carolina; Ilha de Benguerra; Barra; Macaneta; Namaacha; Montepuez; Angoche
    Ferroviário de Maputo; Black Bulls; UD Songo; Liga Desportiva de Maputo
  `),
};

const EN = {
  people: list(`
    Albert Einstein; Leonardo da Vinci; Cleopatra; Napoleon; Mozart; Beethoven; Pablo Picasso; Shakespeare
    Luís de Camões; Fernando Pessoa; Vasco da Gama; Christopher Columbus; Nelson Mandela; Mahatma Gandhi
    Martin Luther King; Marie Curie; Isaac Newton; Galileo; Charles Darwin; Frida Kahlo; Michael Jackson
    Elvis Presley; Bob Marley; Usain Bolt; Serena Williams; Michael Jordan; Muhammad Ali; Charlie Chaplin
    Walt Disney; Santa Claus; Tooth Fairy; Snow White; Cinderella; Little Red Riding Hood; Pinocchio
    Peter Pan; Robin Hood; Tarzan; Sherlock Holmes; Dracula; Frankenstein; Superman; Spider-Man
    Batman; Wonder Woman; Mickey Mouse; Donald Duck; Asterix; Obelix; Tintin; Popeye; Shrek; SpongeBob
    Harry Potter; Aladdin; Mowgli; Don Quixote; Romeo and Juliet; Hercules; Zeus; Queen Elizabeth II
    Barack Obama; Abraham Lincoln; Julius Caesar; Joan of Arc; Tutankhamun; Buddha; Confucius; Steve Jobs
    Bill Gates; Neil Armstrong; Yuri Gagarin; Thomas Edison; Nikola Tesla; Pythagoras; Aristotle; Plato
    Van Gogh; Michelangelo; Salvador Dalí; Bach; Chopin; Vivaldi; Amália Rodrigues; Cesária Évora
    Madonna; Beyoncé; Shakira; Freddie Mercury; Mr. Bean; Charlie Brown; Garfield; Snoopy; Homer Simpson
    Scooby-Doo; Super Mario; Sonic; James Bond; Indiana Jones; Darth Vader; Yoda; Gandalf; Elsa
    Moana; Mulan; Pocahontas; Rapunzel; Sleeping Beauty; The Little Mermaid; Puss in Boots
    Big Bad Wolf; Three Little Pigs; Alice in Wonderland; Captain Hook; Tinker Bell; King Arthur; Merlin
    Ulysses; Achilles; Cupid; Easter Bunny; Henry the Navigator; Ferdinand Magellan; José Saramago
    Samora Machel; Eduardo Mondlane; Malangatana; Mia Couto; Maria Mutola; Paulina Chiziane
    Agatha Christie; Jules Verne; Hans Christian Andersen; Brothers Grimm; Charles Dickens; Mark Twain
    Homer; Florence Nightingale; Rosa Parks; Anne Frank; Mother Teresa; Marco Polo; Jacques Cousteau
    Steven Spielberg; Alfred Hitchcock; Marilyn Monroe; Luciano Pavarotti; Stevie Wonder
    Louis Armstrong; Whitney Houston; Ed Sheeran; Adele; Taylor Swift; Roger Federer; Rafael Nadal
    Lewis Hamilton; Ayrton Senna; Michael Phelps; Simone Biles; Captain America; Hulk; Thor; Iron Man
    Black Panther; Dumbo; Bambi; Simba; Nemo; Buzz Lightyear; Woody; Minions; Smurfs; Pink Panther
    Woody Woodpecker; Tom and Jerry; Bugs Bunny; Tweety; Lucky Luke; Zorro; Barbie; Hello Kitty
    Peppa Pig; Kung Fu Panda; King Solomon; Queen of Sheba; Noah; Moses; Gulliver; Robinson Crusoe
    Ali Baba; Sinbad the Sailor; William Tell; Winnie the Pooh; Paddington; Mary Poppins; Willy Wonka
    Pippi Longstocking; Cookie Monster; Kermit the Frog; Wallace and Gromit; Oprah Winfrey; Elon Musk
    Mark Zuckerberg; Queen Victoria; Winston Churchill; Simón Bolívar; Kofi Annan; Desmond Tutu
    Wangari Maathai; Chimamanda Ngozi Adichie; Fela Kuti; Miriam Makeba; Youssou N'Dour
    Angélique Kidjo; Burna Boy; Wizkid; Drake; Eminem; Justin Bieber; Bruno Mars; Billie Eilish
    Ariana Grande; Celine Dion; Mariah Carey; Elton John; Paul McCartney; John Lennon; Mick Jagger
    Bob Dylan; Ray Charles; Aretha Franklin; Frank Sinatra; Tina Turner; David Bowie; Leonardo DiCaprio
    Tom Hanks; Meryl Streep; Will Smith; Denzel Washington; Morgan Freeman; Brad Pitt; Angelina Jolie
    Jackie Chan; Bruce Lee; Arnold Schwarzenegger; Keanu Reeves; Dwayne Johnson; Zendaya; Tom Cruise
    Emma Watson; Stephen Hawking; Carl Sagan; Ada Lovelace; Alan Turing; Louis Pasteur
    Alexander Fleming; Johannes Gutenberg; Wright Brothers; Alexander Graham Bell; Hippocrates
    Archimedes; Ramesses II; Nefertiti; Charlemagne; Queen Nzinga; Shaka Zulu; Mansa Musa
    Kwame Nkrumah; Patrice Lumumba; Julius Nyerere; Amílcar Cabral; Agostinho Neto; Graça Machel
    José Craveirinha; Noémia de Sousa; Stewart Sukuma; Lizha James; Neyma; Wazimbo; Fany Pfumo
    Dilon Djindji; Mr. Bow
  `),
  places: list(`
    Portugal; Brazil; Angola; Cape Verde; Guinea-Bissau; São Tomé and Príncipe; East Timor; South Africa
    Zimbabwe; Malawi; Tanzania; Zambia; Kenya; Egypt; Morocco; Nigeria; Ghana; Ethiopia; Madagascar
    Mauritius; France; Spain; Italy; Germany; England; Ireland; Greece; Switzerland; Netherlands; Russia
    China; Japan; India; Australia; New Zealand; Canada; United States; Mexico; Argentina; Chile
    Cuba; Jamaica; Iceland; Norway; Sweden; Turkey; South Korea; Thailand; Indonesia; Scotland; Wales
    Lisbon; Porto; Paris; London; Rome; Madrid; Barcelona; Venice; New York; Rio de Janeiro; São Paulo
    Luanda; Johannesburg; Cape Town; Cairo; Tokyo; Beijing; Dubai; Moscow; Berlin; Amsterdam
    Athens; Istanbul; Los Angeles; Las Vegas; Hollywood; Sydney; Nairobi; Lagos; Dakar; Marrakesh
    Jerusalem; Vatican City; Monaco; Hong Kong; Singapore; Havana; Buenos Aires; Vienna; Prague
    Budapest; Warsaw; Copenhagen; Stockholm; Oslo; Helsinki; Dublin; Edinburgh; Brussels; Geneva
    Milan; Florence; Naples; Seville; Munich; Marseille; Saint Petersburg; Toronto; Vancouver; Chicago
    San Francisco; Miami; Washington; Mexico City; Bogotá; Lima; Montevideo; Salvador; Brasília
    Casablanca; Accra; Addis Ababa; Kigali; Harare; Lusaka; Lilongwe; Windhoek; Durban; Pretoria
    Zanzibar; Seoul; Bangkok; Bali; Shanghai; Mumbai; Doha
    Eiffel Tower; Statue of Liberty; Great Wall of China; Pyramids; Colosseum; Leaning Tower of Pisa
    Big Ben; Taj Mahal; Machu Picchu; Christ the Redeemer; Belém Tower; Sagrada Família; Mount Everest
    Kilimanjaro; Victoria Falls; River Nile; Amazon River; Sahara Desert; North Pole; South Pole
    Antarctica; Atlantic Ocean; Indian Ocean; Pacific Ocean; Mediterranean Sea; Himalayas; The Alps
    Grand Canyon; Niagara Falls; Stonehenge; Sydney Opera House; Acropolis; Easter Island
    Amazon rainforest; Savannah; Galápagos; Hawaii; Maldives; Caribbean; Madeira; The Azores; The Moon
    Mars; Petra; Angkor Wat; Chichén Itzá; Mount Fuji; Burj Khalifa; Berlin Wall; Arc de Triomphe
    The Louvre; Buckingham Palace; The Kremlin; Times Square; Central Park; Golden Gate Bridge
    Mount Rushmore; The White House; Alhambra; Jerónimos Monastery; Pena Palace; 25 de Abril Bridge
    Cabo da Roca; Óbidos; Coimbra; Serengeti; Okavango Delta; Table Mountain; Lake Victoria
    Congo River; Kalahari Desert; Seychelles; Cape of Good Hope; Uluru; Great Barrier Reef
    Beach; Hospital; School; Airport; Library; Museum; Supermarket; Pharmacy; Cinema; Theatre
    Stadium; Swimming pool; Church; Mosque; Market; Bakery; Butcher's; Restaurant; Hotel; Prison
    Fire station; Police station; Train station; Lighthouse; Castle; Palace; Bridge; Tunnel; Mountain
    Volcano; Forest; Jungle; Desert; Island; Lake; Waterfall; Cave; Farm; Zoo; Theme park; Circus
    University; Bank; Post office; Gym; Hairdresser's; Launderette; Factory; Workshop; Garage
    Kitchen; Bathroom; Bedroom; Living room; Balcony; Attic; Basement; Lift; Escalator; Shopping centre
    Classroom; Playground; Football pitch; Aquarium; Planetarium; Observatory; Space station; Igloo
    Log cabin; Tent; Windmill; Petrol station; Car park; Roundabout; Zebra crossing; Traffic lights
    Fishing harbour; Skyscraper; Treehouse; Car wash; Ice rink
  `),
  things: list(`
    Rainbow; Umbrella; Bicycle; Aeroplane; Helicopter; Train; Bus; Boat; Submarine; Rocket; Motorbike
    Ambulance; Tractor; Mobile phone; Computer; Television; Radio; Fridge; Microwave; Washing machine
    Vacuum cleaner; Fan; Lamp; Candle; Torch; Clock; Alarm clock; Glasses; Hat; Shoes; Flip-flops
    Socks; Jumper; Coat; Tie; Scarf; Gloves; Backpack; Wallet; Key; Padlock; Scissors; Hammer; Nail
    Screw; Ladder; Shovel; Bucket; Broom; Toothbrush; Toothpaste; Soap; Towel; Mirror; Comb
    Hairdryer; Pillow; Blanket; Bed; Sofa; Chair; Wardrobe; Drawer; Window; Door; Roof; Chimney
    Fireplace; Fork; Knife; Spoon; Plate; Glass; Cup; Saucepan; Frying pan; Bottle; Pencil; Pen
    Rubber; Ruler; Notebook; Book; Newspaper; Envelope; Stamp; Map; Compass; Telescope; Microscope
    Magnet; Battery; Light bulb; Plug; Balloon; Kite; Ball; Doll; Spinning top; Yo-yo; Jigsaw puzzle
    Coin; Crown; Ring; Necklace; Bracelet; Medal; Trophy; Flag; Bell; Whistle; Robot; Drone; Tablet
    Printer; Calculator; Keyboard; Computer mouse; USB stick; Charger; Remote control; Satellite
    Parachute; Scooter; Lorry; Taxi; Safe; Magnifying glass; Thermometer; Stethoscope; Syringe
    Plaster; Sunglasses; Elephant; Giraffe; Lion; Tiger; Zebra; Hippo; Rhino; Crocodile; Monkey
    Gorilla; Cheetah; Leopard; Hyena; Camel; Kangaroo; Koala; Panda; Polar bear; Penguin; Dolphin
    Whale; Shark; Octopus; Crab; Tortoise; Snake; Lizard; Chameleon; Frog; Butterfly; Bee; Ant
    Spider; Mosquito; Ladybird; Snail; Worm; Hen; Rooster; Duck; Cow; Pig; Sheep; Goat; Horse; Donkey
    Rabbit; Mouse; Cat; Dog; Parrot; Owl; Eagle; Pigeon; Flamingo; Ostrich; Peacock; Bat; Squirrel
    Wolf; Fox; Deer; Dinosaur; Dragon; Unicorn; Lynx; Toucan; Hummingbird; Swan; Seagull; Seal
    Otter; Beaver; Wild boar; Bison; Moose; Llama; Sloth; Platypus; Meerkat; Wildebeest; Buffalo
    Orangutan; Chimpanzee; Lemur; Scorpion; Grasshopper; Dragonfly; Wasp; Seahorse; Starfish
    Hedgehog; Mole; Hamster; Clownfish; Piranha; Salmon; Bread; Cheese; Butter; Egg; Milk; Yoghurt
    Rice; Spaghetti; Pizza; Hamburger; Chips; Soup; Salad; Cake; Biscuit; Chocolate; Ice cream
    Sweets; Popcorn; Honey; Jam; Sandwich; Hot dog; Jelly; Pancake; Croissant; Custard tart
    Bean stew; Salt cod; Sushi; Tacos; Kebab; Paella; Lasagne; Croquette; Rice pudding; Pudding
    Crêpe; Waffle; Doughnut; Banana; Apple; Orange; Strawberry; Pineapple; Watermelon; Grapes; Lemon
    Avocado; Kiwi; Pear; Peach; Cherry; Raspberry; Tomato; Carrot; Onion; Garlic; Potato; Sweetcorn
    Beans; Cabbage; Cucumber; Mushroom; Salt; Sugar; Coffee; Tea; Juice; Sun; Rain; Snow
    Thunderstorm; Lightning; Wind; Cloud; Star; Comet; Tree; Flower; Rose; Sunflower; Cactus
    Palm tree; Leaf; Stone; Sand; Seashell; Fire; Ice; Wave; Hurricane; Eclipse; Snowman; Sandcastle
  `),
  entertainment: list(`
    Football; Basketball; Volleyball; Handball; Tennis; Swimming; Athletics; Cycling; Boxing; Judo
    Karate; Chess; Draughts; Golf; Surfing; Skiing; Ice skating; Gymnastics; Rugby; Cricket; Baseball
    Hockey; Formula 1; Marathon; Olympic Games; World Cup; Yoga; Ballet; High jump; Sack race
    Hide and seek; Tag; Skipping rope; Marbles; Card game; Dominoes; Bingo; Karaoke; Table football
    Bowling; Table tennis; Fishing; Rock music; Jazz; Hip-hop; Reggae; Samba; Fado; Kizomba; Kuduro
    Opera; Classical music; Rap; Blues; Pop music; Salsa; Tango; Waltz; Orchestra; Band; Choir; Concert
    Music festival; DJ; Microphone; Headphones; Guitar; Piano; Violin; Drum kit; Trumpet; Saxophone
    Flute; Harp; Accordion; Bongo drum; Xylophone; Maracas; Cello; Ukulele; Horror film; Cartoons
    Soap opera; Documentary; Quiz show; The news; Comic book; Superhero; Film director; Actor; Oscar
    Red carpet; Film camera; Clapperboard; Subtitles; Trailer; TV series; Episode; Comedy; Magician
    Clown; Juggler; Acrobat; Puppet; Musical; Video game; Games console; Controller; Virtual reality
    Podcast; Selfie; Photography; Painting; Sculpture; Drawing; Origami; Knitting; Gardening; Cooking
    Camping; Picnic; Fireworks; Carnival; Christmas; Easter; New Year; Birthday; Wedding; Parade
    Roller coaster; Merry-go-round; Ferris wheel; Bumper cars; Slide; Swing; Trampoline; Treasure hunt
    Sudoku; Crossword; Riddle; Joke; Magic trick; Titanic; Toy Story; Frozen; Jurassic Park; Star Wars
    The Wizard of Oz; Avatar; The Simpsons; Finding Nemo; The Lion King; Mamma Mia; The Incredibles
    Ratatouille; Inside Out; Champions League; Contemporary dance; Breakdance; Flash mob; Talent show
    Blind man's buff; Noughts and crosses; Rock, paper, scissors; Mime; Charades; Stand-up comedy
    Puppet show; Extreme sports; Skydiving; Climbing; Canoeing; Sailing; Scuba diving; Skateboarding
    Roller skates; Hula hoop; Snakes and ladders; Board game; Musical statues; Musical chairs
    Minecraft; Fortnite; Tetris; Pac-Man; Roblox; Mario Kart; Among Us; Candy Crush; Social media
    Influencer; YouTuber; Emoji; Meme; Streaming; Afrobeats; Amapiano; Semba; Morna; Funaná
    Bossa nova; Flamenco; K-pop; Heavy metal; Gospel; Zouk; Reggaeton; Eurovision; Super Bowl; Grammy
    The Lord of the Rings; Pirates of the Caribbean; Avengers; Monsters, Inc.; Up; Encanto; Zootopia
    Despicable Me; Mary Poppins film
  `),
  football: list(`
    Benfica; FC Porto; Sporting CP; Sporting Braga; Vitória Guimarães; Real Madrid; FC Barcelona
    Atlético Madrid; Sevilla FC; Manchester United; Manchester City; Liverpool FC; Chelsea; Arsenal
    Tottenham; Newcastle; Juventus; AC Milan; Inter Milan; AS Roma; SSC Napoli; Bayern Munich
    Borussia Dortmund; Paris Saint-Germain; Olympique Marseille; Ajax; PSV Eindhoven; Celtic
    Galatasaray; Flamengo; Corinthians; Palmeiras; Santos FC; São Paulo FC; Boca Juniors; River Plate
    Al-Nassr; Inter Miami; Al Ahly; Kaizer Chiefs; Orlando Pirates; Mamelodi Sundowns; TP Mazembe
    Petro de Luanda; Primeiro de Agosto; Camp Nou; Santiago Bernabéu; Old Trafford; Anfield; Wembley
    Maracanã; Estádio da Luz; Estádio do Dragão; José Alvalade Stadium; San Siro; Allianz Arena
    La Bombonera; Ballon d'Or; Penalty; Offside; Red card; Yellow card; Goalkeeper; Bicycle kick
    Hat-trick; Referee; Header
  `).concat(FOOTBALL_PLAYERS),
  anime: list(`
    Sakura Haruno; Master Roshi; Kame House; Attack on Titan; Spirited Away; My Neighbor Totoro
    Princess Mononoke; Howl's Moving Castle; Saint Seiya; Death Note notebook; Poké Ball
    Doraemon's pocket; Anywhere Door; Dragon Balls; Colossal Titan; Samurai sword
  `).concat(ANIME_SHARED.map((w) => ({
    'Nuvem Voadora': 'Flying Nimbus',
    'Bola de Cristal': 'Crystal Ball',
    'Detetive Conan': 'Detective Conan',
    'Super Saiyajin': 'Super Saiyan',
  })[w] ?? w)),
  mozambique: list(`
    Maputo; Matola; Beira; Nampula; Quelimane; Tete; Pemba; Inhambane; Xai-Xai; Lichinga; Chimoio
    Nacala; Vilankulo; Mozambique Island; Ibo Island; Inhaca Island; Maputo Bay; Catembe; Ponta do Ouro
    Tofo Beach; Bilene; Bazaruto Archipelago; Gorongosa; Limpopo National Park; Niassa Reserve
    Mount Binga; Mount Namuli; Zambezi River; Limpopo River; Save River; Rovuma River; Lake Niassa
    Cahora Bassa Dam; Maputo-Katembe Bridge; Maputo Central Station; Maputo Fortress; Central Market
    Fish Market; Costa do Sol; Maputo seafront; Mafalala; Tunduru Gardens; Iron House; Maputo Cathedral
    Independence Square; Natural History Museum; Xipamanine Market; Polana; Cabo Delgado; Zambezia
    Sofala; Manica; Gaza; Matapa; Xima; Mucapata; Peanut curry; Crab curry; Zambezian chicken
    Peri-peri; Bhajias; Samosas; Prawn rissoles; Grilled prawns; Grilled squid; Cashew nuts; Cassava
    Coconut; Mango; Papaya; Monkey orange; Matata; Tihove; Cowpeas; Roasted peanuts; Dried fish
    Lobster; Cassava cake; Inhambane bread; Marrabenta; Pandza; Timbila; Mapiko; Tufo; Xigubo
    Makwaela; Ngalanga; Xitende; Capulana; Chapa minibus; Txopela; Metical; Mussiro face mask
    Straw mat; Pestle and mortar; Clay pot; Woven basket; Makonde carving; Batuque drums; Dhow
    Baobab tree; Cashew tree; Coconut palm; Mangrove; Coral reef; Dugong; Whale shark; Manta ray
    Sea turtle; Moçambola league; The Mambas; Zimpeto Stadium; Machava Stadium; Independence Day
    Mozambican flag; National anthem; Rádio Moçambique; Beira Corridor; Railway; Machamba field
    Thatched hut; Santa Carolina Island; Benguerra Island; Barra Beach; Macaneta; Namaacha; Montepuez
    Angoche; São Sebastião Fortress; Lourenço Marques; Maputo Special Reserve; Ferroviário de Maputo
    Black Bulls; UD Songo; Liga Desportiva de Maputo
  `),
};

// ---------------------------------------------------------------------------

function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(items, rng) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function checkPools(pools, lang) {
  const owner = new Map();
  for (const [pack, words] of Object.entries(pools)) {
    for (const w of words) {
      const key = w.toLocaleLowerCase(lang);
      if (owner.has(key)) throw new Error(`[${lang}] "${w}" appears in both ${owner.get(key)} and ${pack}`);
      owner.set(key, pack);
    }
  }
}

function generate(lang, pools, seed) {
  checkPools(pools, lang);
  const rng = mulberry32(seed);
  const packs = Object.keys(pools);
  const sides = CARDS_PER_LANGUAGE * 2;
  const total = packs.reduce((n, p) => n + pools[p].length, 0);

  // How many sides each pack gets, in proportion to the size of its list.
  const quotas = packs.map((p) => Math.floor((sides * pools[p].length) / total));
  let missing = sides - quotas.reduce((a, b) => a + b, 0);
  for (let i = 0; missing > 0; i = (i + 1) % packs.length, missing--) quotas[i]++;
  const labels = shuffle(packs.flatMap((p, i) => Array(quotas[i]).fill(p)), rng);

  // Pair the sides into cards with two different packs.
  const pairs = [];
  for (let i = 0; i < CARDS_PER_LANGUAGE; i++) pairs.push([labels[2 * i], labels[2 * i + 1]]);
  for (let i = 0; i < pairs.length; i++) {
    if (pairs[i][0] !== pairs[i][1]) continue;
    const j = pairs.findIndex((q, k) => k !== i && q[0] !== pairs[i][1] && q[1] !== pairs[i][1] && q[0] !== pairs[i][0]);
    if (j < 0) throw new Error('Could not pair the packs');
    [pairs[i][1], pairs[j][0]] = [pairs[j][0], pairs[i][1]];
  }

  // Words: walk through each shuffled list; reshuffle when it runs out.
  const cursors = Object.fromEntries(packs.map((p) => [p, { order: shuffle(pools[p], rng), i: 0 }]));
  const take = (pack) => {
    const c = cursors[pack];
    const words = [];
    while (words.length < WORDS_PER_SIDE) {
      if (c.i >= c.order.length) {
        c.order = shuffle(pools[pack], rng);
        c.i = 0;
      }
      const w = c.order[c.i++];
      if (!words.includes(w)) words.push(w);
    }
    return words;
  };

  return pairs.map(([yellow, blue], i) => ({
    id: `${lang}-${String(i + 1).padStart(4, '0')}`,
    yellow: { pack: yellow, words: take(yellow) },
    blue: { pack: blue, words: take(blue) },
  }));
}

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'src', 'data');
for (const [lang, pools, seed] of [
  ['pt', PT, 20261020],
  ['en', EN, 20261021],
]) {
  const cards = generate(lang, pools, seed);
  writeFileSync(join(out, `cards.${lang}.json`), JSON.stringify(cards, null, 1) + '\n');
  const sizes = Object.entries(pools).map(([p, w]) => `${p} ${w.length}`).join(', ');
  const words = Object.values(pools).reduce((n, w) => n + w.length, 0);
  console.log(`cards.${lang}.json: ${cards.length} cards, ${words} words (${sizes})`);
}
