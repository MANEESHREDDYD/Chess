# M-ACCOUNT-SYNC-DESIGN-1: Account Sync Design

## Goals
- Design a cloud sync architecture that preserves MIRROR's local-first offline capabilities.
- Define a structured approach to syncing progression without locking users out of their data.
- Ensure conflict resolution respects the highest player achievement without regression.
- Establish a cost-controlled strategy utilizing standard backend technologies (e.g., Supabase or Firebase).
- Provide a path forward for opt-in multiplayer and ranked matching in the future.
- Maintain total compatibility with the existing JSON local backup/export flow.

## Non-goals
- Do not implement any backend auth, Supabase, or Firebase SDKs right now.
- Do not alter the local-only, zero-dependency behavior of the current app.
- Do not add real-time multiplayer features or leaderboards at this stage.
- Do not introduce monetization logic.
- Do not require users to create an account to play MIRROR.

## Current Local Data Stores
MIRROR currently utilizes IndexedDB with the following object stores:
- `players`
- `local_matches`
- `mirror_matches`
- `calibration_runs`
- `style_vectors`
- `saved_analyses`
- `clue_attempts`
- `puzzle_reviews`
- `story_progress`
- `achievements`

Additionally, `localStorage` is used to persist:
- `mirror-settings` (UI preferences, dark mode, volume, etc.)

## Data Classification
| Store | Classification | Rationale |
| --- | --- | --- |
| `players` | **Must Sync** | Identity foundation. Essential for mapping data to an account. |
| `style_vectors` | **Must Sync** | Core to the MIRROR experience. Loss of the AI clone profile is catastrophic. |
| `story_progress` | **Must Sync** | Narrative progression is high-value player investment. |
| `achievements` | **Must Sync** | High-value milestone progression. |
| `puzzle_reviews` | **Must Sync** | Spaced repetition state degrades in value if lost or desynced across devices. |
| `mirror_matches` | **Should Sync** | Important for retaining the history of playing against one's own clone. |
| `calibration_runs` | **Optional Sync** | Can be re-run if needed, but nice to have for historical reference. |
| `local_matches` | **Optional Sync** | Heavy payload (PGNs), less critical than Mirror matches. |
| `saved_analyses` | **Optional Sync** | Heavy payload, but explicitly saved by user. |
| `clue_attempts` | **Local-Only/Optional** | Ephemeral, granular tracking of puzzle attempts. Bulk sync is costly and less critical than reviews. |
| `settings` | **Local-Only/Optional** | Preference sync is a nice-to-have, but device-specific settings are common. |

## Sync Candidates
- Core gameplay identity and progression logic (`players`, `style_vectors`, `story_progress`, `achievements`, `puzzle_reviews`).

## Data Not Safe to Sync By Default
- Massive PGN dumps from `local_matches` could exhaust free-tier storage bandwidth rapidly. Should be paginated or capped.
- High-frequency event logs (e.g., granular `clue_attempts`).
- Any future child/kids mode telemetry or chat logs.

## Account Model
Accounts must remain opt-in. 
- **Anonymous/Local-Only (Default)**: Players start as anonymous profiles tied to their browser's IndexedDB. 
- **Authenticated**: When a user connects an email/OAuth provider, the active local profile's `player_id` binds to the authenticated `user_id`.

## Sync Architecture Options
1. **Supabase (PostgreSQL + Auth + Realtime)**: Excellent for structured, relational data. Built-in auth and Row Level Security (RLS) policies fit perfectly for granular sync.
2. **Firebase (Firestore + Auth)**: Good offline-first SDK capabilities, but NoSQL structure makes querying complex relational chess history more difficult. Vendor lock-in is high.
3. **Custom Serverless API (AWS/Vercel + PlanetScale)**: Maximum control, but high implementation overhead for auth, offline-sync queuing, and conflict resolution.
4. **Local-only manual backup**: The current state. Safe, completely free, but lacks cross-device continuity.
5. **Encrypted User-owned storage (e.g., iCloud/Google Drive API)**: Great for privacy, high friction for setup, zero backend cost. Hard to run global matchmaking later.

