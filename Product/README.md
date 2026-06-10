# MIRROR: Personalized AI Coaching & Analytics

MIRROR is an offline-first, progressive web application that reimagines chess training as a personalized AI chess improvement platform with regular chess, a user-like Mirror opponent, story gameplay, adaptive training, analytics, and future multiplayer.

## Product Overview
MIRROR is not just a frontend chess board. It combines a client-side chess product with behavioral profiling, post-game CP-loss analytics, spaced repetition learning, a Mahabharata/Kurukshetra story layer, deterministic local coaching, and a local-first architecture with optional cloud backup.

## Why MIRROR is Unique
Unlike traditional platforms, MIRROR adapts to *how* you play. The current code models StyleVector as 11 behavioral/profile fields plus `schema_version` metadata. The "Mirror Engine" reranks Stockfish evaluations against that profile to simulate your specific playstyle and expose blind spots, with deterministic personality variants for current, past, aggressive, cautious, blunder-prone, and improved versions of the player.

## Recruiter / Hiring Manager Summary
This repository demonstrates professional-grade engineering across multiple domains:
- **Data Engineering**: Robust IndexedDB relational schema, zero-downtime migrations, atomic export/import pipelines, and conflict-aware cloud merges.
- **AI/ML Thinking**: Behavioral profiling (`StyleVector`), custom move-reranking algorithms, and structured data preparation for future GenAI integration.
- **Analytics**: Deep CP-loss telemetry, motif weakness detection, and SuperMemo-style spaced repetition scheduling.
- **Frontend / Product Design**: Responsive React/Vite PWA, modular state management, cohesive onboarding, and a deeply creative narrative UX.
- **Full-Stack Architecture**: Local-first data models with seamless, optional Supabase Auth and Storage integration (enforced by RLS policies).
- **Deployment / Security**: Environment-aware CI commands, stringent verification scripts, and a strict no-secret policy.
- **Engine Reliability**: Stable Stockfish worker manager with UCI readiness checks, serialized searches, one automatic worker restart, health checks, and clearer engine UI states.

## Skill Showcase Map
- **Data Engineering**: IndexedDB schema design, migrations, export/import pipeline, cloud backup schema, Supabase Storage policies, backup merge strategy.
- **Data Science / Analytics**: CP-loss analysis, move classification, accuracy estimate, puzzle solved-rate, weak motif detection, progression metrics, review scheduling.
- **AI / ML**: StyleVector, personalized Mirror opponent, personality-based move reranking, Stockfish evaluation, adaptive clue selection.
- **Frontend**: React, Vite, route architecture, state management, chessboard UI, responsive app shell.
- **UI/UX**: Onboarding, story mode, clue hints, progression dashboard, backup warnings, theme toggle, audio feedback.
- **Backend / Full Stack**: Supabase Auth, Supabase Storage, RLS policies, cloud backup service wrapper, account linking.
- **Forward Deployment**: Environment configuration, verification scripts, CI-ready commands, safe fallback when cloud env is missing.
- **GenAI-readiness**: MIRROR structures personalization and coaching-ready data for future integration. *(Note: Runtime GenAI conversational coaching is a future milestone, not currently implemented).*
- **Creativity**: Mahabharata/Kurukshetra theme, Story Acts I–III, Pandava/Kaurava visual identity, custom audio FX.

## Technical Architecture
- [System Architecture](docs/architecture-overview.md)
- [Data Architecture](docs/data-architecture.md)
- [AI & ML Methodology](docs/ai-ml-methodology.md)
- [Analytics & Progression](docs/analytics-and-progression.md)
- [Data / AI Engineering Showcase](docs/data-ai-showcase.md)
- [Mirror 2.0 Personality Opponent Report](docs/mirror-2-personality-opponent-report.md)
- [Local GenAI Coach Design](docs/local-genai-coach-design.md)
- [Coach Context Schema](docs/coach-context-schema.md)
- [Local Coach Safety Evaluation](docs/local-coach-safety-eval.md)
- [GenAI Prompt Contracts](docs/genai-prompt-contracts.md)
- [Agentic Coach Workflows](docs/agentic-coach-workflows.md)

## Data / AI Engineering Showcase
MIRROR includes a real local-first Python and SQL analytics layer that runs on exported backup JSON files. It does not require Supabase or any cloud service.

- **Python analytics package**: `python/src/mirror_analytics` loads exported MIRROR backups, validates schema shape, computes feature tables, and generates reports.
- **SQL marts**: `analytics/sql` models warehouse-ready player, puzzle, story, and analysis marts using portable SQL patterns.
- **Feature engineering**: player progress, puzzle motif weakness, review due counts, multi-move solve rates, CP-loss quality, accuracy, trend, and StyleVector-derived signals.
- **Behavioral analytics**: StyleVector is treated as MIRROR's behavioral personalization layer, with aggression, risk, time-pressure, tactical weakness, and positional preference features.
- **Local-first pipeline**: the CLI reads local JSON and writes CSV, Markdown, and JSON artifacts without cloud credentials.
- **Report generation**: `mirror-analytics` emits `player_summary.csv`, `puzzle_performance.csv`, `story_progress.csv`, `analysis_quality.csv`, `mirror_insights.md`, and `mirror_features.json`.
- **Local Coach Preview**: `/coach-preview` renders a deterministic rule-based coach from local IndexedDB summaries as a bridge toward future optional GenAI.
- **Deterministic coach cards**: the local coach generates prioritized weakness, review, analysis, story, progression, mirror, and data-quality cards with evidence and confidence.
- **Coach exports**: `/coach-preview` can export a local Markdown coach report and summarized JSON coach context without raw PGN, FEN, auth tokens, or API keys.
- **Safety evaluation**: deterministic local checks validate coach cards, prompt contexts, and exports for missing evidence, unsupported claims, privacy leaks, and obvious secret-like text.
- **GenAI / Agentic design docs**: coach architecture, context schema, prompt contracts, and future agent workflows are documented without claiming runtime LLM coaching.

