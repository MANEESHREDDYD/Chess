# Data / AI Engineering Showcase

MIRROR now includes a local-first Python and SQL analytics layer that runs on exported MIRROR backup JSON files. It is designed to prove data engineering, analytics, data science, ML/AI thinking, and forward-deployment readiness without pretending the React app has a runtime GenAI coach.

## What This Layer Proves

The package reads the same backup envelope produced by the app:

- `players`
- `local_matches`
- `mirror_matches`
- `imported_games`
- `saved_analyses`
- `game_reviews`
- `clue_attempts`
- `clue_memory`
- `puzzle_reviews`
- `story_progress`
- `achievements`
- `style_vectors`

It validates the backup shape, converts records into typed Python dataclasses, computes feature tables, and writes local reports. No Supabase project, cloud database, token, service key, or private user data is required.

The app also includes a Local Coach Preview route that consumes local summaries deterministically. It is a bridge toward future optional GenAI coaching, not runtime LLM coaching.

The app now also includes `/analytics`, an in-app Advanced Analytics Dashboard that consumes the same local IndexedDB data directly. The browser dashboard is not a replacement for the Python/SQL pipeline; it is the product-facing layer that turns local features into player guidance.

## Data Engineering Proof

This is a real extract-and-transform layer over app data:

- A schema-aware loader fails safely on malformed backup JSON.
- Dataclasses mirror the IndexedDB stores used by the TypeScript app.
- The CLI produces stable downstream artifacts: CSV marts, Markdown insights, and JSON feature bundles.
- The SQL folder models how the same data would land in a warehouse using portable tables and marts.
- GitHub Actions can install the package, run tests, and smoke-test the CLI.

This demonstrates local-first pipeline design, schema boundaries, ingestion validation, offline batch analytics, and repeatable command-line operations.

## Data Science And Analytics Proof

The analytics layer computes interpretable features rather than decorative summaries:

- Player activity: total games, Mirror matches, active days, streak estimate, achievements, due reviews.
- Imported games: import count, valid imported games, source breakdown, result summary, and imported-game analysis coverage.
- Game Review Pro: reviewed-game count, review average CP loss, review blunders/mistakes, weakest phase, and most common review label.
- In-app dashboard: CP-loss trend, move-label distribution, phase weakness bars, StyleVector profile bars, weak motif rows, review queue, imported-game coverage, Mirror feedback, story/progression summary, and prioritized recommendations.
- Puzzle performance: motif solve rates, weakest motif, strongest motif, review lapses, multi-move failure rate.
- Adaptive Clue Chess: clue levels used, solved-without-reveal rate, final reveal rate, review-mode success rate, best clue streak, boss completions, and no-repeat clue memory rows.
- Analysis quality: average centipawn loss, accuracy estimate, mistakes, blunders, trend against previous analyses.
- Story progress: completed chapters, available chapters, attempts, and completion state.

The metrics are intentionally transparent so they can be audited and evolved into model features later.

## ML / AI Thinking Proof

Stockfish is the chess engine. It evaluates positions and provides centipawn-loss analysis.

StyleVector is MIRROR's behavioral personalization layer. It turns player behavior into feature data such as:

- time-pressure risk
- exchange willingness
- motif blindness
- opening preferences
- preferred minor piece
- endgame strength
- swindle preference
- detected Elo band

The current code defines 11 behavioral/profile fields plus `schema_version` metadata. Docs should not describe this as a 12-dimensional behavioral vector.

The Python layer turns StyleVector records into engineered features:

- aggression index
- risk index
- time-pressure risk
- tactical weakness summary
- positional preference summary

These are not claimed to be a trained ML model. They are honest feature engineering outputs that can feed recommendation systems, clustering, dashboards, or a future coach.

## SQL Analytics Layer

The SQL marts show how exported MIRROR data could be queried in a warehouse:

