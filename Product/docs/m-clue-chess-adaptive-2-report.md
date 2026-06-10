# M-CLUE-CHESS-ADAPTIVE-2 Report

## Goal

Upgrade Clue Chess from a basic hint puzzle route into a local-first adaptive training system.

Product promise:

> MIRROR does not just give hints. It gives the right clue at the right difficulty for how you think.

## What Changed

The `/clue-chess` route now supports:

- Adaptive Training
- Review Mode
- Streak Mode
- Boss Puzzle Mode
- Kids Mode

All modes are deterministic and local-only. They do not call an LLM, upload puzzle data, require login, use platform OAuth, or depend on cloud inference.

## Clue Levels

Adaptive clues use five levels:

- **Level 1 - Theme clue**: identifies the tactical idea only.
- **Level 2 - Candidate area clue**: points to a board region or candidate piece.
- **Level 3 - Threat clue**: explains what the opponent is vulnerable to.
- **Level 4 - Calculation clue**: gives a forcing sequence idea without exact move.
- **Level 5 - Near-solution clue**: gives a strong constraint without exact SAN.

The final reveal is separate. It shows the local seed solution and explanation after explicit reveal or failed training.

## Evidence Inputs

The adaptive engine can use:

- StyleVector motif blindness
- clue attempt history
- spaced-repetition `puzzle_reviews`
- Game Review Pro `motif_tags`
- `/analytics` weak-motif deep links
- requested route query parameters such as `mode`, `motif`, and `review`

If evidence is missing, MIRROR uses a neutral clue sequence and displays an insufficient-data note. It does not invent a weakness.

## No-Repeat Clue Memory

The milestone adds a local `clue_memory` IndexedDB store.

It tracks:

- player id
- puzzle id
- clue level
- clue variant id
- shown timestamp
- attempt context
- mode

Adaptive, streak, boss, and kids modes avoid repeating the same clue variant for the same player/puzzle/level. Review Mode may repeat clues intentionally because recall repetition is part of spaced repetition.

## Modes

### Adaptive Training

Default mode. It selects a puzzle and starting clue level from local evidence. Repeated failures on a motif start easier; clean solves can start with lighter clues.

### Review Mode

Prioritizes due `puzzle_reviews`. It uses recall-style clues and allows repetition when reviewing.

### Streak Mode

Uses deterministic streak scoring. A solved puzzle increases streak; failed or revealed puzzles reset it.

### Boss Puzzle Mode

Builds a 3-5 puzzle sequence around the weakest or requested motif. It records boss sequence ids and clear status in clue attempts.

### Kids Mode

Uses simpler, shorter clue wording and gentler feedback. It avoids harsh failure language and does not expose complex analytics by default.

## Scoring

The scoring model is deterministic. It considers:

- solved or not solved
- highest clue level used
- attempts used
- final reveal usage
- due-review status
- streak count
- boss completion
- optional time spent

This is not a currency economy. It records training score, streak count, boss clear, and review success.

## Dashboard Integration

`/analytics` weak motif and due review actions now deep-link into Clue Chess:

```text
/clue-chess?mode=adaptive&motif=<weakest_motif>&review=true
```

Every action still cites local evidence or an insufficient-data reason.

## Game Review Pro Integration

Game Review Pro recommended actions now link directly to motif-specific Clue Chess training when a reviewed move has `motif_tags`.

The selected move panel also exposes “Train this motif in Clue Chess” when motif data exists.

## Backup And Analytics

The browser backup format now optionally includes `clue_memory`.

`clue_attempts` can include adaptive fields such as:

- clue level used
- clue variant ids seen
- attempts before solve
- solved without reveal
- used final reveal
- mode
- score delta
- streak count
- boss sequence id
- boss cleared
- recommendation source

The Python analytics package and SQL marts now model clue-effectiveness metrics:

- most used clue level
- solved-without-reveal rate
- final reveal rate
- review-mode success rate
- best clue streak
- boss completion count
- clue effectiveness by motif

## Privacy Boundaries

- No puzzle data is uploaded.
- No LLM calls are made.
- No platform OAuth is added.
- No raw private backup data is embedded in sample files.
- Clue memory stores summary-level shown clue metadata, not account tokens or secrets.

## Limitations

- Puzzle selection is deterministic and seed-puzzle based.
- Kids Mode changes wording but does not yet add visual mini-games.
- Boss Mode is a focused sequence, not a full progression economy.
- Advanced tactical weakness still depends on available local evidence.
- Runtime GenAI coaching remains a future optional feature and is not implemented.

## Verification

Added:

- `src/clue/adaptiveClueEngine.test.ts`
- `src/clue/clueMemory.test.ts`
- `src/routes/ClueChess.test.tsx`
- `scripts/run-clue-chess-adaptive-verification.mjs`

Verification covers route rendering, clue levels 1-5, no-repeat behavior, review mode priority, streak updates, boss sequence generation, kids wording, Analytics routing, backup support, and Python analytics alignment.
