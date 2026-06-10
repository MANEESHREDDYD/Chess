# Mirror 2.0 Personality Opponent Report

## Milestone

`M-MIRROR-2-PERSONALITY-OPPONENT`

## Product Promise

MIRROR plays like you, exposes your habits, and helps you beat your own weaknesses.

This milestone upgrades the opponent from a single generic StyleVector reranker into six deterministic local personality variants:

- `current_self`
- `past_self`
- `aggressive_self`
- `cautious_self`
- `blunder_prone_self`
- `improved_self`

## Current StyleVector Fields

The current TypeScript `StyleVector` has 11 behavioral/profile fields plus `schema_version` metadata:

- `opening_white_top3`
- `opening_black_top3`
- `avg_move_time_ms`
- `time_pressure_blunder_rate`
- `exchange_willingness`
- `preferred_minor`
- `motif_blindness`
- `endgame_strength`
- `swindle_preference`
- `detected_elo`
- `elo_band`
- `schema_version`

This milestone does not change StyleVector dimensionality.

## Previous Mirror Behavior

Before Mirror 2.0, the opponent used:

1. Local Stockfish Web Worker.
2. MultiPV candidate generation.
3. A deterministic StyleVector bias over candidate moves.
4. Legal move filtering through `chess.js`.
5. A short explanation of the selected move.

The previous reranker considered:

- exchange willingness
- opening repertoire
- preferred minor piece
- forcing checks/promotions
- motif/time-pressure probe windows
- swindle preference

## Weaknesses In Previous Behavior

- Only one Mirror personality existed, so it felt more like a generic personalized engine than a family of self-opponents.
- Move explanations were string-first rather than structured evidence objects.
- Candidate features were embedded inside the engine wrapper instead of being independently testable.
- There was no explicit improved-self or blunder-prone-self mode.
- Feedback captured high-level recognition but not tactical tone such as too random, too aggressive, or good training.

## Mirror 2.0 Implementation

Mirror 2.0 keeps Stockfish as the chess evaluator and adds a deterministic personality reranking layer.

New modules:

- `src/mirror/mirrorPersonality.ts`
- `src/mirror/moveFeatureExtractor.ts`
- `src/mirror/mirrorReranker.ts`
- `src/mirror/mirrorExplanation.ts`

The move flow is:

1. Stockfish returns candidate moves and evaluations.
2. `moveFeatureExtractor` validates candidates against legal `chess.js` moves.
3. It computes candidate features such as CP loss, capture/check flags, early queen movement, material proxy, risk proxy, king-safety proxy, and opening preference proxy.
4. `mirrorPersonality` maps the local StyleVector into personality weights.
5. `mirrorReranker` scores only legal candidates inside bounded CP-loss windows.
6. `mirrorExplanation` produces a structured evidence object and UI-readable summary.

## Personality Modes

`current_self`

- Closest to the raw StyleVector.
- Allows style-based overrides inside a moderate CP-loss window.
- Best for checking whether MIRROR feels like the user's current habits.

`aggressive_self`

- Higher weight on captures, checks, forcing pressure, and controlled risk.
- Still bounded by legal candidates and CP-loss limits.

`past_self`

- Uses a previous local StyleVector when the current tuned record points to one.
- Falls back with an insufficient-data warning when no previous vector exists.
- Useful for sparring with older habits after at least one saved tuned Mirror game.

`cautious_self`

- Higher weight on king safety, castling, and lower-risk moves.
- Penalizes early queen moves and loose-piece risk.

`blunder_prone_self`

- Intentionally exposes the user's common weakness signals in controlled form.
- It does not choose illegal moves or arbitrary random moves.
- It stays inside a wider but bounded CP-loss window.

`improved_self`

- Keeps recognizable StyleVector traits but reduces CP loss.
- Penalizes known weakness, early queen risk, and avoidable tactical exposure.

## Explanation Behavior

Each selected Mirror move can now include:

- selected move
- personality mode
- style reasons
- engine reasons
- weakness reasons
- confidence
- evidence
- insufficient-data flag

If StyleVector evidence is thin, MIRROR says so instead of inventing facts.

## Feedback Loop

Mirror feedback remains local and deterministic. The form now stores optional tags in feedback metadata:

- felt like me
- too strong
- too random
- too aggressive
- too passive
- good training

These tags are stored as local evidence for future tuning and analytics. The current implementation does not overfit live moves from a single feedback record.

## Honesty Notes

- Stockfish is the chess engine.
- MIRROR does not claim a trained neural network for move selection in this milestone.
- Personality modes are deterministic StyleVector-based reranking profiles.
- Runtime GenAI coaching is still not implemented.
- No cloud inference, multiplayer, 3D, PGN import, or StyleVector schema migration was added.

## Verification

`scripts/run-mirror-personality-verification.mjs` verifies:

1. Stockfish health still passes.
2. Mirror can produce legal moves as White and Black.
3. Every personality mode selects from legal fixture candidates.
4. Identical input produces deterministic ordering.
5. Improved self has equal-or-better CP loss than blunder-prone self in the fixture.
6. Explanations are generated.
