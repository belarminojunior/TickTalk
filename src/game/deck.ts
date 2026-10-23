import type { Card, Deck, PackId } from './types';
import { nextRandom } from './random';

/** A card goes into the deck only if the packs of both sides are selected. */
export function filterCards(cards: readonly Card[], packs: readonly PackId[]): Card[] {
  const selected = new Set(packs);
  return cards.filter((c) => selected.has(c.yellow.pack) && selected.has(c.blue.pack));
}

/** Seeded Fisher–Yates. Returns the shuffled order and the next seed. */
export function shuffledOrder(length: number, seed: number): { order: number[]; seed: number } {
  const order = Array.from({ length }, (_, i) => i);
  let s = seed;
  for (let i = order.length - 1; i > 0; i--) {
    const r = nextRandom(s);
    s = r.seed;
    const j = Math.floor(r.value * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return { order, seed: s };
}

export function createDeck(cards: readonly Card[], seed: number): Deck {
  const { order, seed: next } = shuffledOrder(cards.length, seed);
  return { cards: [...cards], order, next: 0, seed: next };
}

/** Draws the next card. When the deck runs out, it is reshuffled. */
export function drawCard(deck: Deck): { card: Card; deck: Deck } {
  if (deck.cards.length === 0) throw new Error('Empty deck');
  let current = deck;
  if (current.next >= current.order.length) {
    const { order, seed } = shuffledOrder(current.cards.length, current.seed);
    current = { ...current, order, seed, next: 0 };
  }
  const card = current.cards[current.order[current.next]];
  return { card, deck: { ...current, next: current.next + 1 } };
}

/** "pt-0128" → 128 */
export function cardNumber(card: Pick<Card, 'id'>): number {
  const match = /(\d+)$/.exec(card.id);
  return match ? Number(match[1]) : 0;
}
