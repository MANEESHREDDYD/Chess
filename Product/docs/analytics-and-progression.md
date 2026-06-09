# Analytics and Progression

MIRROR treats user progression as a data science problem. Instead of simple win/loss tracking, the app utilizes deep telemetry from game interactions to model player skill and learning velocity.

## CP-Loss Analytics
Every move played in MIRROR is optionally analyzed by Stockfish to determine its Centipawn (CP) evaluation. We calculate the delta (loss) between the player's move and the engine's absolute best move.

### Move Classification Thresholds
Based on standard chess analytics, we classify moves to give the user a clear post-game report:
- **Brilliant / Best**: <= 10 CP gap
- **Excellent**: 11 - 30 CP gap
- **Good**: 31 - 80 CP gap
- **Inaccuracy**: 81 - 150 CP gap
- **Mistake**: 151 - 300 CP gap
- **Blunder**: > 300 CP gap

### Accuracy Estimate
An accuracy percentage is calculated per match using an asymptotic decay formula on the average CP-loss, providing an intuitive metric that maps roughly to standard chess platform accuracies.

## Training Analytics
MIRROR tracks user interactions with Clue Chess puzzles.
- **Puzzle Solved Rate**: Tracks the percentage of puzzles completed without using heavy hints.
- **Motif Weakness Detection**: If a user frequently fails puzzles tagged with specific motifs (e.g., "Pin", "Fork"), the analytics layer flags this as a weakness, feeding this data back into the adaptive clue selection system.

## Spaced Repetition Schedule
To optimize learning, MIRROR employs a SuperMemo-style spaced repetition algorithm for puzzle review:
- Every puzzle solved is entered into the `puzzle_reviews` queue.
- If solved easily, the interval until the next review is multiplied (e.g., 1 day -> 3 days -> 7 days).
- If failed or struggled, the interval resets.
- The player's dashboard highlights a specific "Review Queue" logic.

## Story Progress & XP
The narrative "Mahabharata" campaign triggers analytics events upon chapter completion.
- **XP Formula**: Players earn XP based on the CP-loss of their story encounters and puzzle accuracies.
- **Level & Achievements**: Standard RPG-style leveling thresholds reward badges (achievements) stored locally, incentivizing continuous improvement.
