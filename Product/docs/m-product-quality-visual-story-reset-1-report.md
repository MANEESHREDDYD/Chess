# M-PRODUCT-QUALITY-VISUAL-STORY-RESET-1 Report

## Goal

Reset product-quality blockers before progression work: fix promotion legality, separate Story from Clue Chess, improve immediate board/UI polish, and document the future visual direction honestly.

## Reported Issues

1. A knight/horse move could show pawn promotion options.
2. Promotion options could appear on ranks where promotion was impossible.
3. Current visuals did not look like realistic Mahabharata-era soldiers.
4. Current board did not look like a real Kurukshetra battlefield.
5. Story felt too similar to Clue Chess.
6. UI felt basic, clumsy, and packed.
7. User wanted cleaner, more futuristic, immersive screens.

## Root Cause

`BoardView` delegated promotion detection to route-level callbacks. Clue Chess and Story passed `onPromotionCheck={() => true}`, so `react-chessboard` could open a promotion dialog for non-pawn or wrong-rank moves before the later move handler rejected the move. Play also moved immediately inside `onPromotionCheck`, which mixed modal detection with move execution.

## Fix

- Added shared chess.js-backed promotion validation.
- Promotion is allowed only for a legal pawn move reaching the final rank.
- `BoardView` now owns transient pending-promotion state and clears it on position changes, invalid checks, and drops.
- Promotion selection now uses the normal `onPieceDrop(from, to, promotion)` path.
- Clue Chess and Story cannot bypass promotion legality by returning `true`.

## Tests Added

- Non-pawn pieces never trigger promotion.
- White pawn promotes only on rank 8.
- Black pawn promotes only on rank 1.
- Wrong-rank pawn movement does not trigger promotion.
- Orientation-independent promotion legality.
- Stale pending promotion clears after position change.
- BoardView blocks route-level promotion bypasses.

## Story Reset

Story now presents:

- campaign header
- Act I, Act II, Act III campaign paths
- mission cards
- locked/available/completed states
- "Start Mission" language
- mission briefing
- optional tactical support inside missions

The underlying encounter engine remains intentionally limited for this milestone.

## Visual / UI Patch

- Added `designSystem.css` with shared panels, badges, buttons, mode cards, warnings, and board framing.
- Improved board frame contrast and piece containment.
- Added selected-square, legal-move, last-move, capture, and check highlights.
- Switched promotion dialog to modal variant with clearer styling.
- Updated Home to show distinct product mode cards.
- Updated navigation label from Progress to Profile.

## Visual Honesty

The app should describe current visuals as a Mahabharata/Kurukshetra-inspired placeholder theme. Realistic 3D battlefield visuals are not implemented in this milestone.

## Verification

`run-product-quality-visual-check.mjs` verifies core routes, Story campaign wording, promotion legality, board rendering, and no obvious pre-move engine-unavailable regression.

## Remaining Risks

- Current visual assets are still placeholders.
- Story still reuses puzzle mechanics internally.
- Full campaign reward/victory loops are future work.
- Realistic/stylized 3D battlefield work remains a separate milestone.
- Follow-up screenshot review showed that this milestone did not fully solve frontend production layout quality. The `/play` screen could still overlap board, controls, review actions, and history at normal desktop widths. `M-FRONTEND-PRODUCTION-REDESIGN-1` supersedes the visual layout portion with a shared app shell, rebuilt Play/Profile layouts, and screenshot/bounding-box QA.
