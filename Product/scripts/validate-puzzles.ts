import { Chess } from 'chess.js';
import { seedPuzzles } from '../src/data/cluePuzzles.ts';

let hasError = false;

for (const puzzle of seedPuzzles) {
  try {
    const chess = new Chess(puzzle.fen);
    
    // Check if the solution moves are valid
    const chessClone = new Chess(puzzle.fen);
    let validMoves = true;
    for (const move of puzzle.solution_moves) {
      try {
        chessClone.move(move);
      } catch (e) {
        console.error(`Invalid move ${move} for puzzle ${puzzle.id}`);
        validMoves = false;
        hasError = true;
      }
    }
    
    if (!validMoves) {
       console.error(`Puzzle ${puzzle.id} has invalid solution sequence!`);
    }
    
  } catch (e: any) {
    console.error(`Invalid FEN for puzzle ${puzzle.id}: ${puzzle.fen}. Error: ${e.message}`);
    hasError = true;
  }
}

if (!hasError) {
  console.log('All puzzles validated successfully!');
} else {
  process.exit(1);
}
