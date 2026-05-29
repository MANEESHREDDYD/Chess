// GameMode — the architecture seam for "a chess game with different rules
// around setup, opponent, scoring, and completion."
//
// STATUS: intentional future contract. No implementation exists yet, and the
// eventual mode adapters are expected to refine the shape. Keep this file even
// while it is unused so future game modes share one explicit seam.
//
// Today's flows that this interface anticipates (none of them currently
// implement it; refactors should happen only when those modules are next
// touched for unrelated reasons):
//   - free-play           (src/state/gameStore.ts + src/routes/Play.tsx)
//   - Task 1 / Task 4     (TaskBoardShell.tsx — tactical positions)
//   - Task 3              (Task3EndgameTechnique.tsx — Lucena + budget)
//   - Task 5              (Task5MoralChess.tsx — branch chooser)
//   - Task 8              (Task8VyasaMatch.tsx — 5+3 match)
//
// Anticipated future implementations:
//   - MirrorMatchMode, StoryChapterMode, RankedMode, LocalMultiplayerMode,
//     RemoteMultiplayerMode, TaskChallengeMode.
//
// See docs/ARCHITECTURE.md §B.1 for the seam analysis.

import type { Chess } from 'chess.js';

export type GameOutcome =
  | { kind: 'in-progress' }
  | { kind: 'win'; by: 'checkmate' | 'resignation' | 'objective' }
  | { kind: 'loss'; by: 'checkmate' | 'resignation' | 'timeout' | 'objective-failed' }
  | {
      kind: 'draw';
      by: 'stalemate' | 'repetition' | 'fifty-move' | 'insufficient' | 'agreement';
    }
  | { kind: 'abandoned' };

export interface GameModeMoveBudget {
  used: number;
  remaining?: number;
}

export interface GameMode<TConfig = unknown, TState = unknown> {
  readonly id: string;
  readonly displayName: string;
  initialFen(config: TConfig): string;
  evaluateState(game: Chess, state: TState): GameOutcome;
  moveBudget?(state: TState): GameModeMoveBudget;
}
