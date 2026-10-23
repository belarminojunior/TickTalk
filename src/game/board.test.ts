import { BOARD_PATH, BOARD_COLS, BOARD_ROWS, iconFor, sideFor, squareColor } from './board';

describe('squareColor', () => {
  it('1 is blue, 2 is yellow, and they alternate', () => {
    expect(squareColor(1)).toBe('blue');
    expect(squareColor(2)).toBe('yellow');
    for (let n = 1; n <= 36; n++) expect(squareColor(n)).toBe(n % 2 ? 'blue' : 'yellow');
  });
  it('the start (0) counts as blue', () => {
    expect(squareColor(0)).toBe('blue');
    expect(sideFor({ position: 0 })).toBe('blue');
  });
});

describe('BOARD_PATH', () => {
  it('has 36 unique coordinates inside the grid', () => {
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
  it('each square is adjacent to the previous one', () => {
    for (let i = 1; i < BOARD_PATH.length; i++) {
      const a = BOARD_PATH[i - 1];
      const b = BOARD_PATH[i];
      expect(Math.abs(a.row - b.row) + Math.abs(a.col - b.col)).toBe(1);
    }
  });
  it('icons cycle', () => {
    expect(iconFor(1)).toBe('star');
    expect(iconFor(7)).toBe('star');
    expect(iconFor(6)).toBe('book');
  });
});
