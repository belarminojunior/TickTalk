import { createContext, useContext, type ReactNode } from 'react';
import type { Transport } from './net/transport';
import { randomSeed } from './game/random';

/** Outside-world dependencies, so tests can fake them. */
export interface AppConfig {
  /** Host clock (ms). */
  now: () => number;
  /** Deck seed. */
  seed: () => number;
  /** Animation duration multiplier (0 = instant). */
  animationScale: number;
  /** The table's connection to the phones. Defaults to the local WebSocket server; tests pass an in-memory one. */
  createHostTransport?: () => Transport;
}

export const defaultConfig: AppConfig = {
  now: () => performance.now(),
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
