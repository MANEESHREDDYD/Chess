# Milestone Report: M-MULTI-MOVE-PUZZLES

## Overview
This milestone upgraded the Clue Chess and Story encounter systems to support multi-move tactical sequences. Users can now solve puzzles that require multiple forced moves, receiving progressive clues for the current step and seeing forced opponent replies applied automatically. The attempt data is fully persisted in IndexedDB.

## Completed Tasks
1. **DB Updates (`src/data/db.ts`)**
   - Added optional fields to `ClueAttemptRecord` without bumping the DB version: `current_step`, `solved_steps`, `total_steps`, `line_attempts`, `failed_step`.
   - Safely accommodates older single-move records.

2. **Puzzle Data (`src/data/cluePuzzles.ts`)**
   - Implemented `solution_line` to support sequence puzzles.
   - Added 4 multi-move puzzles (`seed-multi-decoy-1`, `seed-multi-deflection-1`, `seed-multi-remove-defender-1`, `seed-multi-mate-1`).
   - Extended `step_clues` format to provide targeted hint levels for each step of a multi-move sequence.

3. **Validation Scripts (`scripts/validate-puzzles.ts`)**
   - Fully re-written to traverse `solution_line` step-by-step.
   - Validates alternating sides, FEN legality, reachability, and matching UCI moves.

4. **Shared Sequence State (`src/training/usePuzzleSequence.ts`)**
   - Extracted all step sequence state management into a shared custom hook.
   - Handles auto-playing opponent replies, validating user moves against the current step, advancing steps, and saving multi-move persistence data to IndexedDB.

5. **UI Refactors (`src/routes/ClueChess.tsx` & `src/routes/Story.tsx`)**
   - Both `ClueChess.tsx` and `Story.tsx` were updated to utilize the new `usePuzzleSequence` hook.
   - UI elements added for "Step X of Y", "Opponent replies: ...", and an explicit "Restart Sequence" button when a wrong move is made.
   - Chapter 7 in `mahabharataStorySeed.ts` was swapped to use the new `seed-multi-mate-1` queen sacrifice puzzle.

6. **Test Suites and Linting**
   - Fixed TS definitions, mock setups in Vitest, and updated the DB testing schemas.
   - Ensured no compilation errors and 100% test passing rate.

## Tagging
- Tagged: `v1.10.0-multi-move-puzzles`

## Summary
The application is now capable of running complex, multi-move puzzles, paving the way for advanced tactical training and dynamic story encounters in the Mahabharata campaign.
