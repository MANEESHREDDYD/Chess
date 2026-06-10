# Data Architecture

MIRROR relies on a robust IndexedDB schema to handle complex relational data locally without a backend. This demonstrates standard data engineering practices applied to the client side.

## IndexedDB Store Map

| Store Name | Purpose | Key Fields |
|---|---|---|
| `players` | Stores user profiles. | `id`, `name`, `current_style_vector_id`, `created_at` |
| `local_matches` | Pass-and-play match history. | `id`, `player_id`, `pgn`, `result`, `created_at` |
| `mirror_matches` | Human vs Mirror match history. | `id`, `player_id`, `pgn`, `result`, `analysis_data` |
| `imported_games` | Local user-provided PGN imports, including valid and invalid rows. | `id`, `player_id`, `source`, `legal_status`, `analysis_status`, `stylevector_applied` |
| `calibration_runs` | Logs of StyleVector calculations. | `id`, `player_id`, `status`, `style_vector_id` |
| `style_vectors` | Behavioral personalization record with 11 profile fields plus schema metadata. | `id`, `player_id`, `vector`, `computed_at`, `source` |
| `saved_analyses` | Post-game CP-loss engine evaluations. | `id`, `match_id`, `move_evaluations`, `blunder_count` |
| `clue_attempts` | Puzzle resolution metrics. | `id`, `player_id`, `puzzle_id`, `success`, `time_taken_ms` |
| `puzzle_reviews` | Spaced repetition schedule queue. | `id`, `player_id`, `puzzle_id`, `next_review_at`, `interval` |
| `story_progress` | Narrative campaign state. | `id`, `player_id`, `chapter_id`, `completed`, `unlocked_at` |
| `achievements` | Player progression and badges. | `id`, `player_id`, `achievement_id`, `unlocked_at` |
| `account_links` | Maps local players to Supabase Auth IDs. | `id`, `player_id`, `cloud_user_id`, `provider` |

## Data Relationships
- **One-to-Many**: `players` -> `mirror_matches`, `imported_games`, `style_vectors`, `puzzle_reviews`.
- **One-to-One (Contextual)**: `mirror_matches` / `local_matches` / `imported_games` -> `saved_analyses`.
- All foreign keys enforce logical grouping on backup/export.

## Migration Version Timeline
We utilize an incremental versioning script for IndexedDB upgrades:
- `v1`: Initial setup (`players`, `local_matches`).
- `v2-v4`: StyleVector, Analysis, and Calibration tracking.
- `v5-v6`: Clue Engine tables (`clue_attempts`).
- `v7`: Story Progress and Achievements.
- `v8`: Spaced Repetition (`puzzle_reviews`) and Cloud Auth (`account_links`).
- `v9`: Local PGN imports (`imported_games`) with validation status, source, result, final FEN, analysis status, and StyleVector application flags.

## PGN Import Data Flow
- `/import-pgn` parses pasted or uploaded user-provided PGN text locally with `chess.js`.
- Each game is saved as a separate `imported_games` row, including malformed games marked `invalid` or `partial`.
- Invalid games do not update StyleVector and are not analyzed.
- Valid games can update StyleVector evidence only when user color can be attributed from the PGN headers.
- Optional imported-game analysis is capped and sequential, reusing the stable local Stockfish analysis path with `match_type = imported`.

## Cloud Backup & Merge Strategy
- **Inclusion**: All stores are serialized into a master JSON blob.
- **Behavior**: The blob is optionally encrypted and uploaded to Supabase Storage.
- **Merge/Conflict Rules**: When a backup is restored, the `importMirrorBackup` pipeline performs a cautious "upsert". Existing records are preserved. Matching IDs overwrite local records, but we do not arbitrarily delete local matches if they are missing from the backup.
- **Privacy Classification**: All match histories, mistakes, and vectors are classified as private. They never leave the browser unless explicitly uploaded via the backup feature.
