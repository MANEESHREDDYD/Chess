# Coach Context Schema

`MirrorCoachContext` is the future local coach context object. It is designed to be generated from local MIRROR data and analytics artifacts before any optional GenAI layer is considered.

## MirrorCoachContext

```ts
interface MirrorCoachContext {
  player_profile_summary: PlayerProfileSummary;
  style_vector_summary: StyleVectorSummary;
  recent_performance_summary: RecentPerformanceSummary;
  puzzle_weakness_summary: PuzzleWeaknessSummary;
  analysis_quality_summary: AnalysisQualitySummary;
  spaced_repetition_summary: SpacedRepetitionSummary;
  story_progress_summary: StoryProgressSummary;
  recommended_next_actions: string[];
  privacy_flags: CoachPrivacyFlags;
  generated_at: string;
  source_files: string[];
}
```

## Field Definitions

### player_profile_summary

Safe summary of the active local player:

- player id
- display name
- calibration status
- detected Elo band if available
- game counts
- Mirror match count
- analysis count
- achievement count
- level

Safe to send to an LLM only after user consent and only as summary data.

### style_vector_summary

Summarized StyleVector behavior:

- opening preferences
- average move time
- time-pressure blunder rate
- exchange willingness
- preferred minor piece
- motif blindness
- endgame strength
- swindle preference
- detected Elo
- Elo band

The current TypeScript `StyleVector` has 11 behavioral/profile fields plus `schema_version` metadata. It is not a 12-dimensional behavioral vector.

Safe to send after consent as summarized features. The full raw StyleVector record remains local-private by default.

### recent_performance_summary

Aggregated progress data:

- total games
- Mirror matches
- analyses completed
- clue attempts
- clue solve rate
- multi-move solve rate
- current streak
- best streak

Safe to send after consent because it is aggregate data.

### puzzle_weakness_summary

Motif-level performance:

- weakest motif
- strongest motif
- attempts
- solved count
- failed count
- solved rate
- review lapses
- due review count

Safe to send after consent. Raw puzzle FEN, exact attempted moves, and full solution lines remain local-private by default.

### analysis_quality_summary

Post-game quality metrics:

- analyses completed
- average CP loss
- accuracy estimate
- blunder count
- mistake count
- trend

Safe to send after consent as aggregate data. Raw PGN, FEN before/after, and move-by-move engine lines remain local-private by default.

### spaced_repetition_summary

Review queue status:

- total reviews
- due review count
- due motifs
- lapse count

Safe to send after consent as aggregate scheduling data.

### story_progress_summary

Narrative progress:

- completed chapters
- total chapters
- current story chapter
- next story recommendation

Safe to send after consent. Future story mentor prompts must be respectful with Mahabharata-inspired material and must not parody sacred content.

### recommended_next_actions

Deterministic action strings from local rules. These are safe to show locally and safe to send after consent.

### privacy_flags

Machine-readable privacy posture:

- `local_only`
- `contains_raw_pgn`
- `contains_raw_fen`
- `uploads_private_data`
- `safe_to_send_to_llm`
- `local_private_by_default`

These flags should gate any future GenAI adapter.

### generated_at

ISO timestamp for context freshness. Safe metadata.

### source_files

Names of local stores or analytics artifacts used. Safe metadata if it does not include absolute local file paths.

## Safe To Send To An LLM After Consent

- player profile summary
- StyleVector summary
- aggregate performance metrics
- motif-level weakness rows
- review queue counts
- story progress summary
- recommended next actions
- source artifact names

## Local/Private By Default

- raw PGN
- raw FEN
- full move history
- engine principal variations
- backup JSON files
- account links
- email addresses
- cloud user IDs
- local file paths
- tokens or environment variables

The first runtime GenAI milestone should enforce this split in tests before any optional adapter is enabled.
