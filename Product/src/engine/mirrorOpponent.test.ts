import { describe, expect, it } from 'vitest';
import type { EngineCandidate } from './stockfishBridge';
import {
  buildMirrorDecisionTrace,
  describeMirrorDecision,
  rankMirrorCandidates,
  summarizeMirrorReranks,
  type MirrorDecisionTrace,
} from './mirrorOpponent';
import type { StyleVector } from '../ml/styleVector';

const baseVector: StyleVector = {
  opening_white_top3: ['e4'],
  opening_black_top3: ['e5'],
  avg_move_time_ms: 8_000,
  time_pressure_blunder_rate: 0.25,
  exchange_willingness: 0.5,
  preferred_minor: 'neutral',
  motif_blindness: {
    fork: 0.2,
    pin: 0.2,
    skewer: 0.2,
    removing_the_defender: 0.2,
  },
  endgame_strength: 0.55,
  swindle_preference: 'principled',
  detected_elo: 1500,
  elo_band: 'initiate',
  schema_version: 1,
};

function candidate(move: string, cp: number, multipv = 1): EngineCandidate {
  return {
    move,
    cp,
    mate: null,
    multipv,
    pv: [move],
  };
}

describe('rankMirrorCandidates', () => {
  it('reranks a near-equal capture when the player accepts exchanges', () => {
    const fen = '4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1';
    const candidates = [candidate('e4e5', 16), candidate('e4d5', 0, 2)];

    const ranked = rankMirrorCandidates(fen, candidates, {
      ...baseVector,
      exchange_willingness: 0.9,
    });

    expect(ranked[0].move).toBe('e4d5');
    expect(ranked[0].reason).toBe('exchange');
    expect(ranked[0].styleDimension).toBe('exchange_willingness');
  });

  it('keeps engine order when the style vector has no strong signal', () => {
    const fen = '4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1';
    const ranked = rankMirrorCandidates(fen, [candidate('e4e5', 50), candidate('e4d5', 0, 2)], baseVector);

    expect(ranked[0].move).toBe('e4e5');
    expect(ranked[0].reason).toBe('engine');
  });

  it('builds an auditable trace when style reranking overrides Stockfish top', () => {
    const fen = '4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1';
    const ranked = rankMirrorCandidates(fen, [candidate('e4e5', 16), candidate('e4d5', 0, 2)], {
      ...baseVector,
      exchange_willingness: 0.9,
    });

    expect(buildMirrorDecisionTrace(ranked)).toMatchObject({
      move: 'e4d5',
      stockfishTopMove: 'e4e5',
      overrodeStockfish: true,
      styleDimension: 'exchange_willingness',
    });
  });
});

describe('describeMirrorDecision', () => {
  it('writes a deterministic explanation from the selected trace', () => {
    const trace: MirrorDecisionTrace = {
      move: 'e4d5',
      san: 'exd5',
      stockfishTopMove: 'e4e5',
      stockfishTopSan: 'e5',
      overrodeStockfish: true,
      styleDimension: 'exchange_willingness',
      styleBias: 36,
      stockfishTopEngineScore: 16,
      rerankedEngineScore: 0,
      rerankedTotalScore: 36,
      reason: 'exchange',
      tendency: 0.8,
      detail: 'capture or trade candidate',
    };

    expect(describeMirrorDecision(trace, 12)).toBe(
      "It overrode Stockfish's e5 with exd5 on move 12 because your exchange_willingness is 80%."
    );
  });

  it('summarizes override frequency by driving dimension', () => {
    const traces: MirrorDecisionTrace[] = [
      {
        move: 'e4d5',
        san: 'exd5',
        stockfishTopMove: 'e4e5',
        stockfishTopSan: 'e5',
        overrodeStockfish: true,
        styleDimension: 'exchange_willingness',
        styleBias: 36,
        stockfishTopEngineScore: 16,
        rerankedEngineScore: 0,
        rerankedTotalScore: 36,
        reason: 'exchange',
        tendency: 0.8,
        detail: 'capture or trade candidate',
      },
      {
        move: 'g8f6',
        san: 'Nf6',
        stockfishTopMove: 'g8f6',
        stockfishTopSan: 'Nf6',
        overrodeStockfish: false,
        styleDimension: 'engine',
        styleBias: 0,
        stockfishTopEngineScore: 22,
        rerankedEngineScore: 22,
        rerankedTotalScore: 22,
        reason: 'engine',
        tendency: 0.5,
        detail: 'engine preference',
      },
    ];

    expect(summarizeMirrorReranks(traces)).toEqual({
      totalMirrorMoves: 2,
      overrideCount: 1,
      overrideRate: 0.5,
      overridesByDimension: {
        exchange_willingness: 1,
      },
    });
  });

  it('does not claim exchange willingness caused a Stockfish-top capture with zero exchange bias', () => {
    const trace: MirrorDecisionTrace = {
      move: 'e4d5',
      san: 'exd5',
      stockfishTopMove: 'e4d5',
      stockfishTopSan: 'exd5',
      overrodeStockfish: false,
      styleDimension: 'engine',
      styleBias: 0,
      stockfishTopEngineScore: 24,
      rerankedEngineScore: 24,
      rerankedTotalScore: 24,
      reason: 'exchange',
      tendency: 0.5,
      detail: 'capture or trade candidate',
    };

    const explanation = describeMirrorDecision(trace, 4);

    expect(explanation).toBe(
      'It played exd5; the engine still ranked it highest after your style was applied.'
    );
    expect(explanation).not.toContain('because you accept that exchange');
  });
});
