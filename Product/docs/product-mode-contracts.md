# Product Mode Contracts

MIRROR must read as a product with distinct modes, not one chessboard wearing different labels.

## Regular Chess

Purpose: normal chess against the local engine or local pass-and-play patterns.

- Uses standard legal move validation.
- Uses Stockfish engine states and diagnostics.
- Does not show clue overlays.
- Does not show story mission UI.
- Can link to Game Review Pro after a completed match.

## Mirror Chess

Purpose: the personalized opponent that plays like the user.

- Uses StyleVector-based candidate reranking.
- Offers current, past, aggressive, cautious, blunder-prone, and improved self variants.
- Shows "Why Mirror moved" with local evidence.
- Stores local feedback such as felt-like-me, too-random, too-aggressive, and good-training.
- Links to post-match review.

## Clue Chess

Purpose: training-first tactical improvement.

- Uses clue levels 1-5.
- Supports adaptive, review, streak, boss, and kids modes.
- Uses puzzle attempts, puzzle reviews, Game Review motifs, StyleVector, and Analytics routes as local evidence.
- May repeat clues only in review mode or when variants are exhausted.
- Must say insufficient data when a personal weakness is not supported.

## Story Campaign

Purpose: campaign-first chess missions.

- Presents acts, chapters, missions, objectives, progress states, and rewards.
- Uses "Start Mission" and "Mission briefing" language.
- Can include chess battles and tactical encounters.
- Optional tactical support can exist inside a mission, but Story must not present as the Clue Chess training UI.
- Future work should implement richer campaign loops, victory screens, rewards, and boss encounters.

## Analytics

Purpose: local player intelligence and recommendations.

- Reads local IndexedDB records only.
- Shows metrics, trends, quality warnings, and next actions.
- Does not modify gameplay.
- Does not use runtime GenAI or cloud upload.

## Profile / Progression

Purpose: long-term player state and future battle profile.

- Displays XP, badges, story progress, streaks, and local player state.
- Future battle profile work can add honor score, capture ratio, Mirror mastery, puzzle league, and season-ready schema.
- It must wait until core chess rules, UI clarity, Story identity, and visual direction are stable.
