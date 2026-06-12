/**
 * Kurukshetra Battlefield Mode — shared types and board-space math.
 *
 * The 3D layer owns NOTHING about chess rules. It renders a FEN, reports
 * square clicks, and animates transitions between FENs. chess.js (via the
 * game stores) remains the single source of truth.
 */

export type PieceColor = 'w' | 'b';
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export type SquareName = string; // e.g. "e4"

export type BattlefieldPieceInstance = {
  /** Stable identity across moves so meshes animate instead of remounting. */
  id: string;
  type: PieceType;
  color: PieceColor;
  /** Current square; null once the capture animation has finished. */
  square: SquareName;
  /** Square the piece is animating from (set for one frame batch after a move). */
  fromSquare: SquareName | null;
  /** Timestamp (ms) when the piece was captured; drives the dissolve effect. */
  capturedAt: number | null;
  /** Timestamp (ms) when this unit started a capture attack lunge. */
  attackStartedAt: number | null;
  /** Origin square of the capturing unit, used to make captured units fall away. */
  capturedFromSquare: SquareName | null;
};

export type BattlefieldHighlights = {
  selected: SquareName | null;
  legalMoves: SquareName[];
  /** Legal moves that capture (rendered with a stronger ring). */
  captureMoves: SquareName[];
  lastMove: SquareName[];
  checkSquare: SquareName | null;
};

export const SQUARE_SIZE = 1;
export const BOARD_SPAN = SQUARE_SIZE * 8;

/** Board-space position of a square centre. a1 = (-3.5, +3.5) with white at +z. */
export function squareToPosition(square: SquareName): [number, number, number] {
  const file = square.charCodeAt(0) - 97; // a..h -> 0..7
  const rank = Number(square[1]) - 1; // 1..8 -> 0..7
  return [(file - 3.5) * SQUARE_SIZE, 0, (3.5 - rank) * SQUARE_SIZE];
}

export function positionToSquare(x: number, z: number): SquareName | null {
  const file = Math.round(x / SQUARE_SIZE + 3.5);
  const rank = Math.round(3.5 - z / SQUARE_SIZE);
  if (file < 0 || file > 7 || rank < 0 || rank > 7) return null;
  return `${String.fromCharCode(97 + file)}${rank + 1}`;
}

export type ParsedBoardSquare = { square: SquareName; type: PieceType; color: PieceColor };

/** Parse the placement field of a FEN into occupied squares. No validation —
 *  the FEN always comes from chess.js. */
export function parseFenPlacement(fen: string): ParsedBoardSquare[] {
  const placement = fen.split(' ')[0] ?? '';
  const out: ParsedBoardSquare[] = [];
  let rank = 8;
  for (const row of placement.split('/')) {
    let file = 0;
    for (const ch of row) {
      if (ch >= '1' && ch <= '8') {
        file += Number(ch);
      } else {
        const color: PieceColor = ch === ch.toUpperCase() ? 'w' : 'b';
        out.push({
          square: `${String.fromCharCode(97 + file)}${rank}`,
          type: ch.toLowerCase() as PieceType,
          color,
        });
        file += 1;
      }
    }
    rank -= 1;
  }
  return out;
}
