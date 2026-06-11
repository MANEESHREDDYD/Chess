# Page-by-Page FINAL Frontend Expectation

Milestone: M-REFERENCE-LOCKED-APPLE-MONO-UI-AND-BOARD-HITTEST-FIX-1
Supersedes ambiguity in earlier contracts; `page-by-page-frontend-contract.md` holds the
detailed state/layout matrix. Shell baseline everywhere: Apple Mono black/white/graphite,
blue-only primary actions, 64px command bar, single icon-only appearance switch
bottom-right (board-aware dodge), no beige/parchment/brown/heavy-gold/maroon shell tones.

- **PLAY** — the board is the hero: 560–640px on desktop (≥560 at 1366×768, full board
  above the fold), centered, never cropped; the drop-target ring ALWAYS sits under the
  pointer and the piece lands exactly there; engine status compact and actionable (Retry +
  Diagnostics); match controls clean; history/review in side rails (≥1200px) or below;
  no giant blank space.
- **MIRROR** — board + personality selector, "why Mirror moved" explanation panel,
  confidence/evidence chips; clean AI-lab feeling.
- **STORY** — campaign map: Acts, mission cards, next mission highlighted,
  locked/current/completed states; tiny bronze accent only; never reads like Clue.
- **CLUE** — training studio: mode cards, clue-level rail, board when active, blue CTAs;
  no beige cards.
- **ANALYTICS** — top insights first, one recommended action, clean metric cards, no text
  walls.
- **PROFILE** — level, XP, streak, achievements, next action, backup card.
- **REVIEW** — board replay, timeline, CP-loss, key moments, retry.
- **IMPORT** — three-step paste → validate → save flow.
- **COACH** — evidence cards with confidence and exports.
- **DIAGNOSTICS** — clean technical console, contained output.

Light mode must read as the Apple website (white, soft gray, crisp black text, glass
cards, minimal blue). Dark mode must read as Apple/NVIDIA graphite (black, silver text,
restrained blue). Enforced by `run-reference-locked-ui-bug-loop.mjs` +
`run-complete-frontend-bug-loop.mjs`; warm tones may exist ONLY inside board squares and
the 3D scene.
