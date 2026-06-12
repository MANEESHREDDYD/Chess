# Board Hit-Test and Drag-Target Bug Log

Milestone: M-REFERENCE-LOCKED-APPLE-MONO-UI-AND-BOARD-HITTEST-FIX-1
Verifier: `scripts/run-reference-locked-ui-bug-loop.mjs`
Artifacts: `artifacts/reference-locked-ui-bug-loop/`

## Reported Defect

The latest user screenshot showed the move/drop highlight away from the intended placement area. That indicates a mismatch between at least one of: pointer-to-square mapping, board scale, drag hit-test, board orientation, CSS transform, stale `boardWidth`, or the drag overlay coordinate space.

## Reproduction Matrix

| Route | Viewport | Theme | Orientation | From | Intended to | Highlighted square before fix | Actual dropped square before fix | Expected square | After fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /play | 1366x768 | Classic light | White | e2 | e4 | source/lagging square | e4 | e4 | highlight e4, drop e4 |
| /play | 1366x768 | Classic light | White | f2 | f5 illegal | source/lagging square | snapback | snapback | no promotion, snapback |
| /play | 1366x768 | Kurukshetra | White | g1 | f3 | source/lagging square | f3 | f3 | highlight f3, drop f3 |
| /play | 1366x768 | Kurukshetra | Black | e7 | e5 | source/lagging square | e5 | e5 | highlight e5, drop e5 |
| /play | 1024x768 after resize | Classic | White | d2 | d4 | source/lagging square | d4 | d4 | highlight d4, drop d4 |
| /play | 1366x768 after route navigation | Classic | White | c2 | c4 | source/lagging square | c4 | c4 | highlight c4, drop c4 |

Before screenshot: the user-provided milestone screenshot documents the visible mismatch. A prior failed local screenshot was overwritten by the passing run and is not being represented as a retained artifact.

After screenshots:

- `artifacts/reference-locked-ui-bug-loop/play-light-during-drag.png`
- `artifacts/reference-locked-ui-bug-loop/wrong-target-regression-proof.png`
- `artifacts/reference-locked-ui-bug-loop/play-kurukshetra-during-drag.png`
- `artifacts/reference-locked-ui-bug-loop/play-dark-during-drag.png`

## Investigation Checklist

- Highlighted square different from pointer square: yes before fix, no after fix.
- `boardWidth` different from actual rendered width: not the active root cause after the previous sizing fix; current checks measure live square rects.
- CSS transform, zoom, scale, padding, or border shifting coordinates: not after this fix. The helper uses live `getBoundingClientRect()` on the actual rendered square grid.
- Orientation reversed incorrectly: no. White and Black orientation are unit-tested and browser-tested.
- Scroll offset included incorrectly: no. `clientX/clientY` and `getBoundingClientRect()` use the same viewport coordinate space.
- Drag overlay using viewport coordinates while board uses local coordinates: fixed. Viewport hit-test is converted to stage-relative overlay position from the same rect.
- Board inside a scaled container: guarded by live rect measurement.
- `react-chessboard` receiving stale `boardWidth`: guarded by the board-stage ResizeObserver and live rect tests.
- Custom pieces or drag previews interfering with pointer events: not after fix; custom piece images are `pointer-events: none`.
- Classic and Kurukshetra: tested.
- White and Black orientation: tested.
- After theme switch: tested.
- After resizing: tested.
- After route navigation: tested.

## Root Cause

`react-chessboard@4.7.3` can render a drag/drop highlight from its internal hover state while the pointer is moving through an HTML5 drag lifecycle. The hover state can initialize on the source square, lag behind the pointer, or fail to repaint custom square styles while dragging. The actual drop can still land correctly, which makes the visual bug especially confusing: the user sees a target ring in one place while the release coordinate maps to another square.

The fix avoids trusting that internal visual highlight. The app now renders its own geometry-true drag ring from live board square rects.

## Fix

- `src/chess/boardGeometry.ts` maps `clientX/clientY` to a chess square using the actual board rect.
- `src/chess/boardGeometry.test.ts` covers white/black corners, every square center, outside pointers, scaled boards, scroll offset, and padded wrapper cases.
- `src/components/Board/BoardView.tsx` measures the union of all live `[data-square]` rects, not a wrapper and not a stale width.
- `BoardView.tsx` listens in capture phase for piece pointerdown, tracks `pointermove` and `dragover`, renders `.board-drag-ring`, clears transient drag state on drop/cancel/FEN/theme/orientation changes, and neutralizes the library drop-square style.
- The bug loop verifies pointer square, visible ring square, and actual dropped square match.

## 2026-06-12 — Dragged piece rendered far from the cursor

**Report:** "while moving the coins it was showing very far from cursor" (Kurukshetra,
white orientation; ring correctly on the pointer square d7, but the dragged coin's visual
floated squares away).

**Root cause:** the framer-motion route-transition wrapper animated `transform`
(`y: 8 → 0`). A transformed ancestor becomes the CSS containing block for
`position: fixed` descendants — and the board library positions its dragged-piece preview
with fixed viewport coordinates. Inside the transformed route wrapper those coordinates
resolve relative to the wrapper instead of the viewport, so with any page scroll the
preview renders offset from the cursor by the scroll distance. The geometry ring (our own
overlay, stage-relative) stayed correct, which is why ring and coin disagreed.

**Fix:** route transitions are OPACITY-ONLY (`src/App.tsx`) — opacity creates a stacking
context but never a containing block, so `position: fixed` keeps meaning the viewport.

**Regression guard:** `run-reference-locked-ui-bug-loop.mjs` now (a) measures the dragged
preview's distance from the cursor mid-drag in every drag scenario (fails > 90px) and
(b) adds a dedicated SCROLLED Kurukshetra drag scenario (1280×620, `scrollTo(0,160)`,
g2→g4) that reproduces the exact reported conditions —
`artifacts/reference-locked-ui-bug-loop/play-scrolled-during-drag.png`.

## Current Result

The latest passing proof was generated by `node scripts/run-reference-locked-ui-bug-loop.mjs` on 2026-06-12 (includes the cursor-tracking preview assertions and the scrolled-drag scenario). Do not tag a future build if that script fails, if a manual screenshot shows the target ring away from the pointer square, or if the dragged coin does not track the cursor.
