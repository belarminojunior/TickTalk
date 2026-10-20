import type { Card, PackId, Settings, TeamSetup } from '../game/types';
import { DEFAULT_SETTINGS } from '../game/reducer';

export function makeCard(n: number, yellowPack: PackId = 'coisas', bluePack: PackId = 'lugares'): Card {
  const id = `t-${String(n).padStart(4, '0')}`;
  return {
    id,
    yellow: { pack: yellowPack, words: [1, 2, 3, 4, 5].map((k) => `Amarela${n}-${k}`) },
    blue: { pack: bluePack, words: [1, 2, 3, 4, 5].map((k) => `Azul${n}-${k}`) },
  };
}

export const TEST_CARDS: Card[] = Array.from({ length: 6 }, (_, i) => makeCard(i + 1));

export const TWO_TEAMS: TeamSetup[] = [
  { name: 'Os Leões', color: 'red', players: ['Ana', 'Pedro', 'Lúcia'] },
  { name: 'As Gazelas', color: 'green', players: ['Tomás', 'Rita'] },
];

export function teamsOf(n: number): TeamSetup[] {
  const colors = ['red', 'green', 'purple', 'orange', 'white', 'pink'] as const;
  return Array.from({ length: n }, (_, i) => ({
    name: `Equipa ${i + 1}`,
    color: colors[i],
    players: [`J${i + 1}a`, `J${i + 1}b`],
  }));
}

export function settings(overrides: Partial<Settings> = {}): Settings {
  return { ...DEFAULT_SETTINGS, screenMode: 'single', ...overrides };
}
