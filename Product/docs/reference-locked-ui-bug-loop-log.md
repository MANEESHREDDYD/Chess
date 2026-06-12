# Reference-Locked UI Bug Loop Log

Milestone: M-REFERENCE-LOCKED-APPLE-MONO-UI-AND-BOARD-HITTEST-FIX-1
Script: `scripts/run-reference-locked-ui-bug-loop.mjs`
Artifacts: `artifacts/reference-locked-ui-bug-loop/`

## Run 1 - 2026-06-11 - Failed

Bug found: drag/drop target highlight could appear on the source or lagging square while the pointer was over the intended target.

Root cause: `react-chessboard` visual drop-square state was not reliable during the HTML5 drag lifecycle. The drop itself could still be correct, so the visible ring and actual target diverged.

Fix: added `src/chess/boardGeometry.ts`, rendered a BoardView-owned `.board-drag-ring`, cleared transient drag state on FEN/theme/orientation changes, and neutralized the library drop-square style.

Rerun result: continued hardening required because the first verifier did not catch every artifact issue.

## Run 2 - 2026-06-11 - Failed

Bug found: the verification script overwrote Story/Clue/Analytics screenshots under `play-*` names, so the artifact contract was not trustworthy.

Root cause: route name extraction removed the entire route after the leading slash.

Fix: added explicit route screenshot naming and required route captures for Play, Story, Clue, Analytics, and Profile in light/dark desktop/mobile states.

Rerun result: passed after script correction.

## Run 3 - 2026-06-11 - Failed Human Review

Bug found: the Apple mono shell still had a beige/warm cast in light mode and warm brown tone in dark Play cards.

Root cause: legacy shell pseudo-element and warm battlefield surface tokens were still visible underneath the late mono layer.

Fix: added the Apple Mono hard lock in `src/styles/mirrorAppleMono.css`: flat light/dark body backgrounds, no warm shell pseudo-element, neutral Play/Analytics/Clue/Profile cards, blue primary actions, and stricter browser checks for warm shell gradients/tokens.

Rerun result: passed browser loop.

## Run 4 - 2026-06-11 - Failed Human Review

Bug found: Story no-profile state was a large empty page, not the required campaign map and mission-card screen.

Root cause: the route returned a minimal empty CTA when no local profile existed.

Fix: rebuilt the no-profile Story state as a campaign preview with RouteHero, mission cards, locked/current states, progress rail, and Create Profile action.

Rerun result: passed browser loop.

## Run 5 - 2026-06-11 - Passed

Command: `node scripts/run-reference-locked-ui-bug-loop.mjs`

Result: passed.

Covered:

- Board pointer mapping.
- Drag target highlight.
- Actual dropped square.
- Click-move target.
- Illegal move snapback.
- Pawn legal move.
- Knight legal move.
- Promotion blocked unless legal final-rank pawn reaches promotion.
- Classic theme.
- Kurukshetra theme.
- White orientation.
- Black orientation.
- After resize.
- After theme switch.
- After route navigation.
- Apple mono light screenshots.
- Apple mono dark screenshots.
- More menu.
- Board Theme menu.
- Appearance toggle.
- No native select in header.
- No horizontal overflow.
- No beige/gold/brown shell tokens in checked shell surfaces.

Key screenshots:

- `play-light-before-move.png`
- `play-light-during-drag.png`
- `play-light-after-legal-move.png`
- `play-dark-before-move.png`
- `play-dark-during-drag.png`
- `play-dark-after-legal-move.png`
- `wrong-target-regression-proof.png`
- `play-classic-board.png`
- `play-kurukshetra-board.png`
- `menu-more-open.png`
- `menu-board-theme-open.png`
- `appearance-toggle.png`
- `mobile-play.png`
- `story-light-1366x768.png`
- `clue-light-1366x768.png`
- `analytics-light-1366x768.png`
- `profile-light-1366x768.png`

## Run 6 - 2026-06-12 - Failed user report, then Passed

Bug found (user screenshot): while dragging, the coin's visual rendered far from the
cursor (ring on the correct pointer square, piece preview squares away).

Root cause: the framer-motion route transition animated `transform`, making the route
wrapper a containing block for the board's `position: fixed` drag preview — with page
scroll, the preview offsets by the scroll distance.

Fix: opacity-only route transitions in `src/App.tsx`.

New guards: every drag scenario now asserts the dragged preview stays within 90px of the
cursor, plus a dedicated scrolled Kurukshetra drag scenario (1280x620, scrollTo 160,
g2-g4) with screenshot `play-scrolled-during-drag.png`.

Rerun result: passed (`node scripts/run-reference-locked-ui-bug-loop.mjs`, 2026-06-12).

## Manual Review Answers

- Does the frontend now look Apple-style black/white/graphite? Yes, except the documented tiny Story/Kurukshetra accent lane.
- Is the board large and premium? Yes at 1366x768 and mobile.
- Is the move target correct? Yes.
- Does the highlighted square match pointer position? Yes.
- Does the piece land exactly where expected? Yes.
- Does the drag feel stable? Yes.
- Is light theme truly Apple-like? Yes.
- Is dark theme truly graphite premium? Yes.
- Is blue the main action color? Yes.
- Is gold rare? Yes.
- Is anything still beige/gold-heavy? No in the product shell.
- Does any page still feel like a prototype? Story no-profile was corrected; remaining 3D asset realism waits for references.
- Would the user trust this app? The loop supports yes for UI and board interaction; final acceptance remains with the user.
