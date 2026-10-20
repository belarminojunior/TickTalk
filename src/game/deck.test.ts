import { cardNumber, createDeck, drawCard, filterCards } from './deck';
import { DIE_FACES, advanceFor, rollDie } from './dice';
import { makeCard } from '../test/fixtures';

describe('baralho', () => {
  const cards = Array.from({ length: 10 }, (_, i) => makeCard(i + 1));

  it('não repete cartas até o baralho acabar, e depois volta a baralhar', () => {
    let deck = createDeck(cards, 42);
    const seen = new Set<string>();
    for (let i = 0; i < cards.length; i++) {
      const r = drawCard(deck);
      expect(seen.has(r.card.id)).toBe(false);
      seen.add(r.card.id);
      deck = r.deck;
    }
    expect(seen.size).toBe(cards.length);
    const second = new Set<string>();
    for (let i = 0; i < cards.length; i++) {
      const r = drawCard(deck);
      second.add(r.card.id);
      deck = r.deck;
    }
    expect(second.size).toBe(cards.length);
  });

  it('só aceita cartas com os dois pacotes selecionados', () => {
    const mixed = [makeCard(1, 'coisas', 'lugares'), makeCard(2, 'pessoas', 'lugares'), makeCard(3, 'mocambique', 'coisas')];
    expect(filterCards(mixed, ['coisas', 'lugares']).map((c) => c.id)).toEqual(['t-0001']);
    expect(filterCards(mixed, ['coisas', 'lugares', 'mocambique'])).toHaveLength(2);
  });

  it('é determinístico com o mesmo seed', () => {
    expect(createDeck(cards, 7).order).toEqual(createDeck(cards, 7).order);
    expect(createDeck(cards, 7).order).not.toEqual(createDeck(cards, 8).order);
  });

  it('lê o número da carta a partir do id', () => {
    expect(cardNumber({ id: 'pt-0128' })).toBe(128);
  });
});

describe('dado', () => {
  it('tem 6 faces: 0, 0, 1, 1, 2, 2', () => {
    expect([...DIE_FACES]).toEqual([0, 0, 1, 1, 2, 2]);
  });
  it('só dá 0, 1 ou 2', () => {
    for (let i = 0; i < 600; i++) expect([0, 1, 2]).toContain(rollDie());
    expect(rollDie(() => 0)).toBe(0);
    expect(rollDie(() => 0.34)).toBe(1);
    expect(rollDie(() => 0.999999)).toBe(2);
  });
  it('avanço: com dado max(0, válidas − dado); sem dado, válidas', () => {
    expect(advanceFor(2, 1)).toBe(1);
    expect(advanceFor(1, 2)).toBe(0);
    expect(advanceFor(0, 2)).toBe(0);
    expect(advanceFor(3, null)).toBe(3);
  });
});
