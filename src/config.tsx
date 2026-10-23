import { createContext, useContext, type ReactNode } from 'react';
import type { Rng } from './game/random';
import { randomSeed } from './game/random';

/** Outside-world dependencies, so tests can fake them. */
export interface AppConfig {
  /** Host clock (ms). */
  now: () => number;
  /** Random generator used only for the die. */
  rng: Rng;
  /** Deck seed. */
  seed: () => number;
  /** Animation duration multiplier (0 = instant). */
  animationScale: number;
}

export const defaultConfig: AppConfig = {
  now: () => performance.now(),
  rng: Math.random,
  seed: randomSeed,
  animationScale: 1,
};

const ConfigContext = createContext<AppConfig>(defaultConfig);

export function ConfigProvider({ config, children }: { config?: Partial<AppConfig>; children: ReactNode }) {
  return <ConfigContext.Provider value={{ ...defaultConfig, ...config }}>{children}</ConfigContext.Provider>;
}

export function useConfig(): AppConfig {
  return useContext(ConfigContext);
}
