import { CARDS } from './cards';
import { PACK_IDS } from '../game/types';
import { filterCards } from '../game/deck';

describe.each(['pt', 'en'] as const)('cards (%s)', (lang) => {
  const cards = CARDS[lang];

  it('has at least 150 cards', () => {
    expect(cards.length).toBeGreaterThanOrEqual(150);
  });

  it('ids are unique', () => {
    expect(new Set(cards.map((c) => c.id)).size).toBe(cards.length);
    for (const c of cards) expect(c.id.startsWith(`${lang}-`)).toBe(true);
  });

  it('each side has 5 unique, non-empty words from a known pack', () => {
    for (const c of cards) {
      for (const side of [c.yellow, c.blue]) {
        expect(PACK_IDS).toContain(side.pack);
        expect(side.words).toHaveLength(5);
        for (const w of side.words) expect(w.trim().length).toBeGreaterThan(0);
        expect(new Set(side.words.map((w) => w.toLowerCase())).size).toBe(5);
      }
    }
  });

  it('the two sides share no words', () => {
    for (const c of cards) {
      const yellow = new Set(c.yellow.words.map((w) => w.toLowerCase()));
      for (const w of c.blue.words) expect(yellow.has(w.toLowerCase())).toBe(false);
    }
  });

  it('every pack has cards and the Mozambique pack works with the others', () => {
    for (const pack of PACK_IDS) {
      expect(cards.some((c) => c.yellow.pack === pack || c.blue.pack === pack)).toBe(true);
    }
    expect(filterCards(cards, ['mozambique', 'places', 'things']).length).toBeGreaterThan(0);
  });
});
