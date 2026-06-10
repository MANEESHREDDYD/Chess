# M-GAME-REVIEW-PRO-1 Report

## Goal

Build a stronger local post-game and imported-game review loop that turns games into improvement actions. Game Review Pro is designed to approach premium review workflows while staying honest about what MIRROR implements today.

## What Was Added

- `game_reviews` IndexedDB store for first-class Game Review Pro records
- `/review/:sourceType/:sourceId` route for local match, Mirror match, and valid imported-game review
- deterministic move classification from side-normalized CP loss
- MIRROR internal accuracy estimates by side
- key moment detection
- phase summaries for opening, middlegame, and endgame
- StyleVector-personalized notes when local evidence exists
- retry mistake comparison against the reviewed best move
- Markdown review export
- imported-game review links from the PGN import page
- local/Mirror match review links from completed game surfaces
- Python and SQL analytics support for `game_reviews`
- `scripts/run-game-review-pro-verification.mjs`

## Local-First Review Engine

The review service reconstructs the PGN move by move, evaluates positions sequentially through the stable local Stockfish manager, and stores the resulting review locally.

Supported sources:

- `local_match`
- `mirror_match`
- `imported_game`

Imported-game rules:

- only valid imported games can be reviewed
- invalid imported games are rejected before analysis
- no platform authenticity is claimed beyond the user-selected PGN source
- unknown user color is handled neutrally
- PGNs are not uploaded anywhere

## Move Classification

Stockfish supplies candidate moves and evaluations. MIRROR calculates CP loss from the mover's perspective and applies transparent thresholds:

- `best`: 0-10 CP loss
- `excellent`: 11-25 CP loss
- `good`: 26-60 CP loss
- `inaccuracy`: 61-120 CP loss
- `mistake`: 121-250 CP loss
- `blunder`: more than 250 CP loss
- `missed_win`: a large winning opportunity was available and the played move gave most of it back

`brilliant` exists in the type system for future use but is not assigned by the current deterministic classifier.

## Accuracy And CP-Loss

Accuracy is MIRROR's internal estimate based on average CP loss:

```text
accuracy = clamp(100 - average_cp_loss * 0.45, 0, 100)
```

This is not a clone of Chess.com or any proprietary formula.

## Key Moments

The key moment detector finds:

- largest CP-loss move
- first major blunder
- missed win
- swing move
- repeated mistake pattern
- critical endgame mistake

Each key moment includes evidence and a retry suggestion.

## Personalized StyleVector Notes

MIRROR uses StyleVector, clue weakness, and available local evidence to attach cautious notes such as:

- exchange-willingness tendencies
- motif evidence around pins/forks/skewers/removing the defender
- endgame-strength signals
- time-pressure risk only when supported by StyleVector, while explicitly noting when no clock data exists

If local evidence is missing, the review says insufficient data. It does not invent psychological traits, platform history, or unsupported statistics.

## Retry Mistake Mode

The retry flow starts from the reviewed `fen_before`. The user tries a move, and MIRROR compares it to the reviewed best move or line:

- `correct`
- `close`
- `still_risky`
- `invalid`
- `unavailable`

This does not modify the original game.

## Analytics Integration

Backup exports now include `game_reviews`. The Python analytics package parses review records and adds:

- reviewed games count
- review average CP loss
- review blunder count
- review mistake count
- review phase weakness summary
- most common review classification

The SQL schema includes `game_reviews` and `game_review_moves`, and the analysis/player marts include review metrics.

## Boundaries

- No runtime GenAI
- No OpenAI, Anthropic, Gemini, LangChain, or LlamaIndex SDKs
- No multiplayer
- No 3D visuals
- No platform OAuth
- No PGN upload
- No cloud inference
- No claims of proprietary platform parity

Game Review Pro is a local deterministic review system powered by Stockfish evidence and StyleVector personalization.
