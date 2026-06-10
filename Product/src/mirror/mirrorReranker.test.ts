import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import type { EngineCandidate } from '../engine/stockfishBridge';
import type { StyleVector } from '../ml/styleVector';
import { MIRROR_PERSONALITY_MODES, type MirrorPersonalityMode } from './mirrorPersonality';
import { rerankMirrorMoves } from './mirrorReranker';
import mirrorOpponentSource from '../engine/mirrorOpponent.ts?raw';
import mirrorExplanationSource from './mirrorExplanation.ts?raw';
import mirrorPersonalitySource from './mirrorPersonality.ts?raw';
import mirrorRerankerSource from './mirrorReranker.ts?raw';
import moveFeatureExtractorSource from './moveFeatureExtractor.ts?raw';

const exchangeFen = '4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1';
const queenFen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2';

const baseVector: StyleVector = {
  opening_white_top3: ['e4'],
  opening_black_top3: ['e5'],
  avg_move_time_ms: 8_000,
  time_pressure_blunder_rate: 0.35,
  exchange_willingness: 0.72,
  preferred_minor: 'knight',
  motif_blindness: {
    fork: 0.68,
    pin: 0.2,
    skewer: 0.32,
    removing_the_defender: 0.42,
  },
  endgame_strength: 0.55,
  swindle_preference: 'principled',
  detected_elo: 1500,
  elo_band: 'initiate',
  schema_version: 1,
};

describe('rerankMirrorMoves personality modes', () => {
  it.each(MIRROR_PERSONALITY_MODES)('%s returns only legal moves from the candidate list', (mode) => {
    const candidates = [candidate('e4e5', 30), candidate('e4d5', 12, 2), candidate('e1e2', -20, 3)];
    const result = rerankMirrorMoves({
      fen: exchangeFen,
      candidates,
      styleVector: baseVector,
      personalityMode: mode,
      seed: 'legal-mode-test',
    });

    const candidateMoves = new Set(candidates.map((entry) => entry.move));
    expect(result.selectedMove).toBeTruthy();
    expect(candidateMoves.has(result.selectedMove?.move ?? '')).toBe(true);
    for (const ranked of result.rankedCandidates) {
      expect(candidateMoves.has(ranked.move)).toBe(true);
      expect(isLegalUci(exchangeFen, ranked.move)).toBe(true);
    }
  });

  it('is deterministic for current_self with the same seed and input', () => {
    const input = {
      fen: exchangeFen,
      candidates: [candidate('e4e5', 30), candidate('e4d5', 12, 2)],
      styleVector: baseVector,
      personalityMode: 'current_self' as MirrorPersonalityMode,
      seed: 'same-position',
    };

    const first = rerankMirrorMoves(input);
    const second = rerankMirrorMoves(input);

    expect(first.selectedMove?.move).toBe(second.selectedMove?.move);
    expect(first.rankedCandidates.map((entry) => entry.move)).toEqual(
      second.rankedCandidates.map((entry) => entry.move)
    );
  });

  it('aggressive_self increases capture preference when the move is inside the safe CP window', () => {
    const result = rerankMirrorMoves({
      fen: exchangeFen,
      candidates: [candidate('e4e5', 24), candidate('e4d5', 8, 2)],
      styleVector: { ...baseVector, exchange_willingness: 0.88 },
      personalityMode: 'aggressive_self',
      seed: 'aggressive-capture',
    });

    expect(result.selectedMove?.move).toBe('e4d5');
    expect(result.selectedMove?.reason).toBe('exchange');
  });

  it('cautious_self reduces early-queen risk when a safer candidate is available', () => {
    const result = rerankMirrorMoves({
      fen: queenFen,
      candidates: [candidate('d1h5', 22), candidate('g1f3', 12, 2)],
      styleVector: baseVector,
      personalityMode: 'cautious_self',
      seed: 'cautious-queen',
    });

    expect(result.selectedMove?.move).toBe('g1f3');
    expect(result.selectedMove?.features.risk_proxy).toBeLessThan(
      result.rankedCandidates.find((entry) => entry.move === 'd1h5')?.features.risk_proxy ?? 1
    );
  });

  it('improved_self prefers lower CP loss than blunder_prone_self in the same position', () => {
    const candidates = [candidate('e4e5', 60), candidate('e4d5', 0, 2)];
    const improved = rerankMirrorMoves({
      fen: exchangeFen,
      candidates,
      styleVector: { ...baseVector, exchange_willingness: 0.9 },
      personalityMode: 'improved_self',
      seed: 'improved-vs-blunder',
    });
    const blunderProne = rerankMirrorMoves({
      fen: exchangeFen,
      candidates,
      styleVector: { ...baseVector, exchange_willingness: 0.9 },
      personalityMode: 'blunder_prone_self',
      seed: 'improved-vs-blunder',
    });

    expect(improved.selectedMove?.cpLossFromBest ?? Infinity).toBeLessThanOrEqual(
      blunderProne.selectedMove?.cpLossFromBest ?? 0
    );
  });

  it('blunder_prone_self stays inside controlled CP-loss bounds', () => {
    const result = rerankMirrorMoves({
      fen: exchangeFen,
      candidates: [candidate('e4e5', 120), candidate('e4d5', -80, 2)],
      styleVector: { ...baseVector, exchange_willingness: 0.95, time_pressure_blunder_rate: 0.8 },
      personalityMode: 'blunder_prone_self',
      seed: 'controlled-blunder',
    });

    expect(result.selectedMove?.cpLossFromBest ?? Infinity).toBeLessThanOrEqual(220);
  });

  it('handles a missing StyleVector with an insufficient-data explanation', () => {
    const result = rerankMirrorMoves({
      fen: exchangeFen,
      candidates: [candidate('e4e5', 20), candidate('e4d5', 0, 2)],
      styleVector: null,
      personalityMode: 'current_self',
    });

    expect(result.selectedMove?.move).toBeTruthy();
    expect(result.explanation.insufficient_data).toBe(true);
    expect(result.explanation.evidence.join(' ')).toMatch(/No StyleVector is available/i);
  });

  it('generates evidence or an insufficient-data note for explanations', () => {
    const result = rerankMirrorMoves({
      fen: exchangeFen,
      candidates: [candidate('e4e5', 20), candidate('e4d5', 0, 2)],
      styleVector: baseVector,
      personalityMode: 'current_self',
    });

    expect(result.explanation.summary.length).toBeGreaterThan(20);
    expect(result.explanation.evidence.length).toBeGreaterThan(0);
  });

  it('does not use Math.random in the Mirror move-selection modules', () => {
    const source = [
      mirrorOpponentSource,
      mirrorExplanationSource,
      mirrorPersonalitySource,
      mirrorRerankerSource,
      moveFeatureExtractorSource,
    ].join('\n');
    expect(source).not.toContain('Math.random');
  });
});

function candidate(move: string, cp: number, multipv = 1): EngineCandidate {
  return {
    move,
    cp,
    mate: null,
    multipv,
    pv: [move],
  };
}

function isLegalUci(fen: string, uci: string): boolean {
  const game = new Chess(fen);
  try {
    return Boolean(
      game.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci.length === 5 ? uci[4] : undefined,
      })
    );
  } catch {
    return false;
  }
}
