/**
 * Pointer-to-square hit testing (M-REFERENCE-LOCKED-APPLE-MONO-UI-AND-BOARD-
 * HITTEST-FIX-1).
 *
 * Single source of truth for mapping a pointer event to a board square.
 * Rules:
 * - Always derive geometry from the LIVE board grid DOMRect
 *   (getBoundingClientRect), never from an assumed/stale boardWidth and never
 *   from a visual wrapper that carries padding/border around the grid.
 * - clientX/clientY are viewport coordinates, exactly what
 *   getBoundingClientRect returns — scroll offsets cancel out by construction.
 * - Orientation flips BOTH axes: with white at the bottom a1 is bottom-left;
 *   with black at the bottom a1 is top-right.
 */

export type BoardOrientation = 'white' | 'black';

export type BoardGeometryInput = {
  /** The 8x8 grid element's rect (inset element, not a padded wrapper). */
  boardRect: DOMRect | { left: number; top: number; width: number; height: number };
  clientX: number;
  clientY: number;
  orientation: BoardOrientation;
};

export type BoardSquareHit = {
  inside: boolean;
  /** 0..7 = files a..h (when inside). */
  file?: number;
  /** 0..7 = ranks 1..8 (when inside). */
  rank?: number;
  /** Algebraic square, e.g. "e4" (when inside). */
  square?: string;
};

export function getSquareFromPointer(input: BoardGeometryInput): BoardSquareHit {
  const { boardRect, clientX, clientY, orientation } = input;
  const { left, top, width, height } = boardRect;

  if (!(width > 0) || !(height > 0)) return { inside: false };

  const x = clientX - left;
  const y = clientY - top;
  if (x < 0 || y < 0 || x >= width || y >= height) return { inside: false };

  // Column/row in SCREEN space (0,0 = top-left cell of the rendered grid).
  const col = Math.min(7, Math.floor((x / width) * 8));
  const row = Math.min(7, Math.floor((y / height) * 8));

  // Screen -> chess coordinates.
  const file = orientation === 'white' ? col : 7 - col;
  const rank = orientation === 'white' ? 7 - row : row;

  return {
    inside: true,
    file,
    rank,
    square: `${String.fromCharCode(97 + file)}${rank + 1}`,
  };
}

/** Center of a square in viewport coordinates — the inverse mapping, used by
 *  tests and browser checks to aim synthetic pointer events. */
export function getSquareCenter(
  boardRect: BoardGeometryInput['boardRect'],
  square: string,
  orientation: BoardOrientation
): { clientX: number; clientY: number } {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]) - 1;
  const col = orientation === 'white' ? file : 7 - file;
  const row = orientation === 'white' ? 7 - rank : rank;
  const cellW = boardRect.width / 8;
  const cellH = boardRect.height / 8;
  return {
    clientX: boardRect.left + (col + 0.5) * cellW,
    clientY: boardRect.top + (row + 0.5) * cellH,
  };
}
