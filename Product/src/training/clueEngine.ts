import { seedPuzzles, type CluePuzzle } from '../data/cluePuzzles';
import type { StyleVector, Motif } from '../ml/styleVector';
import type { ClueAttemptRecord } from '../data/db';
import { Chess } from 'chess.js';

/**
 * Returns a list of motifs sorted by the player's blindness to them.
 */
export function getMotifPriorityFromStyleVector(styleVector?: StyleVector): Motif[] {
  if (!styleVector || !styleVector.motif_blindness) return [];
  
  const blindness = styleVector.motif_blindness;
  const motifs = Object.keys(blindness) as Motif[];
  
  // Sort descending by blindness score
  motifs.sort((a, b) => (blindness[b] || 0) - (blindness[a] || 0));
  
  return motifs;
}

/**
 * Selects the next clue puzzle.
 */
export function selectCluePuzzle(
  _playerId: string,
  styleVector?: StyleVector,
  previousAttempts?: ClueAttemptRecord[],
  seed?: number // For deterministic testing
): CluePuzzle {
  const solvedIds = new Set((previousAttempts || []).filter(a => a.solved).map(a => a.puzzle_id));
  
  // Available puzzles that haven't been solved
  let available = seedPuzzles.filter(p => !solvedIds.has(p.id));
  
  // If all are solved, reset and allow any puzzle (maybe pick the oldest one?)
  if (available.length === 0) {
    available = [...seedPuzzles];
  }

  // 1. If StyleVector is available, prefer the motif they are most blind to.
  const motifPriority = getMotifPriorityFromStyleVector(styleVector);
  
  for (const motif of motifPriority) {
    const candidates = available.filter(p => p.motif === motif);
    if (candidates.length > 0) {
      return pickRandom(candidates, seed);
    }
  }

  // 2. If no motif match or no StyleVector, prefer recent failed motifs if any
  const failedAttempts = (previousAttempts || []).filter(a => !a.solved);
  if (failedAttempts.length > 0) {
    const lastFailMotif = failedAttempts[0].motif;
    const candidates = available.filter(p => p.motif === lastFailMotif);
    if (candidates.length > 0) {
      return pickRandom(candidates, seed);
    }
  }

  // 3. Fallback: random available puzzle
  return pickRandom(available, seed);
}

function pickRandom<T>(items: T[], seed?: number): T {
  if (seed !== undefined) {
    return items[seed % items.length];
  }
  return items[Math.floor(Math.random() * items.length)];
}

/**
 * Returns the next clue string.
 */
export function getNextClue(
  puzzle: CluePuzzle,
  currentHintLevel: number,
  previousClues: string[],
  styleVector?: StyleVector
): { clue: string; newHintLevel: number } {
  let level = currentHintLevel;
  if (level >= puzzle.clue_levels.length) {
    level = puzzle.clue_levels.length - 1;
  }
  if (level < 0) level = 0;

  let baseClue = puzzle.clue_levels[level];
  
  // Avoid exact duplicates
  while (previousClues.includes(baseClue) && level < puzzle.clue_levels.length - 1) {
    level++;
    baseClue = puzzle.clue_levels[level];
  }

  // Personalized appendix
  let appendix = "";
  if (styleVector && styleVector.time_pressure_blunder_rate > 0.6) {
    // only append occasionally or to specific hints to avoid annoying the user
    if (level === 0 || level === 2) {
      appendix = " Take your time — your calibration showed accuracy may drop under pressure.";
    }
  }

  return {
    clue: baseClue + appendix,
    newHintLevel: level + 1
  };
}

/**
 * Normalizes a move and evaluates if it is the correct solution.
 * Handles SAN or UCI input.
 */
export function evaluateClueMove(puzzle: CluePuzzle, moveInput: string): { valid: boolean; correct: boolean; normalizedMove?: string } {
  const chess = new Chess(puzzle.fen);
  
  try {
    const m = chess.move(moveInput);
    if (!m) return { valid: false, correct: false };
    
    const isCorrect = puzzle.solution_moves.includes(m.lan) || puzzle.solution_moves.includes(m.san);
    return { valid: true, correct: isCorrect, normalizedMove: m.lan };
  } catch (e) {
    // invalid move
    return { valid: false, correct: false };
  }
}

/**
 * Produces a summary of a clue attempt for analytics or UI.
 */
export function summarizeClueResult(attempt: ClueAttemptRecord): string {
  if (attempt.solved) {
    return `Solved puzzle ${attempt.puzzle_id} in ${attempt.hints_used} hints.`;
  }
  return `Failed puzzle ${attempt.puzzle_id} after ${attempt.attempted_moves.length} incorrect attempts.`;
}
