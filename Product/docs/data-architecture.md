# Data Architecture

MIRROR relies on a robust IndexedDB schema to handle complex relational data locally without a backend. This demonstrates standard data engineering practices applied to the client side.

## IndexedDB Store Map

| Store Name | Purpose | Key Fields |
|---|---|---|
| `players` | Stores user profiles. | `id`, `name`, `current_style_vector_id`, `created_at` |
| `local_matches` | Pass-and-play match history. | `id`, `player_id`, `pgn`, `result`, `created_at` |
| `mirror_matches` | Human vs Mirror match history. | `id`, `player_id`, `pgn`, `result`, `analysis_data` |
| `calibration_runs` | Logs of StyleVector calculations. | `id`, `player_id`, `status`, `style_vector_id` |
| `style_vectors` | 12-dimensional vector profiling player style. | `id`, `player_id`, `aggression`, `complexity`, etc. |
| `saved_analyses` | Post-game CP-loss engine evaluations. | `id`, `match_id`, `move_evaluations`, `blunder_count` |
| `clue_attempts` | Puzzle resolution metrics. | `id`, `player_id`, `puzzle_id`, `success`, `time_taken_ms` |
| `puzzle_reviews` | Spaced repetition schedule queue. | `id`, `player_id`, `puzzle_id`, `next_review_at`, `interval` |
| `story_progress` | Narrative campaign state. | `id`, `player_id`, `chapter_id`, `completed`, `unlocked_at` |
| `achievements` | Player progression and badges. | `id`, `player_id`, `achievement_id`, `unlocked_at` |
| `account_links` | Maps local players to Supabase Auth IDs. | `id`, `player_id`, `cloud_user_id`, `provider` |

## Data Relationships
- **One-to-Many**: `players` -> `mirror_matches`, `style_vectors`, `puzzle_reviews`.
- **One-to-One (Contextual)**: `mirror_matches` -> `saved_analyses`.
- All foreign keys enforce logical grouping on backup/export.

## Migration Version Timeline
We utilize an incremental versioning script for IndexedDB upgrades:
- `v1`: Initial setup (`players`, `local_matches`).
- `v2-v4`: StyleVector, Analysis, and Calibration tracking.
- `v5-v6`: Clue Engine tables (`clue_attempts`).
- `v7`: Story Progress and Achievements.
- `v8`: Spaced Repetition (`puzzle_reviews`) and Cloud Auth (`account_links`).

## Cloud Backup & Merge Strategy
- **Inclusion**: All stores are serialized into a master JSON blob.
- **Behavior**: The blob is optionally encrypted and uploaded to Supabase Storage.
- **Merge/Conflict Rules**: When a backup is restored, the `importMirrorBackup` pipeline performs a cautious "upsert". Existing records are preserved. Matching IDs overwrite local records, but we do not arbitrarily delete local matches if they are missing from the backup.
- **Privacy Classification**: All match histories, mistakes, and vectors are classified as private. They never leave the browser unless explicitly uploaded via the backup feature.
