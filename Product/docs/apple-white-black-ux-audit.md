# M-APPLE-WHITE-BLACK-MINIMAL-UX-1 — Forensic Screenshot & Code Audit

Date: 2026-06-10
Scope: latest `/play` screenshots (`artifacts/world-class-color-ux/play-{dark,light}-1366x768.png`) plus a
live Puppeteer probe of the running app at 1366×768 (`scratch/probe-play-layout.mjs`).

## 0. Live probe — measured ground truth (1366×768, dark)

| Element | Measured | Expected |
| --- | --- | --- |
| `.nova-header` | 85px tall | ≤ 64px |
| `.ui-route-hero` (Command Match) | 395px tall | compact (~80px) on /play |
| `.play-board-wrap` grid column | 480px wide | board must fit inside |
| `.board-shell` / `.board-frame` | **680px wide**, x 462→1142 | ≤ 480px (column width) |
| `.play-side-panel` | starts at x 939 | board overlaps it by ~203px |
| board bottom edge | y 1254 | viewport is 768px tall |
| square size | 85px | ~56px for a 450px board |
| `.nova-appearance` toggle | 177×46 fixed at (1173, 706) | must not cover gameplay |
| `body` scrollHeight | 1433px | board should be above the fold |

Every defect in the user screenshot is reproduced by these numbers.

## 1. Why the board is cropped / hidden under the top shell

The board's top edge starts at y=562 because the `/play` route renders a full-size
`RouteHero` ("Command Match", 395px tall, `clamp(38px, 5.4vw, 76px)` title) above the board.
With an 85px sticky header + 395px hero + paddings, only ~200px of viewport remains for a
692px board → the board lives below the fold and the page scrolls 1433px. On the user's
screenshot the visible crop "under the top shell" is this: the viewport shows the hero and the
*top slice* of the oversized board.

**Fix:** `/play` gets a compact route context bar (~64px) instead of the hero, and the board is
sized against viewport height (see §2) so the full board fits above the fold at 1366×768.

## 2. Why the board overflows / pieces look oversized — the root cause

`BoardView.tsx` sizes `react-chessboard` from **its own frame**:

```tsx
const width = Math.floor(frame.clientWidth);          // frame = .board-frame
if (width > 0) setBoardWidth(Math.min(680, width));   // feeds boardWidth back into content
```

`.board-frame`'s width is *not* fixed by CSS — it is a grid/flex item whose width depends on
its **content** (the chessboard is rendered at a fixed pixel `boardWidth`). Grid items default
to `min-width: auto`, so when the chessboard renders at N px, the frame's min-content width
becomes N px, the frame reports `clientWidth ≥ N`, and the ResizeObserver writes an even
bigger `boardWidth`. This **self-inflating feedback loop** ratchets the board up to the
`MAX_BOARD_WIDTH = 680` cap regardless of the 480px grid column:

```
boardWidth 520 → frame stretches to 532 → measure 532 → boardWidth 532 → … → 680 (cap)
```

Measured terminal state: chessboard inner = 666px, frame = 680px (666 + 12px padding + 2px
border) inside a 480px column. The squares are 85px, so the *pieces* are 85px — almost twice
the size the column can host. They are not "too big for their squares"; the **whole board is
too big for the screen**, which reads as "oversized pieces" and spills under the Review Tools
panel (x 939).

Contributing CSS:

- `designSystem.css:2228 .play-board-card { position: sticky; top: 92px; overflow: visible; }`
  — sticky + visible overflow lets the runaway board paint over the neighbouring column.
- `designSystem.css:3403 .play-board-card .board-frame { max-width: none; }` — removes the
  one guard (`.board-frame { max-width: 100% }` at line 853) that could have clamped the loop.
- `--board-max-desktop: min(680px, 68vh)` exists but is applied to the *card*, while the
  measurement loop reads the *frame*, so the height term never reaches the chessboard.

**Fix (structural):** the chessboard must be measured from a **content-independent** element.
New `board-stage` element whose width is fully CSS-determined
(`width: min(100%, 68vh - chrome, 680px)`, `aspect-ratio: 1/1`, never stretched by content),
and `BoardView` reads *that* element's width. Parents get `min-width: 0`; the sticky board
card is removed. Board sizing rules land in `mirrorMonoSignal.css`:
desktop `min(68vh, 680px)`, laptop `min(64vh, 620px)`, mobile `min(92vw, 520px)`.

## 3. Why page scrolling is broken (internal scrollbar / scroll conflict)

Three stacked causes:

1. The oversized board (692px) + 395px hero + 738px layout makes the page 1433px tall, so the
   browser scrollbar appears even though /play should fit one viewport.
2. `.play-board-card { position: sticky; top: 92px }` pins the *oversized* card while the rest
   scrolls — visually this reads as an inner scroll conflict inside the product area.
3. `.play-move-list { max-height: 230px; overflow: auto }` plus `.ui-table-card__scroller`
   add genuine inner scrollbars right next to the sticky board.

**Fix:** board fits the viewport (no page scroll needed to see it), sticky removed; history
stays contained in its own card (allowed, but no longer competes with a pinned board).

## 4. Why the bottom appearance toggle overlaps gameplay

