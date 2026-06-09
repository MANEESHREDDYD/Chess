# AI & ML Methodology

MIRROR provides a deeply personalized AI chess experience. While we currently use established chess engines for evaluation, the "Mirror" aspect relies on behavioral profiling and move reranking.

## What is Stockfish?
**Honesty Clause:** MIRROR does *not* train a custom neural network from scratch to evaluate chess positions. We utilize **Stockfish** (running as a WebAssembly Web Worker) to evaluate board states. Stockfish is an engine, not a custom ML model. 

## The StyleVector (Personalization Layer)
The core of MIRROR's AI is the **StyleVector**, a 12-dimensional continuous array that profiles human behavioral tendencies:
- `aggression` (preference for checks/captures vs quiet moves)
- `complexity` (preference for high piece-tension and branching factors)
- `endgame_preference` (willingness to trade queens and simplify)
- `defensive_patience` (tolerance for cramped positions without lashing out)
- ...and others.

### Calibration Method
When a user plays calibration games, the system analyzes every move they make. We compare the user's chosen move against Stockfish's top 5 evaluations (MultiPV). If the user chooses a slightly sub-optimal move that leads to higher tension, their `complexity` vector score increases. Over time, this builds a behavioral fingerprint.

## Mirror Opponent Behavior
When the user plays against their "Mirror", the engine does not just play the best move.
1. Stockfish generates the top N moves (MultiPV).
2. A custom **Reranking Algorithm** scores each of those N moves based on how well they align with the user's `StyleVector`. 
3. The engine intentionally plays "human-like" sub-optimal moves if they align perfectly with the player's typical aggression or complexity.
4. **CP-Gap Verification**: We continuously monitor the Centipawn (CP) loss of the Mirror's choices to ensure it remains bounded and doesn't blunder pieces wildly, maintaining a challenging but realistic difficulty.

## Adaptive Clue Selection
During training puzzles, MIRROR uses the StyleVector to identify the user's "Motif Blindness" (e.g., they often miss discovered attacks). It curates Clue Hints based on these specific algorithmic weaknesses rather than generic tooltips.

## Limitations & Future GenAI Coach
Currently, the coaching feedback is rule-based and triggered by CP-loss thresholds. 
**GenAI-Readiness**: The analytics data model is designed to be fully compatible with LLM-based coaching. A future milestone will integrate a GenAI Coach that reads the `saved_analyses` and `StyleVector` to provide natural language, conversational advice. *A runtime GenAI coach is currently planned, but not yet implemented.*
