/** Deterministic PRNG (mulberry32). Returns the value and the next seed. */
export function nextRandom(seed: number): { value: number; seed: number } {
  let t = (seed + 0x6d2b79f5) >>> 0;
  const nextSeed = t;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, seed: nextSeed };
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}
