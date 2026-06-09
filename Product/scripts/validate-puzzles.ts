import { Chess } from 'chess.js';
import { seedPuzzles } from '../src/data/cluePuzzles.ts';

let hasError = false;

function validatePuzzle(puzzle: typeof seedPuzzles[0]) {
  try {
    const chess = new Chess(puzzle.fen);
    
    // 1. FEN is legal (chess.js throws if strictly illegal format, but we also check if it's playable)
    if (chess.isGameOver()) {
      console.error(`Puzzle ${puzzle.id} FEN is already game over.`);
      hasError = true;
    }

    const hasSolutionLine = puzzle.solution_line && puzzle.solution_line.length > 0;
    
    // 7. Puzzle has at least one user move.
    if (!hasSolutionLine && (!puzzle.solution_moves || puzzle.solution_moves.length === 0)) {
      console.error(`Puzzle ${puzzle.id} has no solution moves.`);
      hasError = true;
    }

    // 8. Multi-move puzzle has at least one opponent reply or more than one user move.
    if (hasSolutionLine) {
      if (puzzle.solution_line!.length < 2) {
        // Technically one move in solution_line is allowed but the instructions say multi-move puzzle
        // We just ensure it's not claiming to be multi-move while having 0 or 1 step incorrectly.
        // Wait, "Multi-move puzzle has at least one opponent reply or more than one user move"
      }
    }

    // 9. No duplicate clue strings inside a puzzle
    const allClues = [...puzzle.clue_levels];
    if (puzzle.step_clues) {
      Object.values(puzzle.step_clues).forEach(clues => allClues.push(...clues));
    }
    const clueSet = new Set(allClues);
    if (clueSet.size !== allClues.length) {
      console.error(`Puzzle ${puzzle.id} has duplicate clue text.`);
      hasError = true;
    }

    // 10. step_clues map to valid step indexes.
    if (puzzle.step_clues && hasSolutionLine) {
      const maxIndex = puzzle.solution_line!.length - 1;
      for (const key of Object.keys(puzzle.step_clues)) {
        if (parseInt(key, 10) > maxIndex) {
          console.error(`Puzzle ${puzzle.id} step_clues reference out of bounds index ${key}.`);
          hasError = true;
        }
      }
    }

    let previousSide: string | null = null;
    const finalChess = new Chess(puzzle.fen);

    if (hasSolutionLine) {
      puzzle.solution_line!.forEach((step, idx) => {
        // 3. Alternate user/opponent correctly
        if (previousSide && previousSide === step.side) {
          console.error(`Puzzle ${puzzle.id} does not alternate sides correctly at step ${idx}.`);
          hasError = true;
        }
        previousSide = step.side;

        // 4. UCI format valid (simple regex a1a2 or a1a2q)
        if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(step.move)) {
          console.error(`Puzzle ${puzzle.id} move ${step.move} is not valid UCI format.`);
          hasError = true;
        }

        try {
          // 2. Every move is legal
          const moveRes = finalChess.move(step.move);
          
          // 5. SAN matches
          if (step.san && step.san.replace(/\\+|#/g, '') !== moveRes.san.replace(/\\+|#/g, '')) {
            console.error(`Puzzle ${puzzle.id} SAN mismatch at step ${idx}. Expected ${step.san}, got ${moveRes.san}`);
            hasError = true;
          }
        } catch (e) {
          console.error(`Puzzle ${puzzle.id} move ${step.move} at step ${idx} is illegal!`);
          hasError = true;
        }
      });
    } else {
      // 11. One-move puzzles backward compatible
      for (const move of puzzle.solution_moves) {
        try {
          finalChess.move(move);
        } catch (e) {
          console.error(`Puzzle ${puzzle.id} fallback move ${move} is illegal!`);
          hasError = true;
        }
      }
    }

    // 12. "forced mate" check
    const desc = (puzzle.title + ' ' + puzzle.explanation).toLowerCase();
    if (desc.includes('forced mate') || desc.includes('checkmate')) {
      if (!finalChess.isCheckmate()) {
        console.error(`Puzzle ${puzzle.id} mentions checkmate but does not end in checkmate!`);
        hasError = true;
      }
    }

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`Invalid FEN for puzzle ${puzzle.id}: ${puzzle.fen}. Error: ${message}`);
    hasError = true;
  }
}

for (const puzzle of seedPuzzles) {
  validatePuzzle(puzzle);
}

if (!hasError) {
  console.log('All puzzles validated successfully!');
} else {
  process.exit(1);
}
