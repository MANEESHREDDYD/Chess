import { describe, expect, it } from 'vitest';
import { getSquareCenter, getSquareFromPointer, type BoardOrientation } from './boardGeometry';

const rect = (left: number, top: number, size: number) => ({ left, top, width: size, height: size });

function hitAtCenter(square: string, orientation: BoardOrientation, r = rect(100, 50, 480)) {
  const { clientX, clientY } = getSquareCenter(r, square, orientation);
  return getSquareFromPointer({ boardRect: r, clientX, clientY, orientation });
}

describe('getSquareFromPointer', () => {
  it('maps the four corners with white orientation', () => {
    const r = rect(0, 0, 800);
    // a1 = bottom-left, h1 = bottom-right, a8 = top-left, h8 = top-right.
    expect(getSquareFromPointer({ boardRect: r, clientX: 10, clientY: 790, orientation: 'white' }).square).toBe('a1');
    expect(getSquareFromPointer({ boardRect: r, clientX: 790, clientY: 790, orientation: 'white' }).square).toBe('h1');
    expect(getSquareFromPointer({ boardRect: r, clientX: 10, clientY: 10, orientation: 'white' }).square).toBe('a8');
    expect(getSquareFromPointer({ boardRect: r, clientX: 790, clientY: 10, orientation: 'white' }).square).toBe('h8');
  });

  it('maps the four corners with black orientation (both axes flip)', () => {
    const r = rect(0, 0, 800);
    // With black at the bottom: a1 = top-right, h1 = top-left, a8 = bottom-right, h8 = bottom-left.
    expect(getSquareFromPointer({ boardRect: r, clientX: 790, clientY: 10, orientation: 'black' }).square).toBe('a1');
    expect(getSquareFromPointer({ boardRect: r, clientX: 10, clientY: 10, orientation: 'black' }).square).toBe('h1');
    expect(getSquareFromPointer({ boardRect: r, clientX: 790, clientY: 790, orientation: 'black' }).square).toBe('a8');
    expect(getSquareFromPointer({ boardRect: r, clientX: 10, clientY: 790, orientation: 'black' }).square).toBe('h8');
  });

  it('round-trips the center of every square in both orientations', () => {
    for (const orientation of ['white', 'black'] as const) {
      for (let f = 0; f < 8; f += 1) {
        for (let rk = 1; rk <= 8; rk += 1) {
          const square = `${String.fromCharCode(97 + f)}${rk}`;
          const hit = hitAtCenter(square, orientation);
          expect(hit.inside).toBe(true);
          expect(hit.square, `${square} @ ${orientation}`).toBe(square);
          expect(hit.file).toBe(f);
          expect(hit.rank).toBe(rk - 1);
        }
      }
    }
  });

  it('returns inside=false outside the board', () => {
    const r = rect(100, 100, 400);
    expect(getSquareFromPointer({ boardRect: r, clientX: 99, clientY: 300, orientation: 'white' }).inside).toBe(false);
    expect(getSquareFromPointer({ boardRect: r, clientX: 501, clientY: 300, orientation: 'white' }).inside).toBe(false);
    expect(getSquareFromPointer({ boardRect: r, clientX: 300, clientY: 99, orientation: 'white' }).inside).toBe(false);
    expect(getSquareFromPointer({ boardRect: r, clientX: 300, clientY: 501, orientation: 'white' }).inside).toBe(false);
    expect(getSquareFromPointer({ boardRect: r, clientX: 0, clientY: 0, orientation: 'white' }).inside).toBe(false);
  });

  it('maps correctly for scaled (non-default) board sizes', () => {
    // Same square centers must resolve for a small and a large rendered board.
    for (const size of [177, 313, 521, 999]) {
      const r = rect(7, 13, size);
      expect(hitAtCenter('e4', 'white', r).square).toBe('e4');
      expect(hitAtCenter('b7', 'black', r).square).toBe('b7');
    }
  });

  it('is immune to scroll offsets (client coordinates cancel by construction)', () => {
    // Simulate the same board before/after scrolling 800px: the rect's
    // viewport-relative top changes, and client coords change with it.
    const before = rect(120, 600, 480);
    const after = rect(120, -200, 480); // scrolled down 800px
    const target = getSquareCenter(after, 'd5', 'white');
    const hit = getSquareFromPointer({ boardRect: after, ...target, orientation: 'white' });
    expect(hit.square).toBe('d5');
    const hitBefore = getSquareFromPointer({
      boardRect: before,
      ...getSquareCenter(before, 'd5', 'white'),
      orientation: 'white',
    });
    expect(hitBefore.square).toBe('d5');
  });

  it('uses the inner grid rect, so a padded wrapper cannot skew mapping', () => {
    // The wrapper might be 520 wide with 20px padding; the GRID rect passed in
    // is the inset 480px box. Mapping must be exact against the grid rect.
    const grid = rect(20, 20, 480);
    const { clientX, clientY } = getSquareCenter(grid, 'h8', 'white');
    expect(getSquareFromPointer({ boardRect: grid, clientX, clientY, orientation: 'white' }).square).toBe('h8');
    // A pointer in the wrapper padding (outside the grid) is NOT a square.
    expect(getSquareFromPointer({ boardRect: grid, clientX: 10, clientY: 10, orientation: 'white' }).inside).toBe(false);
  });

  it('degenerate rect returns inside=false', () => {
    expect(getSquareFromPointer({ boardRect: rect(0, 0, 0), clientX: 0, clientY: 0, orientation: 'white' }).inside).toBe(false);
  });
});