`.nova-appearance` is `position: fixed; right: 16px; bottom: 16px` and 177×46 px with labels
("Dark", "Light"). At 1366×768 it sits at x 1173–1350 — directly over the Review-tools /
match-history column (and on 1024–1280px widths, over the board edge itself). It also uses a
blue "active" fill that fights the board for attention.

**Fix:** compact icon-pair toggle (≤92px wide), kept bottom-right on desktop but the /play
layout now reserves the bottom-right corner (main bottom padding ≥ 72px); QA asserts the
toggle rect never intersects the board rect at every tested viewport. Mobile keeps it above
the bottom nav. z-index stays below popovers/modals.

## 5. Why the header still feels heavy

- `--nova-header-h: 84px` (Apple target: 48–64px).
- Two-line brand block (MIRROR + "AI Chess Training" sub-line) reads as a hero, not a command bar.
- Center nav is a filled pill-rail (`.nova-nav` has its own border + surface = "pill soup").
- Right side stacks a status chip + three triggers with label+eyebrow stacks (two text rows).

**Fix:** 64px header; single-line brand; nav links become quiet text tabs with a blue active
state; right controls become compact 36px icon triggers; "Local-first" chip moves out of the
header (it is status noise, not a command).

## 6. Why board theme colors feel non-premium

- Classic board defaults in `BoardView.tsx` are **brown**: dark `#6f4c33`, light `#eadfc8`
  (chocolate/parchment), with a warm brown shadow `rgba(37, 27, 14, …)`.
- Square highlights are **gold**: last-move `rgba(210,166,76,…)`, selection ring
  `rgba(255,224,138,…)`, check ring crimson `rgba(139,38,53,…)` — the whole interaction layer
  is gold/red, which is why the board dominates emotionally.
- Kurukshetra manifest squares (`public/themes/mahabharata`) are saturated red-brown and the
  legacy `.theme-mahabharata` class still warms the app-shell rules.

**Fix:** Classic = clean tournament neutral (soft gray-cream `#ebecf0` / slate `#b6bfca`);
interaction layer goes functional (blue selection/last-move, red only for check); Kurukshetra
keeps a *restrained* sand/clay only inside the squares; the board theme never tints the shell.

## 7. Why the UI still feels prototype-like

- Legacy CSS generations are still live under the Nova shell: `tokens.css` (parchment
  `--bg: #f5f0e6`, serif `--font-body: Lora`), `global.css` (`.btn` beige buttons, serif body),
  `designSystem.css` body gradient line 206: `linear-gradient(…, #ebe4d4 46%, #e8dfcf 100%)`
  — a literal **beige page wash** that shows whenever a route paints before Nova's body rule.
- Cream-tinted surfaces everywhere: `rgba(255, 248, 232, …)` (warm ivory) is used in 20+ rules
  (chips, cards, meta tiles, mode tiles) instead of neutral white-alpha.
- `/play` hero uses `--surface-battlefield` (brown-tinted radial) + gold `ContextChip`s.
- Serif display font (`Cormorant Garamond`) still drives `.play-title`, review/import/analytics
  h1/h2 via `--font-display` from tokens.css.

**Fix:** new `mirrorMonoSignal.css` loaded LAST remaps every legacy token (`--bg`, `--paper`,
`--ink`, `--font-display`, `--surface-*`, `rgba(255,248,232)` rules) onto the Mono Signal
black/white/graphite system, so all four CSS generations resolve to one palette.

## 8. Which components must be replaced or rebuilt

| Component | Action |
| --- | --- |
| `BoardView.tsx` | rebuild sizing (stage-based measurement), neutral board colors, blue interaction layer |
| `Play.tsx` | replace giant `RouteHero` with compact context bar; board-first layout |
| `AppShell.tsx` / `AppHeader.tsx` | 64px command bar, compact triggers (CSS-level rebuild) |
| `AppearanceToggle.tsx` | compact icon pair, board-safe placement |
| `RouteHero` (CSS) | compact, monochrome; warm variant only as a thin Story accent |
| `tokens.css`/`global.css`/`designSystem.css` legacy rules | overridden by `mirrorMonoSignal.css` (no beige/gold/serif leakage) |

## 9. Affected routes

`/play` (board loop + hero), `/mirror`, `/clue-chess`, `/story`, `/review/:type/:id`
(all reuse `board-frame` sizing and warm surfaces), `/analytics`, `/progress`, `/import-pgn`,
`/coach-preview`, `/stockfish-diagnostics` (legacy serif/beige surfaces), plus the global
shell (header/footer/appearance toggle) on every route.

## 10. Root-cause summary (one line each)

1. **Board crop:** 395px hero + 85px header push a 692px board below a 768px fold.
2. **Board overflow / huge pieces:** BoardView measures its own content-driven frame → feedback loop ratchets to 680px in a 480px column.
3. **Scroll conflict:** sticky oversized board card + inner scrollers + 1433px page height.
4. **Toggle overlap:** 177px-wide fixed toggle parked over the history/board column.
5. **Heavy header:** 84px two-row brand + pill-rail nav + chip noise.
6. **Non-premium color:** brown/gold board defaults + gold interaction layer + beige body gradient + ivory-tinted surfaces under a half-migrated Nova skin.
