# M-MIRROR-FULL-FRONTEND-3D-BATTLEFIELD-EXPECTATION-LOOP-1 — Milestone Report

Date: 2026-06-11

## What this milestone did

1. **Captured the user's exact expectation** (`user-expected-product-vision.md`) and bound
   every page to a contract (`page-by-page-frontend-contract.md`).
2. **MIRROR Apple Mono** (`src/styles/mirrorAppleMono.css`, loaded last): the requested
   black/white/graphite system with blue primary / green success / amber warning / red
   danger / rare bronze story accent, system font stack, 44px blue buttons, one icon
   system. All four legacy CSS generations re-pointed at the `--mono-*` source — including
   the high-specificity shell-scoped Aura block. Beige/gold shell, parchment body wash,
   warm-ivory card tints, gold progress bars, serif UI chrome, and the Google-Fonts CDN
   import are gone (guarded by `src/test/monoSignal.test.tsx` + browser checks).
3. **Board bugs fixed at the root** and locked behind browser checks:
   - resize feedback loop (board measured its own content → 680px board in a 480px column,
     pieces "oversized"/cropped/animating off-board) → stable `.board-stage` measurement;
   - tablet collapse (my 3-col grid override silently beat the ≤1199px breakpoints) →
     desktop-scoped; `.play-board-wrap` implicit auto track (cyclic % → 300px 3D canvas) →
     explicit `minmax(0,1fr)`;
   - height-aware board sizing WITH a 480–500px floor (no tiny boards in short windows);
   - appearance switch → single icon-only bottom-right button showing the opposite theme,
     with a board-aware dodge ladder (never covers squares);
   - engine failure on /play is actionable (Retry engine + Open Diagnostics);
   - Kurukshetra board colors desaturated to sand/clay, scoped to squares only; classic
     board tournament-neutral; interaction layer functional blue/red;
   - `/calibration` no longer throws on hard refresh (player-gated resume);
   - Story hero rewritten campaign-first;
   - keyboard focus ring restored on active nav tabs.
4. **Kurukshetra Battlefield 3D mode** (`src/three/`, 12 modules): lazy-loaded
   three/@react-three/fiber scene with procedural low-poly armies (soldier/cavalry/advisor/
   chariot/commander/king), banners, rocks, trees, tents, elephant+horse props, drifting
   dust, dusk sky/fog, constrained orbit camera; FEN-diff instance reconciler animates
   moves (knight leap arc, heavy chariot glide, ≤250ms) and dissolves captures into dust
   (non-gory, 420ms); selected/legal/capture/last-move/check square highlights; click-to-
   move through `gameStore.makePlayerMove` (chess.js stays the only rules authority;
   promotion auto-queens in 3D — documented). 2D/3D toggle on /play; available on EVERY
   device; falls back to the stable 2D board on missing WebGL, reduced-motion, or load
   error. Zero binary assets; licensing manifest at `assets/3d/asset-manifest.json`;
   no external CDN (enforced).
   **Honesty:** this is a documented procedural placeholder. The user's reference bar
   (realistic archers, horse/camel/elephant archers, ornate chariots) requires licensed or
   commissioned rigged GLB models — the pipeline is ready for them.
5. **Bug-find loop + gates:** `run-complete-frontend-bug-loop.mjs` (12 routes × 2 themes ×
   7 viewports + all controls + reduced-motion; 3 runs to green — see
   `complete-frontend-bug-loop-log.md`), `run-board-interaction-stability-check.mjs`
   (click/drag/bounds/duplicates/engine settle + flipped-Kurukshetra drag regression suite
   + 3D pipeline), `run-3d-battlefield-performance-check.mjs` (load, moves, route switches,
   mobile, both fallbacks, CDN policy). Acceptance:
   `final-frontend-screenshot-acceptance.md`; scores: `final-frontend-3d-scorecard.md`.

## Defect ledger (user-reported → resolution)

| Report | Resolution |
| --- | --- |
| Board cropped/hidden under shell; huge hero | Compact context bar; height-aware floor sizing; verified at 1366×768 |
| Pieces oversized / board overflowing panels | Resize-feedback loop removed (stage measurement) |
| Tiny board + giant empty canvas (tablet/short windows) | Breakpoint scoping + minmax track + 480px floor |
| Appearance toggle text pair over content | Single icon-only switch, bottom-right, dodge ladder |
| "3D desktop-only" + want 3D everywhere | Viewport gate removed; only WebGL/reduced-motion fall back |
| Can't play in 3D | Piece meshes forward clicks to their squares |
| Black-void horizon | Sky color matched to fog |
| Floating piece "while moving" | Old-build artifact of the sizing loop; unreproducible now; permanent flipped-drag regression coverage added |
| Realistic 3D + PUBG-like kill effects | Documented target + licensed-asset path; effects stay non-gory by policy |

## Quality gates

See final response / CI: typecheck, lint, full unit suite (295), build, puzzle validation,
all verification scripts, the three new browser checks, Python analytics suite.

## Recommended next milestone

**M-3D-ASSET-ACQUISITION-1** — source/commission licensed Mahabharata-era GLB unit models
(archer, cavalry, elephant, chariot, commanders) to replace the procedural set, then
**M-STORY-CAMPAIGN-LOOP-1** for Story gameplay identity.
