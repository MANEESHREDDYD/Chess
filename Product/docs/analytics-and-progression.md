# Analytics and Progression

MIRROR treats user progression as a data science problem. Instead of simple win/loss tracking, the app utilizes deep telemetry from game interactions to model player skill and learning velocity.

## CP-Loss Analytics
Every reviewed move in MIRROR can be analyzed locally by Stockfish to determine its centipawn (CP) evaluation. Game Review Pro calculates the loss between the played move and the reviewed best move after normalizing the evaluation from the mover's perspective.

### Move Classification Thresholds
Game Review Pro uses deterministic thresholds so move labels are inspectable:

- **Best**: 0 - 10 CP loss
- **Excellent**: 11 - 25 CP loss
- **Good**: 26 - 60 CP loss
- **Inaccuracy**: 61 - 120 CP loss
- **Mistake**: 121 - 250 CP loss
- **Blunder**: more than 250 CP loss
- **Missed win**: only when a high-confidence winning engine opportunity is lost

The `brilliant` label is reserved for a future, more careful detector and is not assigned by the current classifier.

### Accuracy Estimate
An accuracy percentage is calculated per side as MIRROR's internal estimate from average CP-loss. It is intentionally described as an internal estimate, not a clone of any proprietary platform formula.

## Game Review Pro
Game Review Pro stores `game_reviews` and reviewed move rows in local IndexedDB. The route supports completed local matches, Mirror matches, and valid imported games. Invalid imported games are rejected before review.

Each review can include:

- board replay
- move timeline
- deterministic move labels
- best move and principal variation evidence
- CP-loss summary by side
- opening, middlegame, and endgame phase summary
- key moments such as largest loss, first blunder, missed win, swing move, repeated pattern, and critical endgame mistake
- retry mistake mode that compares a user attempt against the reviewed best move
- StyleVector notes when local evidence supports them
- recommended next actions linking back to Clue Chess or Mirror rematch
- local Markdown export

## Advanced Analytics Dashboard

The `/analytics` route brings the local data model into the product UI. It reads IndexedDB stores only and does not require login, cloud sync, platform OAuth, runtime GenAI, or filesystem access.

Dashboard sections include:

- Player intelligence summary across local games, Mirror matches, imports, reviews, active days, and calibration state.
- Game Review Pro summary with reviewed-game count, average CP loss, MIRROR internal accuracy estimate, blunders, mistakes, common move labels, CP-loss trend, and weakest phase.
- StyleVector profile with aggression/risk proxy, exchange willingness, time-pressure risk, motif blindness, endgame strength, openings, preferred minor piece, evidence source, and confidence.
- Weak motif analytics from Clue Chess attempts, puzzle reviews, Game Review motif tags, and StyleVector motif blindness.
- Puzzle review queue with due, overdue, upcoming, interval, and due motif summaries.
- Imported-game coverage with valid/invalid counts, source breakdown, review coverage, analysis coverage, and last import date.
- Mirror performance with personality modes, feedback tags, felt-like-me count, too-random count, latest result, and next Mirror recommendation.
- Story/progression summary with XP, level, achievements, streak, chapter progress, and next chapter recommendation.
- Prioritized recommended actions with route targets and local evidence.

Every chart or visual block ends with a recommended action or an explicit insufficient-data note. This keeps the dashboard product-oriented: it explains what the player should do next instead of simply displaying metrics.

Dashboard exports are summary-first:

- `mirror-analytics-dashboard-YYYY-MM-DD.md`
- `mirror-analytics-snapshot-YYYY-MM-DD.json`

Exports exclude raw PGN, raw backup JSON, auth tokens, and service-role keys.

## Training Analytics
MIRROR tracks user interactions with Clue Chess puzzles and turns them into local training signals.

- **Puzzle solved rate**: tracks the percentage of puzzles completed.
- **Solved without reveal rate**: tracks clean solves where the final answer was not revealed.
- **Clue level usage**: records the highest clue level used from Level 1 theme clue through Level 5 near-solution clue.
- **Motif weakness detection**: if a user frequently fails puzzles tagged with specific motifs, the analytics layer flags the motif as a candidate weakness only when local evidence exists.
- **No-repeat clue memory**: stores which clue variants were shown for each player/puzzle/level so adaptive mode avoids repeating the same clue unless review mode explicitly allows recall repetition.
- **Review-mode success**: measures whether due review puzzles are solved without final reveal.
- **Streak and boss metrics**: records streak counts and boss puzzle clears without adding currency or an economy.

These fields feed `/analytics`, the Python backup reports, and local Clue Chess selection. They do not upload puzzle data and do not use runtime GenAI.

## Adaptive Clue Chess

The `/clue-chess` route now has five local modes:

- **Adaptive Training**: default mode using StyleVector, Game Review motif tags, puzzle attempts, spaced repetition, and Analytics query parameters.
- **Review Mode**: prioritizes due `puzzle_reviews` and allows repeated recall clues.
- **Streak Mode**: uses deterministic streak scoring and resets on missed/revealed puzzles.
- **Boss Puzzle Mode**: creates a 3-5 puzzle sequence around a weak motif or requested motif.
- **Kids Mode**: uses shorter, gentler clue wording and avoids harsh failure copy.

Every mode remains local-first. Missing evidence produces an insufficient-data note instead of invented weakness.

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

## Product Quality Reset

`M-PRODUCT-QUALITY-VISUAL-STORY-RESET-1` intentionally pauses battle profile expansion until core trust and mode clarity are stable.

- Promotion legality is now guarded by a shared chess.js helper before any promotion UI appears.
- Story is presented as a campaign surface with missions, act paths, and progress states rather than a clue-first training screen.
- Current Kurukshetra visuals are documented as an improved 2D placeholder, not a realistic 3D battlefield.
- Battle profile progression should resume only after Story campaign identity and the future visual direction are stable.
