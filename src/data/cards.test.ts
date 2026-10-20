import { CARDS } from './cards';
import { PACK_IDS } from '../game/types';
import { filterCards } from '../game/deck';

describe.each(['pt', 'en'] as const)('cartas (%s)', (lang) => {
  const cards = CARDS[lang];

  it('tem pelo menos 150 cartas', () => {
    expect(cards.length).toBeGreaterThanOrEqual(150);
  });

  it('os ids são únicos', () => {
    expect(new Set(cards.map((c) => c.id)).size).toBe(cards.length);
    for (const c of cards) expect(c.id.startsWith(`${lang}-`)).toBe(true);
  });

  it('cada lado tem 5 palavras únicas e não vazias, de um pacote conhecido', () => {
    for (const c of cards) {
      for (const side of [c.yellow, c.blue]) {
        expect(PACK_IDS).toContain(side.pack);
        expect(side.words).toHaveLength(5);
        for (const w of side.words) expect(w.trim().length).toBeGreaterThan(0);
        expect(new Set(side.words.map((w) => w.toLowerCase())).size).toBe(5);
      }
    }
  });

  it('os dois lados não partilham palavras', () => {
    for (const c of cards) {
      const yellow = new Set(c.yellow.words.map((w) => w.toLowerCase()));
      for (const w of c.blue.words) expect(yellow.has(w.toLowerCase())).toBe(false);
    }
  });

  it('todos os pacotes têm cartas e o pacote Moçambique funciona com os outros', () => {
    for (const pack of PACK_IDS) {
      expect(cards.some((c) => c.yellow.pack === pack || c.blue.pack === pack)).toBe(true);
    }
    expect(filterCards(cards, ['mocambique', 'lugares', 'coisas']).length).toBeGreaterThan(0);
  });
});
