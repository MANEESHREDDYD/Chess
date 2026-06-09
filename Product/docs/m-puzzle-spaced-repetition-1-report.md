# M-PUZZLE-SPACED-REPETITION-1 Report

## Goal
Add a local-first spaced repetition system for Clue Chess and multi-move puzzles to enhance learning and retention without utilizing cloud synchronization or complex external APIs.

## Implementation Details
* **Database Schema Update (v7)**: Added `puzzle_reviews` object store with indexes (`player_id`, `puzzle_id`, `next_due_at`, `motif`, `last_result`) for efficient review queue fetching without breaking existing migrations.
* **Review Algorithm**: Implemented a deterministic spaced repetition system with specific intervals:
    - Failed attempts result in a 0-day interval (due immediately) and reset `solved_streak`.
    - Solved attempts increase the `solved_streak` and set intervals progressively to 1, 3, 7, 14, and 30 days.
* **Review Queue Mode**: Upgraded `ClueChess.tsx` with a toggle mode allowing players to switch between "New Puzzle" and "Review Due" modes. The review mode prioritizes puzzles due for practice and naturally skips them if they are solved successfully.
* **Progression Integration**: Updated `progression.ts` to surface due reviews as the top priority in the recommended next action for the player, keeping them accountable for their practice schedule. Added `due_reviews_count` to player summary.
* **Testing**: Achieved comprehensive unit test coverage with `spacedRepetition.test.ts` representing 8 full test cases. `npm test`, `typecheck`, and `lint` verify the system's robustness across 136 total tests.

## Strict Rules Upheld
* Zero cloud dependencies (no Supabase, backend auth, or sync).
* Local-first architecture maintained cleanly using IndexedDB.
* Deterministic intervals without complex scheduling algorithms.

## Next Milestone Context
The spaced repetition loop sets the foundation for tracking long-term learning without requiring persistent server accounts, seamlessly weaving into local story and progress frameworks.
