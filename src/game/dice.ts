import type { Rng } from './random';

/** Faces do dado: 0, 0, 1, 1, 2, 2. */
export const DIE_FACES: readonly number[] = [0, 0, 1, 1, 2, 2];

export function rollDie(rng: Rng = Math.random): number {
  const i = Math.min(DIE_FACES.length - 1, Math.floor(rng() * DIE_FACES.length));
  return DIE_FACES[i];
}

/** Casas a avançar: com dado, max(0, válidas − dado); sem dado, válidas. */
export function advanceFor(valid: number, die: number | null): number {
  if (die === null) return valid;
  return Math.max(0, valid - die);
}
