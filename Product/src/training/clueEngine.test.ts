import { describe, expect, it } from 'vitest';
import { selectCluePuzzle, getNextClue, evaluateClueMove, getMotifPriorityFromStyleVector } from './clueEngine';
import { seedPuzzles } from '../data/cluePuzzles';
import type { StyleVector } from '../ml/styleVector';

const mockStyleVector: StyleVector = {
  opening_white_top3: [],
  opening_black_top3: [],
  avg_move_time_ms: 1000,
  time_pressure_blunder_rate: 0.8,
  exchange_willingness: 0.5,
  preferred_minor: 'knight',
  motif_blindness: {
    fork: 0.9,
    pin: 0.2,
    skewer: 0.1,
    removing_the_defender: 0.5,
  },
  endgame_strength: 0.5,
  swindle_preference: null,
  detected_elo: 1200,
  elo_band: 'initiate',
  schema_version: 1,
};

describe('clueEngine', () => {
  it('getMotifPriorityFromStyleVector orders by blindness', () => {
    const motifs = getMotifPriorityFromStyleVector(mockStyleVector);
    expect(motifs[0]).toBe('fork');
    expect(motifs[1]).toBe('removing_the_defender');
  });

  it('selectCluePuzzle prefers highest motif blindness', () => {
    const puzzle = selectCluePuzzle('p1', mockStyleVector, [], 0);
    expect(puzzle.motif).toBe('fork');
  });

  it('selectCluePuzzle works without StyleVector', () => {
    const puzzle = selectCluePuzzle('p1', undefined, [], 0);
    expect(puzzle).toBeDefined();
    expect(puzzle.id).toBe(seedPuzzles[0].id); // deterministic with seed 0
  });

  it('getNextClue increments clue level', () => {
    const puzzle = seedPuzzles[0];
    const { newHintLevel } = getNextClue(puzzle, 0, []);
    expect(newHintLevel).toBe(1);
  });

  it('getNextClue avoids exact duplicate clue text', () => {
    const puzzle = seedPuzzles[0];
    const { clue, newHintLevel } = getNextClue(puzzle, 0, [puzzle.clue_levels[0]]);
    // Should skip level 0 because it's in previousClues
    expect(clue.trim()).toBe(puzzle.clue_levels[1]);
    expect(newHintLevel).toBe(2);
  });

  it('getNextClue adds time pressure appendix for high blunder rate', () => {
    const puzzle = seedPuzzles[0];
    const { clue } = getNextClue(puzzle, 0, [], mockStyleVector);
    expect(clue).toContain('Take your time');
  });

  it('evaluateClueMove accepts correct move', () => {
    // using seed-mate-1: 6k1/5ppp/8/8/8/8/8/1R4K1 w - - 0 1 -> b1b8
    const puzzle = seedPuzzles.find(p => p.id === 'seed-mate-1')!;
    const res = evaluateClueMove(puzzle, 'b1b8');
    expect(res.valid).toBe(true);
    expect(res.correct).toBe(true);
  });

  it('evaluateClueMove rejects wrong move', () => {
    const puzzle = seedPuzzles.find(p => p.id === 'seed-mate-1')!;
    const res = evaluateClueMove(puzzle, 'g1h1');
    expect(res.valid).toBe(true);
    expect(res.correct).toBe(false);
  });

  it('evaluateClueMove rejects illegal move', () => {
    const puzzle = seedPuzzles.find(p => p.id === 'seed-mate-1')!;
    const res = evaluateClueMove(puzzle, 'a1a2'); // no piece on a1
    expect(res.valid).toBe(false);
  });
});
