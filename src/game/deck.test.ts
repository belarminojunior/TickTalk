import { cardNumber, createDeck, drawCard, filterCards } from './deck';
import { DIE_FACES, advanceFor, rollDie } from './dice';
import { makeCard } from '../test/fixtures';

describe('deck', () => {
  const cards = Array.from({ length: 10 }, (_, i) => makeCard(i + 1));

  it('does not repeat cards until the deck runs out, then reshuffles', () => {
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

  it('only accepts cards whose two packs are selected', () => {
    const mixed = [makeCard(1, 'things', 'places'), makeCard(2, 'people', 'places'), makeCard(3, 'mozambique', 'things')];
    expect(filterCards(mixed, ['things', 'places']).map((c) => c.id)).toEqual(['t-0001']);
    expect(filterCards(mixed, ['things', 'places', 'mozambique'])).toHaveLength(2);
  });

  it('is deterministic for the same seed', () => {
    expect(createDeck(cards, 7).order).toEqual(createDeck(cards, 7).order);
    expect(createDeck(cards, 7).order).not.toEqual(createDeck(cards, 8).order);
  });

  it('reads the card number from the id', () => {
    expect(cardNumber({ id: 'pt-0128' })).toBe(128);
  });
});

describe('die', () => {
  it('has 6 faces: 0, 0, 1, 1, 2, 2', () => {
    expect([...DIE_FACES]).toEqual([0, 0, 1, 1, 2, 2]);
  });
  it('only rolls 0, 1 or 2', () => {
    for (let i = 0; i < 600; i++) expect([0, 1, 2]).toContain(rollDie());
    expect(rollDie(() => 0)).toBe(0);
    expect(rollDie(() => 0.34)).toBe(1);
    expect(rollDie(() => 0.999999)).toBe(2);
  });
  it('advance: with die max(0, valid − die); without, valid', () => {
    expect(advanceFor(2, 1)).toBe(1);
    expect(advanceFor(1, 2)).toBe(0);
    expect(advanceFor(0, 2)).toBe(0);
    expect(advanceFor(3, null)).toBe(3);
  });
});
