import { seedPuzzles } from './src/data/cluePuzzles.js';
import { Chess } from 'chess.js';

let errors = 0;
for (const puzzle of seedPuzzles) {
  const chess = new Chess();
  try {
    chess.load(puzzle.fen);
    
    let moveFound = false;
    for (const sol of puzzle.solution_moves) {
      const c = new Chess(puzzle.fen);
      try {
        const m = c.move(sol);
        if (m) moveFound = true;
      } catch (e) {
        // move failed
      }
    }
    
    if (!moveFound) {
      console.error(`Puzzle ${puzzle.id} has no valid solution moves among: ${puzzle.solution_moves.join(', ')}`);
      errors++;
    }

    const uniqueClues = new Set(puzzle.clue_levels);
    if (uniqueClues.size !== puzzle.clue_levels.length) {
      console.error(`Puzzle ${puzzle.id} has duplicate clue levels.`);
      errors++;
    }

  } catch (err) {
    console.error(`Puzzle ${puzzle.id} threw error`, err.message);
    errors++;
  }
}

if (errors === 0) {
  console.log('All puzzles are valid!');
} else {
  console.error(`Found ${errors} errors.`);
  process.exit(1);
}
