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

## Mirror Opponent Behavior
When the user plays against their "Mirror", the engine does not just play the best move.
1. Stockfish generates the top N moves (MultiPV).
2. A custom **Reranking Algorithm** scores each legal candidate based on StyleVector evidence, candidate move features, and the selected Mirror personality mode.
3. The personality modes are deterministic local variants: current self, past self, aggressive self, cautious self, blunder-prone self, and improved self.
4. The engine can intentionally play human-like sub-optimal moves when they match the selected personality and stay inside bounded CP-loss windows.
5. **CP-Gap Verification**: We continuously monitor the Centipawn (CP) loss of the Mirror's choices to ensure it remains bounded and doesn't blunder pieces wildly, maintaining a challenging but realistic difficulty.

Mirror 2.0 extracts candidate features such as CP loss, captures, checks, early queen movement, material proxy, king-safety proxy, opening preference, and risk proxy. Stockfish supplies candidate strength; MIRROR reranks those candidates locally. This is not a trained neural network.

## Adaptive Clue Selection
During training puzzles, MIRROR uses the StyleVector to identify the user's "Motif Blindness" (e.g., they often miss discovered attacks). It curates Clue Hints based on these specific algorithmic weaknesses rather than generic tooltips.

## Limitations & Future GenAI Coach
Currently, coaching feedback is rule-based and local. The Local Coach Preview uses deterministic summaries from local data; it does not call an LLM.

**GenAI-Readiness**: The analytics and coach context models are designed to be compatible with future optional LLM-based coaching. The design docs define prompt contracts, context boundaries, and agentic workflows. A runtime GenAI coach is planned for a future milestone, but it is not implemented yet.
