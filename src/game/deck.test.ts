import { cardNumber, createDeck, drawCard } from './deck';
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

  it('is deterministic for the same seed', () => {
    expect(createDeck(cards, 7).order).toEqual(createDeck(cards, 7).order);
    expect(createDeck(cards, 7).order).not.toEqual(createDeck(cards, 8).order);
  });

  it('reads the card number from the id', () => {
    expect(cardNumber({ id: 'pt-0128' })).toBe(128);
  });
});