Recruiter skill map:

- Data Engineering: schema-aware loaders, local ETL, warehouse-style SQL, repeatable CLI outputs.
- Data Science / Analytics: solved-rate metrics, weak motif detection, CP-loss aggregation, trend analysis, review prioritization.
- AI / ML Thinking: StyleVector feature extraction, deterministic recommendation cards, safety-checked prompt context, and model-ready JSON summaries.
- Forward Deployment: local-first operation, CI smoke tests, no cloud dependency.
- Software Engineering: modular Python package, pytest coverage, CI workflow, and integration without changing gameplay.

Honesty note: Stockfish is the chess engine. StyleVector is the behavioral personalization layer. Runtime GenAI conversational coaching is a future milestone unless implemented in a later release.

## Security and Privacy
MIRROR is private by default. All match histories, telemetry, and analytics remain entirely local in your browser's IndexedDB. Optional cloud backups are stored in a private Supabase bucket secured by strict Row Level Security (RLS) policies. No `SERVICE_ROLE` keys or secrets are stored in this repository.

## Tech Stack
- **Frontend**: React, TypeScript, Vite, Tailwind CSS, Zustand
- **Engine**: Stockfish 16.1 (WebAssembly)
- **Database**: IndexedDB (Local), Supabase Storage (Cloud)
- **Auth**: Supabase Magic Links

## Local Setup & Deployment
Please see the [Deployment Runbook](docs/deployment-runbook.md) for detailed setup, environment variables, and verification commands.

### Quick Start
```bash
git clone https://github.com/MANEESHREDDYD/Chess.git
cd Chess/Product
npm install
npm run dev
```

### Environment Variables
*(Optional - for Cloud Auth/Backups only)*
Copy `.env.example` to `.env`:
```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

### Verification Commands
```bash
npm run typecheck
npm run lint
npm test
npm run build
npx tsx scripts/validate-puzzles.ts
node scripts/run-mirror-verification.mjs
npm run stockfish:stability
node scripts/run-mirror-personality-verification.mjs
```

## Screenshots
*(Placeholder for future product screenshots)*

## Milestone Timeline
- `v1.0.0-mirror-verified`
- `v1.1.0-core-chess`
- `v1.3.0-human-mirror-loop`
- `v1.4.0-basic-analysis`
- `v1.5.0-clue-chess`
- `v1.6.0-mahabharata-visuals-1`
- `v1.7.0-story-shell`
- `v1.8.0-story-act-1`
- `v1.9.0-audio-fx-1`
- `v1.10.0-multi-move-puzzles`
- `v1.10.1-status-reconciliation`
- `v1.11.0-story-act-2-shell`
- `v1.12.0-player-progression-1`
- `v1.13.0-puzzle-spaced-repetition-1`
- `v1.14.0-story-act-3-shell`
- `v1.15.0-local-backup-export-1`
- `v1.16.0-account-sync-design-1`
- `v1.17.0-account-auth-local-bridge`
- `v1.18.0-cloud-backup-sync-1`
- `v1.18.1-portfolio-showcase-1`
- `v1.18.2-data-ai-showcase-layer`
- `v1.18.3-local-genai-coach-design-1`
- `v1.18.4-local-genai-coach-stub-2`
- `v1.18.5-local-genai-coach-safety-eval-1`
- `v1.18.6-stockfish-stability-hotfix-1`
- `v1.19.0-mirror-2-personality-opponent`

## Market-Grade Product Roadmap
- `M-PGN-IMPORT-PIPELINE-1`: import outside games locally and update StyleVector/analytics from real player history.
- `M-GAME-REVIEW-PRO-1`: Chess.com-level review with MIRROR-specific explanations and practice recommendations.
- `M-ADVANCED-ANALYTICS-DASHBOARD-1`: in-app analytics dashboards with every chart ending in a recommended action.
- `M-CLUE-CHESS-ADAPTIVE-2`: deeper clue levels, adaptive difficulty, review mode, streaks, and kid-friendly wording.
- Later phases sequence progression, invite multiplayer, random matchmaking, 3D Kurukshetra visuals, kids mode, E2EE backup, and release hardening.

Runtime GenAI adapter work, story implementation expansion, 3D visuals, multiplayer, and E2EE are deliberately sequenced after core reliability and product execution milestones. Runtime GenAI coaching is still not implemented.
