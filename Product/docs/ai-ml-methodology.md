# AI & ML Methodology

MIRROR provides a deeply personalized AI chess experience. While we currently use established chess engines for evaluation, the "Mirror" aspect relies on behavioral profiling and move reranking.

## What is Stockfish?
**Honesty Clause:** MIRROR does *not* train a custom neural network from scratch to evaluate chess positions. We utilize **Stockfish** (running as a WebAssembly Web Worker) to evaluate board states. Stockfish is an engine, not a custom ML model. 

## The StyleVector (Personalization Layer)
The core of MIRROR's AI is the **StyleVector**, a local behavioral personalization record. The current TypeScript interface has 11 behavioral/profile fields plus `schema_version` metadata:

- opening preferences as white and black
- average move time
- time-pressure blunder rate
- exchange willingness
- preferred minor piece
- motif blindness
- endgame strength
- swindle preference
- detected Elo
- Elo band

### Calibration Method
When a user completes calibration, MIRROR converts task outputs into StyleVector fields. These include tactical motif results, time-pressure behavior, exchange decisions, opening choices, endgame outcome, and detected Elo band. Over time, this builds a behavioral fingerprint for local personalization.

### PGN Import Evidence
MIRROR can also enrich StyleVector evidence from local, user-provided PGN imports. The import pipeline supports pasted PGN text and uploaded `.pgn` files, parses one or many games, validates legal moves, and stores each imported game locally.

Imported games update StyleVector conservatively:
- valid games only
- no update from malformed games
- opening, capture, castling, queen-move, minor-piece, result, and move-count proxies only when supported by the PGN
- user-side features only when the PGN headers can identify the active player as White or Black
- no time-pressure behavior unless PGN clock data is present
- no tactical motif weakness unless analysis data exists

This is still rule-based feature engineering, not a trained model. External platforms are supported only through user-provided PGN exports; MIRROR does not use OAuth or scraping for this milestone.

## Mirror Opponent Behavior
When the user plays against their "Mirror", the engine does not just play the best move.
1. Stockfish generates the top N moves (MultiPV).
2. A custom **Reranking Algorithm** scores each legal candidate based on StyleVector evidence, candidate move features, and the selected Mirror personality mode.
3. The personality modes are deterministic local variants: current self, past self, aggressive self, cautious self, blunder-prone self, and improved self.
4. The engine can intentionally play human-like sub-optimal moves when they match the selected personality and stay inside bounded CP-loss windows.
5. **CP-Gap Verification**: We continuously monitor the Centipawn (CP) loss of the Mirror's choices to ensure it remains bounded and doesn't blunder pieces wildly, maintaining a challenging but realistic difficulty.

Mirror 2.0 extracts candidate features such as CP loss, captures, checks, early queen movement, material proxy, king-safety proxy, opening preference, and risk proxy. Stockfish supplies candidate strength; MIRROR reranks those candidates locally. This is not a trained neural network.

## Adaptive Clue Selection
During training puzzles, MIRROR uses local evidence to choose clue difficulty and training mode. Evidence can come from StyleVector motif blindness, Game Review Pro motif tags, puzzle attempt history, spaced-repetition review rows, and `/analytics` weak-motif links.

Clue Chess now uses five deterministic levels:

- Level 1 theme clue: identifies the tactical idea.
- Level 2 candidate area clue: points to a board region or candidate piece.
- Level 3 threat clue: explains what the opponent is vulnerable to.
- Level 4 calculation clue: suggests the forcing sequence idea without exact move.
- Level 5 near-solution clue: gives a strong constraint without revealing exact SAN.

Final reveal is separate and only appears after failed attempts or explicit request. Adaptive mode avoids repeating the same clue variant for the same player, puzzle, and level unless review mode is intentionally being used for recall. If local evidence is missing, MIRROR says so and uses a neutral clue sequence instead of inventing a personal weakness.

## Game Review Pro
Game Review Pro is a local-first review loop for completed local matches, Mirror matches, and valid imported games.

The review engine:

- reconstructs positions move by move from legal PGN
- asks the stable local Stockfish manager for candidate moves sequentially
- normalizes evaluation from the mover's perspective before calculating CP loss
- labels moves with deterministic thresholds
- detects key moments and phase-level weakness
- generates StyleVector notes only when local evidence supports them

Current deterministic thresholds:

- `best`: 0-10 CP loss
- `excellent`: 11-25 CP loss
- `good`: 26-60 CP loss
- `inaccuracy`: 61-120 CP loss
- `mistake`: 121-250 CP loss
- `blunder`: more than 250 CP loss
- `missed_win`: only when the best line had a large winning advantage and the played move gave most of it back

`brilliant` is reserved in the type system but is not assigned by the current deterministic classifier because MIRROR does not yet have enough sacrifice/engine-line proof to use it responsibly.

The accuracy number shown in reviews is MIRROR's internal estimate from local CP-loss, not a proprietary external-platform formula.

## Limitations & Future GenAI Coach
Currently, coaching feedback is rule-based and local. The Local Coach Preview uses deterministic summaries from local data; it does not call an LLM.

**GenAI-Readiness**: The analytics and coach context models are designed to be compatible with future optional LLM-based coaching. The design docs define prompt contracts, context boundaries, and agentic workflows. A runtime GenAI coach is planned for a future milestone, but it is not implemented yet.

## Product Quality Guardrails

Personalized AI behavior must sit on correct chess rules. Promotion detection is now centralized in a chess.js-backed legality helper used by the shared board component before route-level handlers can open a promotion dialog. This prevents non-pawn pieces, wrong ranks, stale UI state, themed orientation, Clue Chess, or Story handlers from bypassing promotion legality.

The current visual layer remains a Mahabharata/Kurukshetra-inspired 2D placeholder. MIRROR should not claim realistic 3D soldier or battlefield visuals until the planned 3D milestones implement and verify them.

## Rendering/rules boundary (2026-06-11)

The new Kurukshetra Battlefield 3D layer (`src/three/`) is rendering-only: it parses the
FEN for display, reconciles piece instances for animation, and forwards square clicks into
the existing `gameStore.makePlayerMove` pipeline. chess.js remains the single legality
authority for 2D, 3D, Mirror personalities, Clue, and Story encounters alike. Runtime GenAI
is still not implemented.
