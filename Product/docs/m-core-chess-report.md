# M-CORE-CHESS Status Report

**Date:** June 8, 2026  
**Commit Hash:** (to be tagged)  

## Features Completed
1. **Stable `/play` Route:**
   - Unified interface for free-play against Stockfish.
   - Selectable difficulty (Beginner, Casual, Club, Strong) correctly throttling Stockfish depth parameters.
   - Side selection (White, Black, Random).
   - "Offer Draw" and "Resign" actions correctly handle state and gracefully end the match.
2. **Move History UI:**
   - Real-time numbered move list (SAN notation) rendered alongside the board.
   - Automatically populates as moves are made.
3. **Match State Reliability:**
   - UI correctly blocks player moves when `engineThinking` is true.
   - Robust `checkGameEnd` logic correctly assigns the "Game over" state, determining result text (You won, You lost, Draw, Game ended).
4. **Basic Local Match History (IndexedDB):**
   - Migrated IndexedDB schema (`MIRROR_DB_VERSION` = 2) to include `local_matches` table.
   - Every completed game on `/play` triggers persistence.
   - UI table automatically renders past games with mode, side, difficulty, moves, and result.
5. **Export:**
   - Play route includes `Download PGN` and `JSON Export` capabilities for Match Records.
6. **Mirror Handoff Safety:**
   - M-MIRROR infrastructure in `src/engine/mirrorOpponent.ts` and `scripts/analyze_mirror_match.mjs` was isolated and preserved without regression.

## Files Changed
- `src/App.tsx` - Protected DEV-only routes.
- `src/data/db.ts` - Added IndexedDB `local_matches` store and `putLocalMatchRecord`/`getLocalMatches` helpers.
- `src/data/db.test.ts` - Updated test suite for V2 schema.
- `src/state/gameStore.ts` - Integrated `difficulty`, `history`, `offerDraw`, and automated `saveLocalMatch` triggers.
- `src/routes/Play.tsx` - Refactored entire UI to house history views, active difficulty state, and match logs.

## Verification
### Automated Tests
- **Typecheck**: `tsc --noEmit` - PASS
- **Lint**: `eslint` - PASS
- **Test Suite**: `vitest run` - PASS (100/100 tests passed)
- **Mirror Script**: `node scripts/run-mirror-verification.mjs` - PASS (Match generation succeeds, CP-gap analysis shows style vector overrides, M-MIRROR remains intact).

### Manual Verification
- Navigated to `/play` with `npm run dev`.
- Started new game on "Beginner". Played a few moves, observed real-time history appending.
- Resigned the game, and verified it instantly saved to the "Local Match History" list below the board.
- Successfully downloaded PGN and JSON for the completed record.

## Known Limitations
- "Offer Draw" logic is currently a stub that always defaults to a Draw without evaluating Stockfish's actual board state or threshold heuristics.
- Difficulty throttling purely limits `depth` (1, 5, 10, 15), which limits tactical depth but Stockfish still rarely plays "human-like" sub-optimal blunders unless heavily handicapped with multiPV random selections.
- History view doesn't allow clicking past moves to preview the board state (not requested yet).

## Decision
**M-CORE-CHESS COMPLETE.** 
The foundations for traditional free play are now established, locally persistent, and robust.

---
**Next Recommended Milestone:** `M-ACCOUNTS` or `M-ONBOARDING` (or whichever immediate product layer introduces initial player state creation before we build complex analytics and online play).
