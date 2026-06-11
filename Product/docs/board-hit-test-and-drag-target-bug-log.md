# Board Hit-Test & Drag-Target Bug Log

Milestone: M-REFERENCE-LOCKED-APPLE-MONO-UI-AND-BOARD-HITTEST-FIX-1 · 2026-06-11
Verifier: `scripts/run-reference-locked-ui-bug-loop.mjs` → `artifacts/reference-locked-ui-bug-loop/`

## Reproduction of the reported defect

**Report:** "the move/drop highlight appears away from the intended placement area."

**Reproduced in browser (run 1):** during every real mouse drag, the drop highlight stayed
parked on the SOURCE square while the pointer hovered the target:

| Route | Viewport | Theme | Orientation | From | Intended to | Highlighted | Dropped | Expected |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /play | 1366x768 | Classic light | White | e2 | e4 | **e2** | e4 | e4 |
| /play | 1366x768 | Classic light | White | f2 | f5 (illegal) | **f2** | snapback | snapback |
| /play | 1366x768 | Kurukshetra | White | g1 | f3 | **g1** | f3 | f3 |
| /play | 1366x768 | Kurukshetra | Black (flipped) | e7 | e5 | **e7** | e5 | e5 |
| /play | 1024x768 (after resize) | Classic | White | d2 | d4 | **d2** | d4 | d4 |
| /play | 1366x768 (after navigation) | Classic dark | White | c2 | c4 | **c2** | c4 | c4 |

Screenshot before: `play-light-during-drag.png` from run 1 (ring on source).
Screenshot after: same file from the passing run (ring on pointer square).

## Investigation answers (Phase 2 checklist)

- **Highlighted square ≠ pointer square?** YES — in every drag, on all themes/orientations.
- **boardWidth vs rendered width?** Not the cause anymore — the stable `.board-stage`
  measurement (previous milestone) keeps them equal; verified by geometric mapping checks.
- **CSS transform/zoom/scale/padding/border shifting coordinates?** No — mapping from the
  live a1..h8 union rect matches pointer squares exactly at every size tested.
- **Orientation reversed?** No — White and Black mappings both verified (corner + center
  round-trips in `boardGeometry.test.ts`, live drags in the loop).
- **Scroll offset error?** No — client coordinates vs getBoundingClientRect cancel by
  construction (unit-tested with scrolled rects).
- **Drag overlay coordinate space mismatch?** Not for position; the DROP lands correctly
  because react-chessboard recomputes from release coordinates.
- **Scaled container / stale boardWidth / custom pieces interfering?** No / no / no.
- **Both themes? Both orientations? After theme switch? After resize?** The HIGHLIGHT bug:
  yes everywhere (library-level). After fix: green everywhere.

## Root cause

`react-chessboard@4.7.3` renders its drop highlight from **react-dnd hover state**, which
(a) initializes on the source square and (b) does not re-render squares from updated
`customSquareStyles` while a drag is active. Under synthetic pointer input the hover state
never advances at all; under real input it can lag or stick. Net effect: the visual target
ring points away from the pointer even though the eventual drop (computed from release
coordinates) is correct. Historical screenshots also stacked the previous board-sizing
feedback loop on top (boardWidth ≠ rendered width skewed the *piece animation transforms*),
which produced the "piece placed/animating outside the board" frames — that root cause was
fixed in the previous milestone and is regression-guarded.

## Fix

1. **`src/chess/boardGeometry.ts`** — pure pointer→square mapping from the LIVE grid rect
   (a1..h8 union), orientation-aware, scroll-immune, wrapper-padding-immune; 8 unit tests.
2. **`BoardView.tsx`** — geometry-true drag tracking: capture-phase `pointerdown` on the
   stage (the library stops propagation in bubble phase), then `pointermove` + `dragover`
   listeners (HTML5 drag silences pointer events after a `pointercancel`, so `dragover`
   carries the coordinates), feeding a **self-rendered overlay ring** (`.board-drag-ring`,
   `data-qa="drag-ring"`) positioned from the same geometry — the library's
   `customDropSquareStyle` is neutralized to `{}` so its stale source ring can never paint.
3. **Lifecycle hardening** — FEN, theme, and orientation changes clear selection, pending
   promotion, last-move tint, and the drag target; `pointerup`/`dragend`/`drop` always end
   tracking; the ring is `pointer-events: none`.

## Verification (passing run)

`run-reference-locked-ui-bug-loop.mjs` asserts, mid-drag, that geometric pointer square ==
ring square == eventual landing square for: Classic/White, illegal snapback, Kurukshetra/
White (after runtime theme switch via the header popover), Kurukshetra/Black (flipped),
after resize (1366→1024), after route navigation, and dark Classic — plus click-move
accuracy (b1→c3), no promotion dialog without a final-rank pawn, and board integrity (no
escaped/stray/duplicate pieces) after every interaction. All green.
