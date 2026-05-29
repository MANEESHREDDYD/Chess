import { Chess } from 'chess.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StyleVector } from '../ml/styleVector';
import type { EngineCandidate } from './stockfishBridge';

const bridge = vi.hoisted(() => ({
  waitForEngine: vi.fn(),
  setOption: vi.fn(),
  getCandidateMoves: vi.fn(),
  getBestMove: vi.fn(),
}));

vi.mock('./stockfishBridge', () => ({
  waitForEngine: bridge.waitForEngine,
  setOption: bridge.setOption,
  getCandidateMoves: bridge.getCandidateMoves,
  getBestMove: bridge.getBestMove,
}));

import { createMirrorOpponent } from './mirrorOpponent';

describe('createMirrorOpponent engine lifecycle', () => {
  beforeEach(() => {
    bridge.waitForEngine.mockResolvedValue(undefined);
    bridge.setOption.mockResolvedValue(undefined);
    bridge.getCandidateMoves.mockReset();
    bridge.getBestMove.mockReset();
  });

  it('returns a legal move in the sub-1320 skill regime', async () => {
    bridge.getCandidateMoves.mockResolvedValue([candidate('e2e4', 0)]);

    const opponent = createMirrorOpponent(makeVector(900));
    const result = await opponent.getMoveWithTrace(new Chess().fen(), { depth: 8, timeoutMs: 1000 });

    expect(result.move).toBe('e2e4');
    expect(new Chess().move({ from: 'e2', to: 'e4' })).toBeTruthy();
    expect(bridge.setOption).toHaveBeenCalledWith('UCI_LimitStrength', false);
    expect(bridge.setOption).toHaveBeenCalledWith('Skill Level', expect.any(Number));
  });

  it('returns a legal move in the UCI_LimitStrength regime', async () => {
    bridge.getCandidateMoves.mockResolvedValue([candidate('d2d4', 0)]);

    const opponent = createMirrorOpponent(makeVector(1500));
    const result = await opponent.getMoveWithTrace(new Chess().fen(), { depth: 8, timeoutMs: 1000 });

    expect(result.move).toBe('d2d4');
    expect(new Chess().move({ from: 'd2', to: 'd4' })).toBeTruthy();
    expect(bridge.setOption).toHaveBeenCalledWith('UCI_LimitStrength', true);
    expect(bridge.setOption).toHaveBeenCalledWith('UCI_Elo', 1500);
  });

  it('falls back to a bestmove when MultiPV returns no candidates', async () => {
    bridge.getCandidateMoves.mockResolvedValue([]);
    bridge.getBestMove.mockResolvedValue('g1f3');

    const opponent = createMirrorOpponent(makeVector(1500));
    const result = await opponent.getMoveWithTrace(new Chess().fen(), { depth: 8, timeoutMs: 1000 });

    expect(result).toMatchObject({ move: 'g1f3', trace: null, candidates: [] });
    expect(bridge.getBestMove).toHaveBeenCalledOnce();
  });

  it('guards against non-finite depth before asking the worker for candidates', async () => {
    bridge.getCandidateMoves.mockImplementation(
      async (_fen: string, _multipv: number, depth: number) => {
        expect(Number.isFinite(depth)).toBe(true);
        expect(depth).toBeGreaterThanOrEqual(1);
        return [candidate('e2e4', 0)];
      }
    );

    const opponent = createMirrorOpponent(makeVector(900));
    await opponent.getMoveWithTrace(new Chess().fen(), { depth: Number.NaN, timeoutMs: 1000 });
  });

  it('does not leave the shared Stockfish worker strength-limited after disposal', async () => {
    bridge.getCandidateMoves.mockResolvedValue([candidate('e2e4', 0)]);

    const opponent = createMirrorOpponent(makeVector(1500));
    await opponent.getMoveWithTrace(new Chess().fen(), { depth: 8, timeoutMs: 1000 });

    bridge.setOption.mockClear();
    opponent.dispose?.();

    expect(bridge.setOption).toHaveBeenCalledWith('UCI_LimitStrength', false);
  });
});

function candidate(move: string, cp: number): EngineCandidate {
  return {
    move,
    cp,
    mate: null,
    multipv: 1,
    pv: [move],
  };
}

function makeVector(detectedElo: number): StyleVector {
  return {
    opening_white_top3: ['e4'],
    opening_black_top3: ['e5'],
    avg_move_time_ms: 9000,
    time_pressure_blunder_rate: 0.4,
    exchange_willingness: 0.5,
    preferred_minor: 'neutral',
    motif_blindness: {
      fork: 0.2,
      pin: 0.2,
      skewer: 0.2,
      removing_the_defender: 0.2,
    },
    endgame_strength: 0.5,
    swindle_preference: null,
    detected_elo: detectedElo,
    elo_band: detectedElo < 1200 ? 'apprentice' : 'initiate',
    schema_version: 1,
  };
}
