# Agentic Coach Workflows

This document designs possible future agents for MIRROR's optional coaching system. No runtime agents or LLM calls are implemented in this milestone.

The current runtime implementation is deterministic and local-only. It builds `MirrorCoachContext`, emits prioritized `CoachCard` records, exports Markdown/JSON summaries, and runs `CoachSafetyReport` checks without cloud inference or private data upload.

## Current Deterministic Agent Analog

The local coach stub maps future agent responsibilities onto deterministic cards:

- Data Profiler Agent maps to the context builder and `data_quality` cards.
- Weakness Diagnosis Agent maps to `weakness` cards.
- Training Plan Agent maps to the local training plan and top recommendation.
- Puzzle Recommendation Agent maps to `review` cards and due motif evidence.
- Post-Game Explanation Agent maps to `analysis` cards.
- Story Mentor Agent maps to `story` cards.
- Safety/Privacy Guard Agent maps to privacy flags, insufficient-data flags, prompt-context validation, export safety checks, and the `/coach-preview` safety report.

This proves the interface and product behavior before any optional GenAI runtime exists.

## Data Profiler Agent

Inputs:

- `mirror_features.json`
- player summary
- StyleVector summary
- saved analysis aggregates
- clue attempt aggregates

Outputs:

- `MirrorCoachContext`
- deterministic `data_quality` cards
- privacy flags
- data gap list

Tools/data sources:

- Python analytics outputs
- IndexedDB stores
- SQL marts

Failure modes:

- malformed backup
- missing player
- stale analytics artifacts
- raw PGN accidentally included

Guardrails:

- validate context schema
- exclude raw PGN/FEN by default
- set `safe_to_send_to_llm` false when private fields are present

## Weakness Diagnosis Agent

Inputs:

- puzzle weakness summary
- StyleVector motif blindness
- analysis quality summary

Outputs:

- weakest motif
- strongest motif
- deterministic `weakness` cards
- confidence note
- insufficient-data note

Tools/data sources:

- `puzzle_performance.csv`
- clue attempts
- puzzle reviews
- StyleVector

Failure modes:

- tiny sample size
- conflicting motif signals
- no puzzle history

Guardrails:

- never claim permanent player traits
- state sample-size limits
- prefer "current pattern" over "you are bad at"

## Training Plan Agent

Inputs:

- MirrorCoachContext
- due review count
- weakest motif
- analysis trend
- story progress

Outputs:

- weekly training plan
- daily practice blocks
- next action
- prioritized card list

Tools/data sources:

- local deterministic coach
- future optional prompt contract

Failure modes:

- overlong plans
- invented time availability
- ignoring due reviews

Guardrails:

- use only provided context
- keep plans short
- replace missing data with data-gathering tasks

## Puzzle Recommendation Agent

Inputs:

- puzzle reviews
- clue attempts
- motif weakness rows
- spaced repetition queue

Outputs:

- next review motif
- next new puzzle motif
- reason for priority
- deterministic `review` card

Tools/data sources:

- local puzzle review queue
- clue attempt history

Failure modes:

- recommending solved material too often
- recommending new puzzles before due reviews
- exposing raw solution lines

Guardrails:

- due reviews before new material
- no raw FEN or solution line in prompt context by default
- deterministic tie-breaking by motif name

## Post-Game Explanation Agent

Inputs:

- saved analysis summary
- CP-loss aggregate
- move classification counts
- StyleVector summary

Outputs:

- post-game coaching summary
- why you lost summary
- what to practice next summary
- deterministic `analysis` card when saved analysis exists

Tools/data sources:

- saved analyses
- analysis_quality mart
- local deterministic coach

Failure modes:

- overclaiming causality from CP-loss
- inventing move details
- treating Stockfish as a human coach

Guardrails:

- Stockfish is identified as the chess engine
- explanations cite only summary metrics unless raw local review is explicitly enabled
- insufficient-data behavior when no analysis exists

## Story Mentor Agent

Inputs:

- story progress summary
- recommended next action
- active theme

Outputs:

- story-based motivation
- respectful chapter continuation note
- deterministic `story` card

Tools/data sources:

- story progress store
- story seed metadata

Failure modes:

- sacred/religious parody
- invented chapters
- prioritizing story over training needs

Guardrails:

- respectful Mahabharata-inspired language
- no parody of sacred figures, rituals, or beliefs
- keep story mode optional
- keep chess practice central

## Safety/Privacy Guard Agent

Inputs:

- MirrorCoachContext
- proposed output
- prompt contract
- privacy flags

Outputs:

- allowed response
- blocked response with reason
- redaction request
- export safety status
- deterministic `CoachSafetyReport`

Tools/data sources:

- privacy schema
- prompt contracts
- source field allowlist

Failure modes:

- false negative on private data leakage
- false positive blocking useful coaching
- missing new context fields

Guardrails:

- deny raw PGN/FEN exposure by default
- deny account identifiers and secrets
- deny invented statistics
- deny medical or psychological claims
- require "insufficient data" when evidence is missing
- keep `safe_to_send_to_llm` false by default until explicit consent and redaction are implemented

Current local checks live in:

- `src/coach/coachSafety.ts`
- `src/coach/promptContextValidator.ts`
- `docs/local-coach-safety-eval.md`
