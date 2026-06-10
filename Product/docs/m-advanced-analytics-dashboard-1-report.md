# M-ADVANCED-ANALYTICS-DASHBOARD-1 Report

## Goal

Build an in-app Advanced Analytics Dashboard that turns MIRROR's local data into clear, actionable player intelligence.

The dashboard supports the product promise:

> MIRROR shows exactly how you are improving, where you are weak, and what to practice next.

## Implementation

Route:

- `/analytics`
- Navigation label: `Analytics`

Core files:

- `src/analytics/dashboardTypes.ts`
- `src/analytics/dashboardService.ts`
- `src/analytics/dataQuality.ts`
- `src/analytics/recommendedActions.ts`
- `src/routes/AnalyticsDashboard.tsx`
- `scripts/run-analytics-dashboard-verification.mjs`

## Local-First Data Sources

The dashboard reads IndexedDB stores only:

- `players`
- `local_matches`
- `mirror_matches`
- `imported_games`
- `game_reviews`
- `saved_analyses`
- `clue_attempts`
- `puzzle_reviews`
- `story_progress`
- `achievements`
- `style_vectors`

It does not require login, platform OAuth, runtime GenAI, cloud sync, or filesystem access.

## Dashboard Sections

Implemented sections:

- Player intelligence summary
- Data quality findings
- Game Review Pro summary
- StyleVector profile
- Weak motif analytics
- Puzzle review queue
- Imported-game coverage
- Mirror performance
- Story/progression summary
- Recommended next actions

Every visual block ends with a recommended action or an explicit insufficient-data note.

## Game Review Pro Analytics

The review panel aggregates saved `game_reviews` into:

- reviewed games count
- reviewed imported games count
- average CP loss
- MIRROR internal accuracy estimate
- blunder count
- mistake count
- inaccuracy count
- best/excellent count
- most common move label
- weakest phase
- latest key moment
- CP-loss trend
- move-label distribution
- phase weakness bars

Accuracy is clearly treated as MIRROR's internal estimate, not a proprietary external formula.

## StyleVector Visualization

The dashboard renders lightweight CSS/SVG-free bars for:

- aggression/risk proxy
- exchange willingness
- time-pressure risk
- motif blindness average
- endgame strength

It also shows:

- evidence source: calibration, imported games, Mirror feedback, mixed, or insufficient data
- confidence
- detected Elo band
- opening preferences as White and Black
- preferred minor piece
- recommendation

The current StyleVector code remains 11 behavioral/profile fields plus `schema_version` metadata.

## Weak Motifs And Review Queue

Weak motif analytics combine:

- Clue Chess attempts
- puzzle review lapses
- due review motifs
- Game Review Pro motif tags on inaccurate/mistake/blunder moves
- StyleVector motif blindness

The review queue panel shows:

- due reviews
- overdue reviews
- upcoming reviews
- average interval
- queue preview
- recommendation to review due puzzles or seed the queue

## Imported-Game Coverage

The imported-game panel shows:

- imported games count
- valid imported games
- invalid/partial rows
- source breakdown
- reviewed imported games
- analyzed imported games
- analysis coverage
- last import date

The UI does not claim platform authenticity beyond the user's selected import source.

## Mirror Performance

The Mirror panel shows:

- completed Mirror match count
- personality modes played
- feedback tag counts
- felt-like-me count
- too-random count
- latest Mirror result
- latest mode
- next Mirror recommendation

If Mirror data is missing, the dashboard recommends playing Mirror current self after calibration or import.

## Recommended Actions

`recommendedActions.ts` generates prioritized actions:

- `review_game`
- `import_games`
- `analyze_imported_game`
- `play_mirror`
- `calibrate`
- `review_puzzles`
- `play_story`
- `open_game_review`
- `open_clue_chess`

Each action includes:

- title
- reason
- local evidence
- priority
- route
- category

Actions are evidence-backed, and insufficient-data actions say what data is missing.

## Export Behavior

The route exports:

- `mirror-analytics-dashboard-YYYY-MM-DD.md`
- `mirror-analytics-snapshot-YYYY-MM-DD.json`

Exports are summary-first and exclude:

- raw PGN
- raw FEN
- raw backup JSON
- auth tokens
- service-role keys
- account-link records

## Privacy And Safety

The dashboard is local-first:

- no data upload
- no platform OAuth
- no runtime GenAI
- no cloud inference
- no raw private data in dashboard exports

The dashboard can become future GenAI context only after explicit consent and redaction. Runtime GenAI coaching is not implemented in this milestone.

## Competitor Positioning

The dashboard is inspired by the need for player insight found in modern chess products, but MIRROR's differentiation is StyleVector-personalized action guidance:

- Review results connect to playing style.
- Imported games improve personalization.
- Weak motifs link to Clue Chess.
- Mirror feedback becomes product analytics.
- Every chart answers "what should I practice next?"

## Verification

Added:

- `src/analytics/dashboardService.test.ts`
- `src/routes/AnalyticsDashboard.test.tsx`
- `scripts/run-analytics-dashboard-verification.mjs`

The verification script checks:

1. `/analytics` route renders.
2. Empty-data dashboard does not crash.
3. Full fixture snapshot generates summary cards.
4. Recommended actions are produced with evidence.
5. Markdown and JSON exports are generated.
6. Exports do not contain obvious secret/token patterns or raw chess records.
7. The script exits non-zero on failure.

## Remaining Risks

- The dashboard uses deterministic local proxies and should not be presented as trained ML.
- Charts are lightweight CSS bars to avoid dependency weight; richer charts can come later.
- Analytics quality depends on local data coverage. The data-quality layer intentionally surfaces missing data instead of inventing stats.
