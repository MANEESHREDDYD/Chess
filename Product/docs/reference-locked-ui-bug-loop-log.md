# Reference-Locked UI Bug Loop — Run Log

Milestone: M-REFERENCE-LOCKED-APPLE-MONO-UI-AND-BOARD-HITTEST-FIX-1
Script: `scripts/run-reference-locked-ui-bug-loop.mjs` → `artifacts/reference-locked-ui-bug-loop/`

## Run 1 — 2026-06-11 (FAILED, 6 findings)

| Bug | Screenshot | Root cause | Fix |
| --- | --- | --- | --- |
| Drop highlight stuck on SOURCE square in all 6 drag scenarios (classic/white, illegal snapback, kurukshetra/white, kurukshetra/black flipped, post-resize, post-navigation) | `play-light-during-drag.png` (run 1) | react-chessboard's drop ring tracks react-dnd hover state, which initializes on the source square and doesn't follow the pointer | Geometry-true tracking in `BoardView` + neutralized `customDropSquareStyle` |

## Run 2 — 2026-06-11 (FAILED, 6 findings)

| Bug | Root cause | Fix |
| --- | --- | --- |
| No drop-target highlight rendered during any drag | Three stacked causes found by instrumentation: (1) the library stops propagation on piece pointerdown → bubbling stage listener never fired → **capture phase**; (2) HTML5 drag silences pointer events after `pointercancel` → track via **`dragover`** too (don't stop on pointercancel); (3) react-chessboard ignores `customSquareStyles` updates while dragging → render the ring as our **own overlay** (`.board-drag-ring`, positioned from the same geometry, `pointer-events:none`) | All three applied in `BoardView.tsx` |

## Run 3 — 2026-06-11 (PASSED)

- Mid-drag, for every scenario: geometric pointer square == ring square == landing square.
- Ring visually aligned with its square (rect tolerance < 4px).
- Click-move lands on the clicked square (b1→c3); illegal drag snaps back with intact
  board (no escaped/stray/duplicate pieces); no promotion dialog without final-rank pawn.
- Matrix covered: Classic + Kurukshetra, White + Black orientation, after runtime theme
  switch via header popover, after resize 1366→1024, after route navigation, dark theme.
- Apple Mono shell sweep over /play /story /clue-chess /analytics /progress × light/dark ×
  6 viewports: no warm shell tones, no raw links/buttons, no native header select, header
  ≤76px, no overflow, board ≥540px at desktop widths, appearance switch never on the board.
- Control states captured: More open, Board Theme open, appearance switch, mobile play,
  before/during/after-move in both themes, Classic and Kurukshetra boards.

## Manual review answers (run 3)

Apple-style black/white/graphite: **yes** (both themes). Board large and premium: **yes —
560px hero at 1366×768, fully above the fold**. Move target correct / highlight under
pointer / piece lands where expected: **yes, asserted mid-drag**. Drag stable: **yes**.
Light theme Apple-like / dark theme graphite premium: **yes / yes**. Blue main action:
**yes**. Gold rare: **yes**. Anything beige/gold-heavy: **no**. Any page prototype-like:
**no**. Would the user trust it: the loop + screenshots support yes; final judgement is
the user's.
