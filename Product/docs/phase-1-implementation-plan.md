# Phase 1 Implementation Plan — Build Order, Conflicts, Risks

**Date:** 2026-05-27
**Workspace:** `C:\Users\md200\OneDrive\Desktop\Chess\Product\` on branch `main`
**Companion to:** `docs/phase-1-plan.md` (approved design) — this file is the **execution contract** for that plan.

This document is what the implementing agent (me) follows during Phase 1. It's narrower than `phase-1-plan.md`: where the design plan lays out *what* to build and *why*, this file lays out *in what order*, *how I'll reconcile spec drift*, *how long each step takes*, and *what new risks I anticipate beyond the design plan's catalog*.

Stop point: this file is committed alone. No source code until human GO.

---

## 1 · Build order — file-by-file across 13 commits + Maia spike

Each commit boundary runs all 4 gates (typecheck/lint/test/build). If any fails, fix before advancing.

### Commit 1 — `src/data/db.ts` + first npm dep
- **Files created:**
  - `src/data/db.ts` (~150 lines): IndexedDB schema v1 via `idb`, 5 object stores (players, calibration_runs, style_vectors, mirror_matches stub, feedback stub), 2 indices (`calibration_runs.started_at`, `style_vectors.computed_at`), `onupgradeneeded` handler scoped for future v2 migration.
  - `src/data/db.test.ts` (~100 lines): 3 tests covering schema creation, idempotent reopen, round-trip of a style_vectors row.
- **package.json:** add `"idb": "8.0.3"` (pinned exact, no caret) to `dependencies`. Run `npm install --save-exact`. Verify `npm ls idb` shows no `invalid` warning.
- **Time estimate:** 2 hours.
- **Risk:** `idb` v8 uses TypeScript generics for the schema. Getting the type for `DBSchema` right takes ~30 min of API friction.

### Commit 2 — `src/ml/styleVector.ts` + fixtures + tests
- **Files created:**
  - `src/ml/styleVector.ts` (~250 lines): the `StyleVector` interface (9 dimensions per locked §0), `CalibrationRunData` input type, `computeStyleVector(data)` function with NaN-safe defaults for every edge case.
  - `src/ml/__fixtures__/aggressiveCalibration.json` (~80 lines): hand-crafted aggressive-style calibration_run output (`1.e4` opener, sub-5s avg move time, accepts all trades, blunders under pressure in Task 4, picks swindle in Task 5, keeps bishops in Task 7, weak Task 3 endgame, loses Task 8 to Stockfish 8/d6 with avg_cp_loss≈180).
  - `src/ml/__fixtures__/defensiveCalibration.json` (~80 lines): mirror image. `1.d4` opener, 15s+ avg move time, declines exchanges, picks principled in Task 5, keeps knights, converts Task 3 endgame, draws Task 8 with avg_cp_loss≈45.
  - `src/ml/styleVector.test.ts` (~150 lines): 8 tests covering happy path, 2 NaN edge cases (timeout-everything, resign-Task-8-in-3-plies), **the differentiation test** (≥4 of 9 dimensions differ between aggressive and defensive — assert which), Elo band boundary tests at 1199/1200/1499/1500/1799/1800.
- **Vitest config dependency:** to make `__fixtures__/*.json` importable, ensure `tsconfig.json` has `resolveJsonModule: true` (it does). No new config needed.
- **Time estimate:** 4 hours. Fixture authoring is the bulk — needs careful balancing so the ≥4 dimensions differ but no NaN sneaks through.
- **Risk:** the differentiation test may fail on first run if `motif_blindness` is the same across both fixtures (since I'm controlling task outputs not motif outcomes). Mitigation: aggressive fixture has motif_blindness fork=0.75, pin=0.5, skewer=0.5, rm_def=0.75; defensive has fork=0.25 across the board. Two dimensions differ on motif_blindness alone (fork and rm_def), plus opening, avg_time, exchange_willingness, endgame_strength, swindle_preference = 7 dimensions differing. Safe.

### Commit 3 — `src/lib/eloDetect.ts` + tests
- **Files created:**
  - `src/lib/eloDetect.ts` (~80 lines): pure function `computeDetectedElo(calibrationData)` → `{ detected_elo: number, elo_band: ApprenticeBand }`. Formula per locked §0: `clamp(1000 + 600*tactical + 200*endgame + 300*vyasa, 800, 2100)`. Header comment block with the band table, the 3 documented limitations, and the explicit asymmetric-clamp rationale ("full disengagement must penalize below the 1000 participation baseline").
  - `src/lib/eloDetect.test.ts` (~80 lines): tests at every band boundary (1199, 1200, 1499, 1500, 1799, 1800), the 800 floor (all-timeout case), the 2100 ceiling (max scores), and the all-zero-vyasa scenario.
- **Time estimate:** 1.5 hours.
- **Risk:** none new. The math is locked.

### Commit 4 — `src/engine/calibrationOpponent.ts`
- **Files created:**
  - `src/engine/calibrationOpponent.ts` (~80 lines): isolated wrapper around an instance of the existing Stockfish bridge with Skill Level 8 (UCI `setoption name Skill Level value 8`) and depth 6 cap. Exposes `init()`, `move(fen)`, `dispose()`. Top-of-file comment per locked §0 forbidding Mirror imports.
- **Changes to `src/engine/stockfish.worker.ts`:** needs to handle a new `setoption` command type — currently it only knows `init`/`go`/`stop`. Add `setoption` passthrough so the calibration opponent can send `setoption name Skill Level value 8`. This is the **minimal helper edit** the design plan flagged as the only allowed src/engine/ change.
- **Changes to `src/engine/stockfishBridge.ts`:** add `setOption(name, value)` to the bridge API. Same minimal-helper rationale.
- **Tests:** none (per locked decision — thin wrapper). JSDoc on each public function.
- **Time estimate:** 2 hours.
- **Risk (new, not in phase-1-plan.md):** the stockfish-nnue-16-single.js build may not respect `setoption name Skill Level`. Stockfish 16 honors it, but the NNUE-single Emscripten build sometimes ignores Skill Level in favor of pure depth. **Mitigation:** if Skill Level is ignored, fall back to depth-only control. Document this in the wrapper. Verify by sending `setoption name Skill Level value 0` and `setoption name Skill Level value 20` and observing move quality differences.

### Commit 5 — `src/state/calibrationStore.ts` + tests + Vitest config
- **Files created:**
  - `vitest.config.ts` (~25 lines): `environment: 'jsdom'`, `globals: true`, `setupFiles: ['./src/test/setup.ts']`. Locked §0.
  - `src/test/setup.ts` (~5 lines): `import '@testing-library/jest-dom'`.
  - `src/state/calibrationStore.ts` (~200 lines): Zustand store with `run`, `currentTaskIndex`, `taskOutputs`, and actions `startRun`, `resumeRun`, `submitTask`, `completeRun`. Uses `src/data/db.ts` directly. The 24-hour staleness check lives here.
  - `src/state/calibrationStore.test.ts` (~120 lines): happy path, resume after page reload, 24h staleness triggers fresh run.
- **package.json:** add 2 devDependencies:
  - `"@testing-library/jest-dom": "6.5.0"` (latest stable as of writing)
  - `"@testing-library/react": "16.3.0"` (approved exact latest stable; use React Testing Library for component interactions)
  - `"jsdom": "25.0.1"` (transitive of vitest but pin to be safe; vitest 2.x can use jsdom directly)
- **Dependency decision:** R9 is resolved in favor of `@testing-library/react`. Do not write vanilla DOM event dispatch tests for drag interactions.
- **Time estimate:** 4 hours.
- **Risk (new):** Vitest's jsdom environment can leak state between tests when Zustand stores keep module-level instances. Mitigation: `beforeEach` resets the store via `useCalibrationStore.setState(initial)` and clears the test IndexedDB by deleting the database between tests.

### Commit 6 — `src/data/calibrationPositions.json` + verification script
- **Files created:**
  - `scripts/verify-calibration-positions.mjs` (~150 lines): Node script that spawns Stockfish CLI (or uses the npm `stockfish` package's Node entry), sends `setoption name MultiPV value 3` + `go depth 14` for each position, parses output, asserts `cp(best) - cp(second) ≥ 150`. Exits non-zero on first failure. Runs as part of CI eventually.
  - `src/data/calibrationPositions.json` (~400 lines): the 8 tasks with all positions, candidate moves, Vyasa lines, scoring, depth-14 eval comments.
- **Time estimate:** 6 hours. Position sourcing is the bulk — finding/constructing positions where one move beats the next by ≥150 cp at depth 14 is harder than it sounds, especially for the "swindle" position in Task 5 (needs a specific shape).
- **Risks (new):**
  - **R1: Position sourcing is locked.** The source/verification rules are:
    - Tasks 1 and 4 (8 tactical positions): source from the Lichess CC0 puzzle DB. Filter by motif (`fork`, `pin`, `skewer`, `discoveredAttack`/removing-defender) and puzzle rating band 1200-1800. Pick by cp gap >=150. Each tactical position in `calibrationPositions.json` must include `source_lichess_puzzle_id` for attribution and reproducibility.
    - Task 3 (endgame): construct manually and document the source; Lucena Position is recommended.
    - Tasks 2 and 6 (openings): no Stockfish verification, because these test repertoire rather than move quality.
    - Task 7 (4 exchange positions): construct manually and assert `cp(accept)` and `cp(decline)` are within 50 cp at depth 14.
    - Task 5 (moral chess): construct manually per R2. Budget 1.5h.
    - Before Commit 6 begins, install Stockfish CLI for Windows from `https://stockfishchess.org/download/`. `scripts/verify-calibration-positions.mjs` uses that CLI for manual-construction verification.
  - **R2: The Task 5 swindle position is the hardest single position to construct.** It needs Move A (patient, ≥150 cp advantage at depth 14, no opponent-error dependency) AND Move B (winning ≥300 cp only if Black plays a specific sub-optimal response within 3 plies, else losing ≥80 cp). Finding such a position in Lichess puzzle DB is unlikely — Lichess tags by motif not by "swindle vs principled." Construct manually and verify. Budget 1.5h.

### Commits 7a.0–7e — Task components
Sub-commits to keep the diff reviewable. Each sub-commit's gates must pass.

#### 7a.0 — BoardView split for calibration reuse
- **Files created/modified:**
  - `src/components/Board/BoardView.tsx` (~120 lines): pure presentational component receiving all chess state and callbacks via props (`fen`, `playerColor`, `status`, `engineThinking`, `onPieceDrop`, `onPromotionCheck`, `onPromotionPieceSelect`, `themeManifest`).
  - `src/components/Board/Board.tsx`: thin wrapper that subscribes to `gameStore` and passes values to `BoardView`.
- **Route behavior:** `/play` continues to import and render `Board.tsx`; no behavior change.
- **Calibration behavior:** calibration tasks import `BoardView` directly so their board state cannot interfere with `/play` state.
- **Time:** 30-45 minutes.
- **Commit message:** `refactor(board): split Board into gameStore wrapper + pure BoardView for reuse`

#### 7a — Task1Tactical + Task4TacticalRace (shared infra)
- **Files created:**
  - `src/components/Calibration/TaskBoardShell.tsx` (~120 lines): shared component for tactical tasks — renders a `BoardView` frozen at a FEN, accepts move-from-user, validates against expected_inputs, shake-on-wrong, soft+hard timers.
  - `src/components/Calibration/Task1Tactical.tsx` (~80 lines): wraps TaskBoardShell with 4-position rotation, scoring (correct_count, motif_missed[]).
  - `src/components/Calibration/Task4TacticalRace.tsx` (~80 lines): same but 15s/20s timers and tracks time_pressure_blunder_rate.
  - `src/components/Calibration/Task1Tactical.test.tsx` (~80 lines): unit test for scoring logic.
- **Time:** 4 hours.
- **Risk status:** Board/gameStore coupling is handled by sub-commit 7a.0. Task components import `BoardView`, not `Board`.

#### 7b — Task2OpeningChoice + Task6BlackRepertoire + Task7Exchange (button-grid)
- **Files created:**
  - `src/components/Calibration/TaskButtonGrid.tsx` (~80 lines): shared 2x3 or 1x4 button grid with piece-emblazoned SVGs.
  - `src/components/Calibration/Task2OpeningChoice.tsx` (~50 lines)
  - `src/components/Calibration/Task6BlackRepertoire.tsx` (~70 lines): 2 positions sequenced
  - `src/components/Calibration/Task7Exchange.tsx` (~90 lines): accept/decline with minor-piece tracking
- **Time:** 3 hours.
- **Risk:** piece SVGs — I need 6 different piece icons (P/R/N/B/Q/K) for the opening-choice buttons. react-chessboard ships these; check whether they're exportable or if I render them via a tiny inline-SVG sub-component. **Default:** inline SVG inside `TaskButtonGrid.tsx`, 12 lines per piece, no dep on react-chessboard internals.

#### 7c — Task3EndgameTechnique
- **Files created:**
  - `src/components/Calibration/Task3EndgameTechnique.tsx` (~150 lines): full play against `calibrationOpponent` from a fixed FEN, 25-move budget, scoring `endgame_strength`.
- **Time:** 4 hours. The "25-move budget" needs a move counter + pawn-promoted/mate detection. Reuses `BoardView` from 7a.0.
- **Risk:** chess.js move counting from a specific FEN starts at the FEN's halfmove counter, not 0. I need to track moves *from the calibration starting FEN*, not from the chess.js base. Track manually.

#### 7d — Task5MoralChess
- **Files created:**
  - `src/components/Calibration/Task5MoralChess.tsx` (~150 lines): interactive step-through per locked §0 decision 7. Show position, two move-card buttons with one-line descriptors, render 3 plies on click, Next button or board-tap advances ply, 250ms animation, outcome label, auto-advance after 1s.
- **Time:** 4 hours.
- **Risk:** the 250ms ply animation needs to use Board's existing `animationDuration` prop (already at 240ms — close enough). Verifying that consecutive `position` prop changes trigger the animation reliably is the verification step.

#### 7e — Task8VyasaMatch
- **Files created:**
  - `src/components/Calibration/Task8VyasaMatch.tsx` (~250 lines): full game vs calibrationOpponent, chess clock 5+3, Vyasa interventions at moves 8/16/24 from the conditional library.
  - `src/components/Calibration/vyasaLines.ts` (~80 lines): the 12-line conditional library with a priority-ordered selector function `pickVyasaLine(gameState): VyasaLine`.
  - `src/components/Calibration/Task8VyasaMatch.test.tsx` (~80 lines): unit tests for the line selector (12 trigger states → 12 expected lines), priority ordering, catch-all fallback.
- **Time:** 6 hours. The longest task component by far.
- **Risk (new):**
  - **R3: Chess clock implementation.** Need to track user's clock separately from engine's clock (the engine moves near-instant, so its clock barely ticks). When user's clock hits zero → game ends, flagged as time-out result. `setInterval` is the obvious approach; needs to clear on unmount and on game-end to avoid leaks. JSDoc on the cleanup.
  - **R4: cp_loss tracking for Vyasa triggers.** The `after_blunder` and `after_brilliancy` triggers need post-move evaluation. That means the engine evaluates after every user move at depth ≥10. Adds ~200-500ms of compute per move on top of the engine's own move. Acceptable for 5+3 time control but not free. Document in code.

**>>> CHECKPOINT 1 here:** after Commit 6 lands, forward FENs + Vyasa lines + verified evals to the human. Include the Lichess puzzle IDs for Tasks 1 and 4 so the human can spot-verify any sourced tactical position.

### Phase 1.5 — Maia spike (inserted between 7e and 9)
Branch `spike/maia-feasibility`, throwaway. 2-day hard ceiling.

- **Day 1:** evaluate lc0-wasm options. Three candidates:
  - `lc0-wasm` (official-ish): https://github.com/Mk-Chan/lc0-web — last commit ~2 years ago, may be stale.
  - Patrick Lyster's Maia browser demo: https://patricklyster.com/maia-chess (if URL is current).
  - DIY: compile lc0 to WASM with Emscripten, ~unknown effort, defer.
  Pick one. Load Maia 1500 weights. Measure cold-start, first-move latency, memory, weight delivery size, Safari compatibility.
- **Day 2:** write `docs/maia-spike-report.md` with verdict (PASS / FAIL / DEGRADED) per the brief's criteria.

Day-1 lunchtime go/no-go is locked. If the first lc0-wasm option fails by lunch on day 1, abandon Maia and proceed with a Stockfish-only Mirror architecture assumption. Document the decision in `docs/maia-spike-report.md`. If FAIL or no answer in 2 days: Phase 2 Mirror falls back to Stockfish-only with UCI_LimitStrength + style reranking. Phase 1 work resumes regardless.

**>>> CHECKPOINT 2 here:** forward `docs/maia-spike-report.md` to the human. Continue building.

### Commit 8 — `src/components/Calibration/Progress.tsx`
- **Files created:**
  - `src/components/Calibration/Progress.tsx` (~80 lines): sticky 8-segment strip per locked §0. Pandava gold (`#b8923a`) for current, muted indigo (`var(--indigo)` at lower opacity or precomputed) for completed, `var(--rule)` for future. Tooltip on hover/long-press shows task name.
- **Time:** 1.5 hours.
- **Risk:** none new.

### Commit 9 — `src/components/Mirror/StyleVectorRadar.tsx` + tests
- **Files created:**
  - `src/components/Mirror/StyleVectorRadar.tsx` (~300 lines): the dual-mode radar/sliders component. Above 600px viewport renders SVG radar with 8 axes per phase-1-plan.md §7. Below 600px renders vertical slider list. Both emit `onChange(newVector)`.
  - `src/components/Mirror/styleSummary.ts` (~120 lines): deterministic prose generator. `generateSummary(vector): string` returning a 1-3 sentence summary per the examples in the design plan.
  - `src/components/Mirror/StyleVectorRadar.test.tsx` (~120 lines): tests render with a known vector, simulate pointer-drag on one axis, assert `onChange` fires with the correct new vector. Tests styleSummary with both fixtures.
- **Time:** 6 hours. The radar SVG geometry + drag math + slider list + responsive switch is the biggest UI lift in the phase.
- **Risks (new):**
  - **R5: Pointer event capture across SVG-DOM boundary.** Dragging an SVG circle requires `setPointerCapture` on the element to keep pointermove events flowing even when the pointer leaves the circle. Standard pattern; needs careful unmount cleanup.
  - **R6: 600px breakpoint detection.** `window.matchMedia('(max-width: 599px)')` with a React `useSyncExternalStore` subscription is the clean pattern. Avoid raw `useEffect`+`resize` listeners.
  - **R7: Slider list axis order must match radar axis order.** Single source-of-truth array of axis definitions to prevent drift between the two views.

**>>> CHECKPOINT 3 here:** after Commit 9, forward radar screenshots (desktop + mobile, aggressive fixture loaded).

### Commit 10 — `src/routes/Calibration.tsx` + App.tsx wiring
- **Files created:**
  - `src/routes/Calibration.tsx` (~120 lines): orchestrates the 8 tasks via `useCalibrationStore`. Renders Progress.tsx + current Task component. On task 8 complete: `useNavigate('/profile')`.
  - **Modify** `src/App.tsx`: add `<Route path="/calibration" element={<Calibration />} />`.
- **Time:** 2 hours.
- **Risk:** none new.

### Commit 11 — `src/routes/Profile.tsx`
- **Files created:**
  - `src/routes/Profile.tsx` (~150 lines): renders StyleVectorRadar with the player's current vector + summary + swindle tag + detected_elo display + grayed "Continue to your Mirror" + "Redo calibration" link.
  - `src/routes/Profile.test.tsx` (~80 lines): renders with a fixture vector, asserts radar/summary/tag/elo display, asserts grayed button is non-clickable.
  - **Modify** `src/App.tsx`: add `<Route path="/profile" element={<Profile />} />`.
- **Time:** 3 hours.
- **Risk:** none new.

### Commit 12 — `src/routes/Home.tsx` + `Play.tsx` copy
- **Files modified:**
  - `src/routes/Home.tsx`: primary CTA "Begin Calibration" → `/calibration`. Demote existing "Begin" to secondary "Free play" link.
  - `src/routes/Play.tsx`: update the explanatory note about Agent B / Agent C arrival.
- **Time:** 1 hour.
- **Risk:** none.

### Commit 13 — `docs/phase-1-report.md` + tag
- **Files created:**
  - `docs/phase-1-report.md`: full report per the brief.
- **Tag:** `v0.2.0-agent-b` only after Checkpoint 4 revisions absorbed.
- **Time:** 2 hours.

**>>> CHECKPOINT 4 here:** forward report + 3 screenshots of own test run.

### Total estimated time
~55 hours of focused work, comprising:
- Source code: ~38h
- Position sourcing + verification: ~6h
- Maia spike: 2 days (16h budget, runs in parallel with parts of Phase 1)
- Manual test runs (aggressive + defensive, mobile check at 360px): ~3h
- Report: ~2h
- Checkpoints and pauses for human review: out of band

That's higher than the design plan's 30-35h estimate. The delta is honest: this plan factors in
- the position-verification script (~6h, mostly Lichess data wrangling),
- the Maia spike (16h budget),
- the test infrastructure setup (vitest.config + setup.ts + jest-dom + react-testing-library),
- the 4 checkpoint pauses for human review,
- and the BoardView split needed to decouple calibration boards from gameStore-backed `/play`.

At ~6 hours per working day, that's **~9 working days**, plus Maia spike overlapping.

---

## 2 · Conflicts between approved revisions and v4 spec

Eight items where `docs/phase-1-plan.md` revisions (or the current Phase 1 brief) and `docs/v4_implementation.html` disagree. The approved revisions / current brief **win** in all cases. Documenting here so future readers don't get confused.

| # | Topic | v4 spec | Locked revision | Resolution |
|---|---|---|---|---|
| 1 | StyleVector dimension count | 8 (v4 §11 `MirrorConfig.styleVector`) | 9 (phase-1-plan.md §4: adds `swindle_preference`) | Use 9; `swindle_preference` is nullable so legacy 8-dim consumers handle absent field gracefully. v4 §11's MirrorConfig will need updating in Phase 2. |
| 2 | Storage backend | Postgres + Supabase (v4 §5) | IndexedDB only (phase-1-plan.md §8) | IndexedDB for Stage 0/1; Supabase deferred to Stage 1+ per v2 strategy. No conflict in practice. |
| 3 | `previous_vector_id` column | not specified (v4 §5 has `style_vector jsonb` on players, no history table) | required (phase-1-plan.md §8) | Add column to local IndexedDB schema; Stage 1+ Supabase schema must add it. Note in phase-1-report.md for forward continuity. |
| 4 | Test framework setup | not specified | Vitest with jsdom + globals + setup file (locked §0) | Add `vitest.config.ts` per locked decision 3. |
| 5 | Engine for Task 8 | not specified explicitly | calibrationOpponent.ts isolated helper (locked §0) | Build per locked decision; flag in code comment that Phase 2's Mirror engine must not import this module. |
| 6 | Task 5 consequence UI | not specified | interactive step-through (locked §0 revision 7) | Build interactive. |
| 7 | Mobile radar | unspecified — radar implied for all viewports | slider list below 600px (locked §0 revision 4) | Dual-mode component. |
| 8 | Calibration time budget | "≤18 minutes" (v4 §7 Agent B brief) | "12–18 minutes" (phase-1-plan.md §1) | Same in practice; both bound at 18 min upper. |

Three "no-conflict" items worth noting:
- Maia weights (v4 §1 lists `lc0-wasm v0.30.x` + Maia 1100/1300/1500/1700/1900): not touched in Phase 1. The Maia spike (Phase 1.5) tests feasibility for Phase 2.
- Coach/Gemini (v4 §10): not Phase 1.
- Story system (v4 §3): not Phase 1.

---

## 3 · New risks beyond `phase-1-plan.md §6`

`phase-1-plan.md` §6 / §9 listed risks already (dhoti drape, face abstraction, recurve bow, OneDrive, GPU, etc. — most are Blender-specific and now paused). The list below is **Phase 1-specific** risks not flagged in the design plan.

### R1 — Position sourcing and Stockfish CLI verification
Position sourcing is locked before Commit 6:
- Tasks 1 and 4 use the Lichess CC0 puzzle DB, filtered by motif (`fork`, `pin`, `skewer`, `discoveredAttack`/removing-defender), rating 1200-1800, and cp gap >=150. Store `source_lichess_puzzle_id` in every tactical position.
- Task 3 uses a manually constructed endgame, with source documented; Lucena Position is recommended.
- Tasks 2 and 6 opening choices do not use Stockfish verification because they test repertoire, not move quality.
- Task 7 uses four manually constructed exchange positions where `cp(accept)` and `cp(decline)` are within 50 cp at depth 14.
- Task 5 is manually constructed per R2 with a 1.5h budget.

**Mitigation:** install Stockfish CLI for Windows from `https://stockfishchess.org/download/` before Commit 6 begins. `scripts/verify-calibration-positions.mjs` uses that CLI for manual-construction verifications.

### R2 — Task 5 swindle position is bespoke
Cannot be sourced from a puzzle database. Lichess puzzles tag by motif (`fork`, `discoveredAttack`, etc.) not by "swindle vs principled." Position must be constructed manually with both moves verified.

**Mitigation:** budget 1.5h; if construction fails, fall back to a simpler choice (move that wins material via tactic vs move that wins position via maneuvering, both at ≥150 cp). Document the simplification.

### R3 — Stockfish `setoption name Skill Level` may not work
The NNUE-single Emscripten build sometimes ignores Skill Level in favor of depth control.

**Mitigation:** verify by sending Skill 0 vs Skill 20 in a smoke test before Commit 4 lands. If ignored, fall back to depth-only control for the calibration opponent (depth 4 instead of 6 to simulate weaker play). Document in code.

### R4 — Board.tsx is bound to gameStore; calibration needs decoupling
The existing `Board.tsx` reads `useGameStore` directly. Calibration tasks need a Board variant that takes board state as props, not from gameStore.

**Mitigation:** add sub-commit 7a.0 before task components. Create pure `BoardView.tsx`, refactor `Board.tsx` into a thin gameStore wrapper, keep `/play` behavior unchanged, and have calibration tasks import `BoardView` directly.

### R5 — Vyasa "after_brilliancy" + "after_blunder" triggers need per-move evals
Adds ~200-500ms per move on top of engine's own thinking time. Acceptable within 5+3 time control but cumulative.

**Mitigation:** post-move eval happens in parallel with engine's next think — overlap them. Document in code.

### R6 — Chess clock implementation leaks
`setInterval` for clock ticking must be cleared on unmount AND on game-end. Easy to forget on the second path.

**Mitigation:** single `useEffect` that returns cleanup; secondary `useEffect` watching game-end state that also clears.

### R7 — Pointer-capture across SVG-DOM boundary in radar drag
Dragging an SVG circle without `setPointerCapture` loses move events when the pointer leaves the circle.

**Mitigation:** standard `setPointerCapture(pointerId)` on pointerdown; release on pointerup/pointercancel.

### R8 — 600px breakpoint detection in React without re-render storms
Naive `useEffect`+`resize` listener causes re-renders on every pixel change during window-resize.

**Mitigation:** `useSyncExternalStore` subscribing to `matchMedia('(max-width: 599px)').addEventListener('change', ...)`. Single re-render only on the breakpoint crossing.

### R9 — `@testing-library/react` approved
The human approved adding `@testing-library/react` to devDependencies.

**Mitigation:** pin exact latest stable `16.3.0` and use React Testing Library for component interaction tests. Do not write vanilla DOM event dispatch tests for drag interactions.

### R10 — Vitest jsdom state leakage between tests
Module-level Zustand store instances and a singleton IndexedDB connection leak between tests in jsdom.

**Mitigation:** `beforeEach` in calibrationStore.test.ts and db.test.ts resets store state and deletes the test DB. Document the pattern.

### R11 — Maia spike timebox bleed
2-day ceiling is tight. If the first lc0-wasm option doesn't load, switching to a second option burns the timebox.

**Mitigation:** day-1 lunchtime is the go/no-go on the first option. If it doesn't load by lunchtime day 1, abandon Maia path and proceed with Stockfish-only assumption for Phase 2 architecture. Document in the spike report.

### R12 — PWA precache growth from new source code
Currently 53 entries / 9.89 MB. Phase 1 adds source code (small) but no new asset files except `calibrationPositions.json` (likely 50 KB). New entries to be precached: ~6-8 additional JS chunks from the new routes. Estimated post-Phase-1 precache: 58-62 entries / 10.3-10.5 MB.

**Risk:** crosses the "under 12 MB" acceptance threshold? Unlikely but worth measuring at Commit 13.

**Mitigation:** if precache exceeds 12 MB, audit which assets are precached; consider excluding the larger pieces/topdown/ images (only used at runtime when topdown mode is active, which isn't implemented yet) via Workbox glob ignore.

---

## 4 · Forward checkpoint summary

| # | After commit | What to forward | Continue building? |
|---|---|---|---|
| 1 | 6 | 8 calibration positions (FEN + depth-14 eval + best move + cp gap) + source Lichess puzzle IDs for Tasks 1/4 + 12 Task 8 Vyasa lines + 8 task-open Vyasa lines | yes |
| 2 | 7e + Maia spike done | docs/maia-spike-report.md with PASS/FAIL verdict | yes |
| 3 | 9 | Radar screenshot at desktop (≥720px) + mobile (375px iPhone SE) with aggressive fixture loaded | yes |
| 4 | 13 | phase-1-report.md + 3 screenshots of end-to-end test runs (aggressive + defensive + mobile flow) | hold for revisions, then tag |

---

## 5 · Acceptance gate checklist (final, for self-verification)

Before tagging `v0.2.0-agent-b`:

- [ ] `npm run typecheck` exit 0
- [ ] `npm run lint` exit 0
- [ ] `npm test` all green, ≥18 tests passing (current 11 + new ~7)
- [ ] `npm run build` exit 0
- [ ] Differentiation test passes (≥4 of 9 dimensions differ between aggressive/defensive)
- [ ] Manual: Home → Begin Calibration → 8 tasks → /profile, 12–18 min wall clock
- [ ] Refresh /profile → radar persists
- [ ] Drag a radar axis → new style_vectors row with `source: 'tuned'`; original calibration row preserved
- [ ] Two run-throughs with opposite styles → visibly different radars + different summaries + different swindle tags
- [ ] PWA precache under 12 MB
- [ ] docs/phase-1-report.md exists with PASS verdict
- [ ] All 4 checkpoints absorbed any human revisions
- [ ] `v0.2.0-agent-b` tag placed on the final commit

---

## STOP

This file is the execution contract. No source code until human GO. Forward this file via the next response.
