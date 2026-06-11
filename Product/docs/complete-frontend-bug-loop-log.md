# Complete Frontend Bug Loop — Run Log

Milestone: M-MIRROR-FULL-FRONTEND-3D-BATTLEFIELD-EXPECTATION-LOOP-1
Script: `scripts/run-complete-frontend-bug-loop.mjs` → `artifacts/complete-frontend-bug-loop/`

## Run 1 — 2026-06-11 ~10:30 (FAILED, 45 findings)

Screenshots checked: 168 route shots (12 routes × 2 themes × 7 viewports) + menus + 3D.

| Failure | Root cause | Fix |
| --- | --- | --- |
| `story * (11 viewports/themes): story leads with clue wording` | Hero copy literally said "…this is not the Clue Chess training page" — defensive dev-copy in the first 600 chars | Rewrote hero to campaign-first copy (Acts I–III briefing language) in `Story.tsx` |
| `calibration/mirror *: appearance toggle overlaps board` | Fixed bottom-right switch sat over board corners on tall boards (mirror 768×1024, calibration 900×768) | Board-aware dodge ladder in `AppShell` (bottom-right → bottom-left → top-right) + CSS `[data-dodge]` rules |
| `pageerror: No active player for calibration` (28×) | `/calibration` fired `resumeRun()` before the async player load resolved; rejection escaped unhandled | Gate the effect on `activePlayerId` and `.catch` the promise in `Calibration.tsx` |
| `nav focus ring invisible (both themes)` | Run-1 probe used programmatic `.focus()` (no `:focus-visible`) — AND a real bug found in run 2 | Probe switched to real Tab keys |

## Run 2 — 2026-06-11 ~11:55 (FAILED, 2 findings)

| Failure | Root cause | Fix |
| --- | --- | --- |
| `nav focus ring invisible (both themes)` | Real defect: my `.nova-nav__link.is-active { box-shadow: none }` (same specificity, later source order) swallowed the `:focus-visible` ring | Explicit `.nova-nav__link.is-active:focus-visible` ring rule in `mirrorAppleMono.css` |

(Calibration/story/toggle fixes from run 1 verified clean in this run.)

## Run 3 — 2026-06-11 ~12:05 (PASSED)

All assertions green: no cropped/undersized board, no escaped/duplicate pieces, no toggle-
over-board, no horizontal overflow, header ≤76px and never covers content, no native header
selects, no raw links/default buttons, no beige/gold shell, page identities verified
(Story=campaign, Clue=training, Analytics=action, Profile=XP, Review=timeline, Import=flow,
Coach=cards, Diagnostics=contained), More/Board-Theme/Audio/Appearance/2D-3D all work,
keyboard focus ring visible, reduced-motion 3D→2D fallback verified. Remaining issues: none.

## Related interaction findings (board stability check, same loop)

- The user-reported "floating piece while moving" defect could NOT be reproduced in the
  current build (animations and legal/illegal/opponent drags on a flipped Kurukshetra board
  all keep pieces centered). Root cause of historical screenshots: the old board-sizing
  feedback loop (boardWidth ≠ rendered width skewed animation transforms), already fixed by
  stable `.board-stage` measurement. Permanent regression coverage added to
  `run-board-interaction-stability-check.mjs` (flipped-board drag suite).
- `run-3d-battlefield-performance-check.mjs` caught a real policy violation on its first
  run: `global.css` still imported Google Fonts (external CDN) — removed.
- The first 3D integration attempt locked the canvas at 300px: `.play-board-wrap` was a
  single-cell grid with an implicit auto track (content-sized → cyclic percentages).
  Fixed with an explicit `minmax(0, 1fr)` track.

## Manual review answers (run 3 screenshots)

Play = premium cockpit with the board as hero: **yes**. Board large/centered/fully visible:
**yes**. Pieces readable, board bug-free in both themes/orientations: **yes**. 3D reads as a
(stylized, procedural) battlefield rather than a toy UI: **yes — documented placeholder, not
realistic**. Soldiers/cavalry/chariots/commanders readable: **yes**. Movement smooth (glide/
leap ≤250ms): **yes**. Captures non-gory (dust dissolve): **yes**. Story campaign-first:
**yes**. Clue training-first: **yes**. Analytics actionable: **yes**. Profile polished:
**yes**. Dark theme premium / light theme premium: **yes / yes**. Blue primary, gold rare:
**yes / yes**. Anything beige/gold-heavy: **no**. Long-session comfort: **yes**.
