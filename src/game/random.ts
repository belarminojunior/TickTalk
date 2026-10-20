export type Rng = () => number;

/** PRNG determinístico (mulberry32). Devolve o gerador e o próximo seed. */
export function nextRandom(seed: number): { value: number; seed: number } {
  let t = (seed + 0x6d2b79f5) >>> 0;
  const nextSeed = t;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, seed: nextSeed };
}

export function seededRng(seed: number): Rng {
  let s = seed >>> 0;
  return () => {
    const r = nextRandom(s);
    s = r.seed;
    return r.value;
  };
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}
