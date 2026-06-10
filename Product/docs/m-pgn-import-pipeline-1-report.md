# M-PGN-IMPORT-PIPELINE-1 Report

## Product Goal

MIRROR can now learn from user-provided outside games without requiring a platform account, OAuth, scraping, or cloud upload.

The promise is:

> Upload your games. MIRROR learns how you play, updates your StyleVector, and creates a personalized training path.

## What Was Added

- `/import-pgn` route for PGN paste/upload.
- Source selector for manual PGN, Chess.com PGN export, Lichess PGN export, or unknown PGN.
- Import preview before save.
- Per-game validation status for valid, invalid, and partial games.
- IndexedDB `imported_games` store.
- Backup export/import support for `imported_games`.
- StyleVector evidence update from valid user-attributed imported games.
- Optional local Stockfish analysis for up to 5 imported games at a time.
- Import report summarizing detected games, valid/invalid counts, sources, results, openings, StyleVector updates, insufficient data, and next action.
- Python analytics and SQL mart support for imported-game metrics.

## Local-First Boundaries

- No Chess.com OAuth.
- No Lichess OAuth.
- No scraping.
- No cloud import.
- No PGN upload.
- No login required.
- Imported PGN text stays in local IndexedDB unless the user explicitly exports a backup.

External platform labels mean only that the user selected the source of their provided PGN export. MIRROR does not claim where a PGN came from unless the user provides it.

## Validation Behavior

The parser supports:

- single-game PGN
- multi-game PGN
- headers
- comments
- basic NAGs
- result markers

Malformed games fail safely. One invalid game does not block valid games in the same import. Invalid games can be saved as data-quality records, but they do not update StyleVector and are not analyzed.

## StyleVector Update Behavior

Imported games update StyleVector conservatively:

- valid games only
- user-attributed moves only when the active player can be matched to PGN `White` or `Black`
- opening preferences as White/Black
- average move count
- capture tendency proxy
- queen movement proxy
- castling tendency proxy
- minor-piece preference proxy
- result trend summary

The importer does not infer time-pressure behavior without clock data. It does not infer tactical motif weakness without analysis data. Existing calibration StyleVector data is preserved and import evidence is merged with low, bounded weight.

## Analysis Behavior

Imported-game analysis uses the existing stable local Stockfish analysis path with `match_type = imported`.

The UI starts with a safe cap of 5 games and processes them sequentially. This avoids saturating the worker and preserves the Stockfish stability milestone.

## Analytics Integration

Python analytics now reads `imported_games` from exported backups and adds player-summary metrics:

- imported games count
- valid imported games
- source breakdown
- result summary
- imported-game analysis coverage

SQL now models an `imported_games` table and includes imported-game rollups in `marts_player_summary.sql`.

## Privacy And Safety

The app stores raw PGN locally because users need their imported games preserved and analyzable. Generated reports and Python analytics summarize imported-game data without requiring secrets, platform tokens, or private cloud credentials.

The sample backup uses anonymized fake names only and includes no emails, tokens, Supabase keys, private accounts, or real player data.

## Not Implemented Yet

- Chess.com OAuth import.
- Lichess OAuth import.
- URL scraping.
- Cloud import queue.
- Bulk engine analysis for large PGN libraries.
- Runtime GenAI coaching from imported games.

The next product milestone should build a stronger Game Review Pro experience using the now-stable engine, Mirror personality layer, and imported-game analysis path.

