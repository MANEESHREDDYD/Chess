// OpponentProvider — the architecture seam for "things that produce the next move."
//
// Two implementations exist today, neither yet wrapped behind this interface:
//   - src/engine/stockfishBridge.ts       (free-play, full strength)
//   - src/engine/calibrationOpponent.ts   (calibration Tasks 3 + 8, skill-capped)
//
// Two future implementations are anticipated, neither built:
//   - MirrorOpponent (style-reranked Stockfish — the core product premise)
//   - RemoteOpponent (cross-device multiplayer transport)
//
// This file is documentation-as-types: it defines the seam so future code can
// declare conformance, and it gives the eventual Mirror builder a place to
// hang an adapter. It deliberately does not refactor either existing module.
//
// See docs/ARCHITECTURE.md §B.2 for the full seam analysis.

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
