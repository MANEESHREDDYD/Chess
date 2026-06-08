import { Chess } from 'chess.js';

function checkPuzzle(id: string, fen: string, line: string[]) {
  const chess = new Chess(fen);
  console.log(`Checking ${id}:`);
  for (let move of line) {
    try {
      const result = chess.move(move);
      console.log(`  Move ${move} (${result.san}) OK`);
    } catch (e) {
      console.log(`  Move ${move} INVALID`);
      return false;
    }
  }
  return true;
}

// Smothered mate with N on e5
checkPuzzle('seed-multi-disrupt-1', 'r1b2r1k/1pp3pp/p7/4Np2/2Q5/8/PP3PPP/R5K1 w - - 0 1', ['e5f7', 'h8g8', 'f7h6', 'g8h8', 'c4g8', 'f8g8', 'h6f7']);
