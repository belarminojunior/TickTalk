import { BOARD_PATH, BOARD_COLS, BOARD_ROWS, iconFor, sideFor, squareColor } from './board';

describe('squareColor', () => {
  it('1 é azul, 2 é amarela, e alterna', () => {
    expect(squareColor(1)).toBe('blue');
    expect(squareColor(2)).toBe('yellow');
    for (let n = 1; n <= 36; n++) expect(squareColor(n)).toBe(n % 2 ? 'blue' : 'yellow');
  });
  it('a Partida (0) conta como azul', () => {
    expect(squareColor(0)).toBe('blue');
    expect(sideFor({ position: 0 })).toBe('blue');
  });
});

describe('BOARD_PATH', () => {
  it('tem 36 coordenadas únicas dentro da grelha', () => {
    expect(BOARD_PATH).toHaveLength(36);
    const keys = new Set(BOARD_PATH.map((c) => `${c.row},${c.col}`));
    expect(keys.size).toBe(36);
    for (const c of BOARD_PATH) {
      expect(c.row).toBeGreaterThanOrEqual(1);
      expect(c.row).toBeLessThanOrEqual(BOARD_ROWS);
      expect(c.col).toBeGreaterThanOrEqual(1);
      expect(c.col).toBeLessThanOrEqual(BOARD_COLS);
    }
  });
  it('cada casa é adjacente à anterior', () => {
    for (let i = 1; i < BOARD_PATH.length; i++) {
      const a = BOARD_PATH[i - 1];
      const b = BOARD_PATH[i];
      expect(Math.abs(a.row - b.row) + Math.abs(a.col - b.col)).toBe(1);
    }
  });
  it('os ícones andam em ciclo', () => {
    expect(iconFor(1)).toBe('star');
    expect(iconFor(7)).toBe('star');
    expect(iconFor(6)).toBe('book');
  });
});
