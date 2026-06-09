# M-ACCOUNT-SYNC-DESIGN-1 Report

## Date
June 9, 2026

## Summary
The M-ACCOUNT-SYNC-DESIGN-1 milestone focused purely on drafting the long-term technical architecture for transitioning MIRROR from a strict local-only engine to an opt-in cloud-synced platform. This design lays the groundwork for authenticated account identity, bi-directional sync mechanisms, and robust offline support, while rigorously preserving the local-first integrity of existing offline progressions. 

## Files Changed
- `docs/m-account-sync-design-1.md` (Created)
- `docs/current-status.md` (Updated)

## Design Decisions
- **Opt-In Identity**: Accounts will act as an optional layer that maps a local IndexedDB `player_id` to an authenticated user ID without breaking anonymous play.
- **Bi-Directional Merge**: Instead of "server-wins" overwrites, MIRROR sync will utilize intelligent merging (similar to the local backup system) using `updated_at`, preventing regressions of completed story chapters, merging idempotent achievement unlocks, and retaining the highest spaced repetition streaks.
- **Privacy First**: Sensitive data such as entire offline PGN match histories (`local_matches`) and granular puzzle analytics (`clue_attempts`) will remain local-only by default to respect privacy and mitigate cloud bandwidth limits.

## Recommended Sync Architecture
We recommend integrating **Supabase** via a staged rollout (Phases B through E). Supabase provides structured relational Postgres for complex chess queries, Row Level Security (RLS) to enforce data privacy, and a seamless `supabase-js` client architecture suitable for bridging local IndexedDB mutations with REST/Realtime cloud pushes. 

## Risks
- **Desyncs**: Accidental overwrite of local progress if a user logs into a new device with outdated cloud data. Handled by rigorous `updated_at` and streak-protection conflict resolvers.
- **Bandwidth Limits**: Syncing too frequently on the free-tier Supabase (2GB outbound bandwidth limit). Handled by aggressive culling of sync payloads (e.g., omitting raw match PGNs and only pushing small table states like `puzzle_reviews`).

## Why Cloud Was Not Implemented Yet
MIRROR's primary value relies on its custom local-first AI (Style Vector) and offline-capable narrative mode. Delaying cloud connectivity until the local progression system was bulletproof ensured we did not compromise the app's foundational performance. We chose to perfect local JSON backups before introducing vendor lock-in.

## Verification Results
All quality gates ran successfully across the entire codebase to ensure no local-first functionality was degraded:
- [x] Typecheck passed
- [x] ESLint passed
- [x] Vitest suite passed (141 tests)
- [x] Production Vite build succeeded
- [x] Clue/Puzzle Validation script passed
- [x] Mirror Engine E2E Verification passed (0.1 - 2.0 apprentice drop validation passed)

## Decision
M-ACCOUNT-SYNC-DESIGN-1 COMPLETE