## Recommended Architecture
**Supabase** is the recommended backend choice.
It provides a straightforward upgrade path: local SQLite/IndexedDB naturally maps to a structured PostgreSQL cloud database. Supabase Auth supports anonymous-to-authenticated linking, and its RLS policies provide robust privacy controls.

### Staged Rollout:
- **Phase A**: Local-only + JSON Backup (Current State).
- **Phase B**: Optional account identity (Supabase Auth integration, manual cloud backups).
- **Phase C**: Encrypted/Structured User Backup Sync (Auto-saving critical stores to the cloud).
- **Phase D**: Full Structured Cloud Sync (CRDT-style or timestamp-based bi-directional sync).
- **Phase E**: Multiplayer / Ranked.

## Conflict Resolution Strategy
Because MIRROR is offline-first, conflict resolution must favor the most progressed state.
- **Record IDs**: Use UUIDs generated on the client. Never rely on server auto-increment.
- **Updated At Handling**: Last-write-wins based on `updated_at` timestamps for mutable states.
- **Story Progress**: Never downgrade. If local is `complete` but cloud is `locked`, local wins.
- **Achievements**: Idempotent. Union of all unlocked achievements.
- **Puzzle Reviews**: Preserve the highest `solved_streak` and highest `ease` value to prevent punishing players for desyncs.
- **StyleVector Versioning**: Append-only event sourcing or merging the highest generation vector.
- **Multiple-device Edits**: Favor the device with the most recent `updated_at` for simple fields (e.g., `display_name`).

## Offline-first Behavior
- The app must read entirely from IndexedDB on startup.
- Network requests happen asynchronously in the background.
- Mutations apply to IndexedDB immediately, queue an event in a local "sync queue", and flush to Supabase when the network is available.

## Backup/Export Compatibility
- Cloud sync must not deprecate the `v1.15.0` manual JSON backup system. 
- A user can restore a JSON backup to a device. If that device is authenticated to the cloud, the newly imported JSON data will naturally enter the "sync queue" and merge gracefully upward to the cloud using the defined conflict resolution rules.

## Security and Privacy Considerations
- **No Public Leaderboard by Default**: Accounts default to private. 
- **Consent**: Gameplay history (PGNs) is considered private behavioral data. Uploading `local_matches` requires explicit consent.
- **RLS Policies**: Supabase PostgreSQL must use strict Row Level Security to ensure players can only `SELECT`, `INSERT`, or `UPDATE` rows matching `auth.uid() == player_auth_id`.

## Cost-control Plan
- To survive on a free tier (e.g., Supabase's 500MB DB / 2GB Bandwidth), sync must be heavily optimized.
- Do not sync every 1-move blunder from `clue_attempts`.
- Do not sync complete `local_matches` PGNS unless the user explicitly backs them up.
- Focus sync on the tiny footprint tables: `players`, `story_progress`, `achievements`, `puzzle_reviews`, and `style_vectors`.

## Migration Plan
1. Add Supabase JS client.
2. Implement Auth UI wrapper.
3. Upon login, map local `player_id` -> Cloud `user_id`.
4. Run a background bi-directional sync script (similar to the logic in `backupService.ts` merge operations) but targeting Supabase REST endpoints.

## Future Implementation Milestones
- **M-ACCOUNT-AUTH-LOCAL-BRIDGE**: Integrate Supabase Auth and handle local-to-cloud identity binding.
- **M-CLOUD-BACKUP-SYNC-1**: Upload the `exportMirrorBackup()` JSON payload to a private Supabase Storage bucket as a cheap, dirty cloud sync.
- **M-STRUCTURED-SYNC-1**: Move from bucket blobs to actual PostgreSQL rows with bi-directional syncing for `achievements` and `story_progress`.
- **M-SYNC-CONFLICT-TESTING**: Unit test the edge cases of device desyncs.
- **M-MULTIPLAYER-DESIGN**: Design the realtime lobby and websocket infrastructure.
