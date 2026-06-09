# Local-First GenAI Coach Design

MIRROR has enough local analytics to support a future coaching system: StyleVector behavior, Stockfish analysis, CP-loss metrics, puzzle attempts, spaced repetition reviews, story progress, achievements, SQL marts, and `mirror_features.json`.

This milestone designs that future system and implements a deterministic local coach stub. It does not implement live LLM calls, paid API integrations, cloud inference, or private data upload.

## Product Goal

The future MIRROR coach should turn local chess evidence into practical, respectful training guidance. It should explain what happened, what pattern matters, and what the player should practice next.

The coach should feel personal because it uses MIRROR context, not because it invents facts.

## User Value

- A player gets a short plan after a game or training session.
- Weak motifs are explained in plain language.
- Review queues become understandable, not just scheduled.
- Story mode can motivate the player without replacing chess instruction.
- The player can keep all raw gameplay data local by default.

## Local-First Privacy Model

Default behavior:

- Build coaching context from IndexedDB and local analytics artifacts.
- Keep raw PGN, FEN, move lists, account links, and full backup JSON local-private.
- Use summarized features such as solve rate, CP-loss averages, motif counts, and StyleVector summaries.
- Require explicit user consent before any future LLM adapter receives summarized context.
- Run without login, Supabase, cloud inference, or API keys.

This design treats the local deterministic coach as the current runtime bridge and GenAI as a future optional layer.

## Current Local Coach Stub

`/coach-preview` now uses local IndexedDB summaries to build `MirrorCoachContext`, prioritized `CoachCard` records, and exportable local reports. This is still deterministic software, not a runtime GenAI coach.

Current card types:

- `weakness`: weakest and strongest motif evidence from clue attempts and reviews
- `review`: due spaced-repetition queue counts and due motifs
- `analysis`: Stockfish CP-loss, accuracy, mistake, and blunder summaries
- `story`: current story chapter status and respectful continuation guidance
- `progression`: level, XP, streak, achievements, and next action
- `mirror`: Mirror match sample coverage and analysis gaps
- `data_quality`: missing profile, calibration, StyleVector, puzzle, analysis, story, or match evidence

Every card includes evidence, recommendation, priority, confidence, and source. If data is missing, the card states insufficient data instead of inventing facts.

## Current Safety Evaluation Layer

`/coach-preview` also runs deterministic local safety checks. These checks do not use an LLM.

The safety layer validates:

- card evidence and source metadata
- overconfident insufficient-data recommendations
- unsupported exact-stat claims
- medical, psychological, and permanent-trait language
- sacred/religious parody
- raw PGN/FEN exposure
- secret-like export text
- future prompt context shape and privacy flags

The route can export `mirror-coach-safety-report-YYYY-MM-DD.json` for inspection.

## Coach Data Inputs

Primary analytics artifacts:

- `mirror_features.json`
- `mirror_insights.md`
- `player_summary.csv`
- `puzzle_performance.csv`
- `analysis_quality.csv`
- `story_progress.csv`

The browser app does not depend on `analytics_output` files. Those artifacts are optional local references for analysts, recruiters, or a future consent-gated coach pipeline.

Local app stores and records:

- StyleVector
- saved analyses
- clue attempts
- puzzle reviews
- achievements
- story progress
- players
- local matches
- Mirror matches

The coach should prefer aggregated feature data over raw chess records unless the user explicitly requests deeper local-only review.

## Coach Output Types

- weekly training plan
- tactical weakness explanation
- post-game coaching summary
- next puzzle recommendation
- story-based motivation
- study plan
- why you lost summary
- what to practice next summary
- prioritized deterministic coach cards
- local Markdown coach report
- summarized JSON coach context
- local JSON safety report

All outputs must cite the MIRROR context used. If the context is missing or thin, the coach must say "insufficient data" and recommend how to collect useful local evidence.

## Agent Responsibilities

The future system can be split into small agents:

- Data Profiler Agent: convert local records into concise coaching context.
- Weakness Diagnosis Agent: identify motif and analysis-quality priorities.
- Training Plan Agent: build short, actionable practice plans.
- Puzzle Recommendation Agent: choose review or new puzzle focus from local history.
- Post-Game Explanation Agent: summarize CP-loss and classification patterns.
- Story Mentor Agent: map story progress to respectful motivational copy.
- Safety/Privacy Guard Agent: block unsupported claims and private raw data exposure.

The deterministic local coach implements a useful subset of this contract today without GenAI: context construction, card prioritization, insufficient-data flags, confidence labels, Markdown/JSON exports, and local safety reports.

## Non-Goals

- No runtime GenAI coach in this milestone.
- No OpenAI, Anthropic, Gemini, or other paid API integration.
- No cloud inference.
- No private gameplay upload.
- No medical, psychological, or personality diagnosis.
- No sacred or religious parody.
- No invention of games, ratings, or statistics not present in MIRROR context.
- No claim that deterministic coach cards are LLM-generated.
- No claim that deterministic safety checks are model-based.

## Future Runtime Implementation Options

Option 1: Local deterministic only

- Continue expanding rule-based summaries.
- Safest privacy posture.
- Limited natural language variation.

Option 2: Local model adapter

- Use an optional local model runtime when available.
- Keep context and inference on the user's device.
- Requires model download, performance checks, and explicit resource warnings.

Option 3: User-configured external adapter

- User explicitly opts in and provides their own adapter configuration.
- MIRROR sends only summarized context by default.
- Raw PGN/FEN remains local unless the user deliberately includes it.

Option 4: Hybrid guarded workflow

- Data Profiler and Safety/Privacy Guard stay deterministic.
- Optional LLM only writes prose from a bounded context object.
- All outputs pass through a verifier that rejects invented stats, raw-data leakage, and unsupported claims.

The recommended path is Option 1 now, then Option 2 or guarded Option 4 after the context contract, safety tests, export checks, and prompt-context validator mature.