- `analytics/sql/schema.sql` defines portable staging tables for backup records.
- `marts_player_summary.sql` aggregates player progress, imported-game coverage, activity, analyses, reviews, achievements, and latest StyleVector fields.
- `marts_puzzle_performance.sql` detects motif weakness and review priority.
- Adaptive Clue Chess fields are modeled in `clue_attempts`, `clue_memory`, `marts_player_summary.sql`, and `marts_puzzle_performance.sql`.
- `marts_story_progress.sql` models narrative completion and retry friction.
- `marts_analysis_quality.sql` tracks CP-loss, accuracy, mistakes, blunders, analysis trend, and Game Review Pro rows.

The SQL is intentionally separate from Supabase. It is an analytics model, not an app runtime dependency.

## Running Locally

From `Product/python`:

```bash
python -m pip install -e ".[dev]"
pytest
python -m mirror_analytics.cli --backup ../samples/anonymized-mirror-backup.sample.json --out ../analytics_output
```

The CLI emits:

- `player_summary.csv`
- `puzzle_performance.csv`
- `story_progress.csv`
- `analysis_quality.csv`
- `mirror_insights.md`
- `mirror_features.json`

The sample backup includes anonymized imported PGN rows and one anonymized Game Review Pro record. Valid imported games can contribute to StyleVector evidence and review records; invalid imported games are kept as data-quality rows and excluded from StyleVector updates and analysis.

The sample backup also includes anonymized adaptive Clue Chess fields and clue memory rows. These demonstrate local no-repeat clue tracking and clue-effectiveness analytics without storing secrets, account tokens, or private player data.

## Forward Deployment And GenAI Readiness

This layer is a strong base for forward deployment because it creates repeatable artifacts that can be inspected by engineers, analysts, and product teams. A field engineer could export a local backup, run the CLI, inspect the CSV and Markdown report, and map the result back to player behavior without cloud provisioning.

A future GenAI coach or agent system could build on this layer by:

- reading `mirror_features.json` as structured context
- retrieving recent analysis rows and weakest motifs
- generating training plans from transparent feature data
- keeping human-visible Markdown explanations
- routing recommendations through local-first privacy controls
- using `MirrorCoachContext` as a consent-gated summary object
- passing outputs through deterministic safety and privacy guards
- reusing the `/analytics` snapshot as a local, summary-first context after explicit consent

Runtime GenAI coaching is not implemented here. The current app has a deterministic Local Coach Preview, coach cards, local exports, and design docs for the future optional GenAI path.

The app also includes deterministic safety evaluation before runtime GenAI exists. The checks inspect coach cards, exports, and future prompt contexts for missing evidence, unsupported claims, privacy leaks, and obvious secret-like text.

## Local Coach And Agentic Readiness

Added design surfaces:

- `docs/local-genai-coach-design.md`
- `docs/coach-context-schema.md`
- `docs/genai-prompt-contracts.md`
- `docs/agentic-coach-workflows.md`

Runtime surface:

- `/analytics` renders the Advanced Analytics Dashboard from local IndexedDB summaries and exports safe Markdown/JSON snapshots.
- `/coach-preview` uses local deterministic rules.
- The route builds a summarized `MirrorCoachContext` from IndexedDB records.
- It generates prioritized `CoachCard` objects for weakness, review, analysis, story, progression, mirror, and data quality.
- It exports a local Markdown coach report and summarized JSON context.
- It exports a local safety report with pass/fail status and findings by severity.
- No LLM calls, paid APIs, cloud inference, login, or gameplay upload are required.
- The browser app does not read `analytics_output` files directly; `mirror_features.json` and `mirror_insights.md` remain optional local artifacts from the Python analytics pipeline.

## Recruiter Skill Map

- Data Engineering: schema validation, local ETL, typed loaders, CLI pipelines, warehouse-style SQL marts.
- Data Science / Analytics: feature extraction, solve-rate metrics, CP-loss aggregation, trend detection, review prioritization.
- AI / ML Thinking: StyleVector feature engineering, model-ready JSON features, deterministic recommendation cards, prompt-context validation, interpretable risk and personalization signals.
- Responsible AI / Evaluation: local safety checks for evidence, confidence, unsupported claims, export leakage, and future prompt contexts.
- Forward Deployment: local-first operation, smoke-testable CLI, no cloud prerequisites, documented run path.
- Software Engineering: tests, package metadata, modular Python design, CI workflow, integration with an existing React app without gameplay changes.
