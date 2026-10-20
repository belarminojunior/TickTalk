import { createContext, useContext, type ReactNode } from 'react';
import type { Rng } from './game/random';
import { randomSeed } from './game/random';

/** Dependências do mundo exterior, para os testes as poderem simular. */
export interface AppConfig {
  /** Relógio do anfitrião (ms). */
  now: () => number;
  /** Gerador usado só para o dado. */
  rng: Rng;
  /** Seed do baralho. */
  seed: () => number;
  /** Multiplicador das durações das animações (0 = instantâneo). */
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
