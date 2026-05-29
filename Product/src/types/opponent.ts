// OpponentProvider - the architecture seam for "things that produce the next move."
//
// STATUS: intentional future contract. Keep this seam even when only some
// opponents declare conformance, so move-producing engines have one shared
// shape as the app grows.
//
// Runtime implementations today:
//   - src/engine/stockfishBridge.ts       (free-play, full strength)
//   - src/engine/calibrationOpponent.ts   (calibration Tasks 3 + 8, skill-capped)
//   - src/engine/mirrorOpponent.ts        (Mirror, style-reranked Stockfish)
//
// Future implementations are anticipated:
//   - RemoteOpponent (cross-device multiplayer transport)
//
// This file is documentation-as-types. It deliberately does not force older
// free-play or calibration modules through an adapter until those areas are
// next changed.

export interface OpponentMoveOptions {
  depth?: number;
  timeoutMs?: number;
  skillLevel?: number;
  signal?: AbortSignal;
}

export interface OpponentProvider {
  readonly id: string;
  getMove(fen: string, options?: OpponentMoveOptions): Promise<string | null>;
  dispose?(): void;
}
