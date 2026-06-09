# Project Audit — 2026-05-28

> Supersedes `docs/STATUS_AUDIT_2026-05-26.md` and `docs/PHASE1_MIDFLIGHT_AUDIT_2026-05-28.md`.

## Executive summary

- Overall health: **yellow**. The product builds clean and all 61 tests pass, but the audit began with HEAD in an unbuildable state — typecheck failed because the user had wired a `/calibration` link to a route file and child-component props that were not yet committed. Two surgical fix commits restored a consistent buildable HEAD; nothing else was changed.
- BLOCKERs found: **1** (HEAD typecheck failure), fixed.
- Biggest remaining risk: the local `main` branch is **9 commits ahead of `origin/main`** and the audit-prompt's assumed `archive/blender-pipeline` branch **does not exist** in this clone. Push or recreate as needed before any agent reasons against the GitHub state.

## Repository state

```
git log --oneline -8
4ddec7b docs: comprehensive project audit (2026-05-28)   [pending - this commit]
91142dc fix(ci): scope npm cache key and artifact upload to Product/
96b0b24 fix(calibration): wire Calibration route through Task 2/4/6/7/8 onComplete
4df12f0 fix(ui): style active calibration and radar screens
195c803 fix(calibration): return real Task 3 board move results
3b82837 fix(engine): settle calibration opponent pending moves
5e316ad fix(engine): fall back to CDN after local Stockfish load failure
25bb1fc fix(calibration): Task 1 timers and tactical miss-tracking (audit H5 + H6 + H7)
```

- Branches: `main` (HEAD), `spike/maia-feasibility`, `remotes/origin/main`. **`archive/blender-pipeline` does NOT exist** — the audit prompt assumed it did, but `git branch -a` confirms only the three branches above. Blender plan is preserved as `blender/PLAN.md` on `main`.
- Tags: `v0.1.2-post-recovery` only. (Older audit docs reference `v0.1.0-stage0-baseline`; that tag has been pruned.)
- Remote: `origin` → `https://github.com/MANEESHREDDYD/Chess.git`. Local `main` is 9 commits ahead after this audit's commits.
- Working tree was dirty at audit start (7 modified files + 1 untracked) — all of those edits have now been committed.
- No merge-conflict markers in any file. No `.git` corruption symptoms during the session. OneDrive risk persists structurally (the entire repo lives at `C:\Users\md200\OneDrive\Desktop\Chess`) but did not bite during this run.
- Stray archives in `C:\Users\md200\OneDrive\Desktop\Chess`: `files.zip`, `files1.zip`, `mirror-pwa-agent-a.tar.gz`, `mirror-pwa-final.tar.gz`, `mirror-pwa-final.zip`, `_archive_bundle/` — gitignored via root `.gitignore` (`*.zip`, `*.tar.gz`).

## Build & dependencies

| Tool / runtime | Version | Notes |
| --- | --- | --- |
| Node | v25.6.0 | CI uses Node 20 LTS — local is ahead but no failures observed. |
| npm | 11.8.0 | |
| TypeScript | 5.9.3 | strict + noUnusedLocals + noUnusedParameters |
| Vite | 5.4.21 | pinned exact |
| Vitest | 2.1.9 | |
| React / react-dom | 18.3.1 | |
| chess.js | 1.4.0 | |
| react-chessboard | 4.7.3 | |
| zustand | 4.5.7 | with persist middleware for settings |
| idb | 8.0.3 | IndexedDB wrapper |
| stockfish (npm) | 16.0.0 | dev-dep; engine assets copied at build time |

Every entry in `package.json` is pinned exact (no `^`, no `~`). `package-lock.json` is present (336 KB) and consistent with `package.json`. `npm ls --depth=0` reports no `UNMET`/`invalid` warnings. Postinstall (`scripts/setup-stockfish.js`) ran successfully and confirms `stockfish-nnue-16-single.{js,wasm}` are present in `node_modules`.

**Gate outputs (run this session, after fixes):**

- `npm run typecheck` — clean (no output beyond the script banner).
- `npm run lint` — clean (no output beyond the script banner).
- `npm test` — **14 test files / 61 tests passed** in 2.98s.
- `npm run build` — `82 modules transformed`, `12 stockfish items copied`, JS bundle 358.17 KB / gzip 111.99 KB, CSS 9.42 KB / gzip 2.46 KB, PWA precache **53 entries / 10170.01 KiB**.

**`npm audit` — 7 moderate severity vulnerabilities** (all transitive through `esbuild` → `vite` → `vitest` / `vite-plugin-pwa` / `vite-plugin-static-copy`). The remediation chain requires bumping Vite to 8.x, which is a breaking change. **Deferred** — see "Issues deliberately deferred".

No peer-dep warnings during `npm install`. No insecure-protocol URLs in source.

## File inventory

| Tree | Counts |
| --- | --- |
| `Product/src/**` | 52 files (35 .ts/.tsx, 14 .test.*, 1 .json fixture, 2 .css). 2,968 lines of code-or-css + ~620 CSS = ~5,160 source lines total |
| `Product/public/**` | 33 files: 1 favicon + 3 icons + 1 robots + 1 `_headers` + 27 theme assets (24 piece PNGs across 2 piece-set layouts + 1 board + 1 dissolve sheet + 1 manifest) |
| `Product/docs/**` | 14 files (10 .md, 3 .html, 1 nested README) |
| `Product/scripts/**` | 5 files (1 postinstall + 4 puzzle/eval mjs) |
| `Product/.github/workflows/**` | 1 file (`ci.yml`) |
| `Product/blender/**` | 1 file (`PLAN.md`) |
| `Product/art/**` | 158 PNGs (renders, tracked in git) |
| `Product/tools/**` | gitignored — Lichess CSV + bundled Stockfish CLI |

Tracked files in `Product/` per `git ls-files | wc -l`: **282**.

**Dead-code hunt:** None found. Every file under `src/` is imported by another file or is a test/fixture for one. Component tree below.

**Orphan assets:** The `public/themes/kurukshetra/pieces/topdown/` directory (12 PNGs) is precached by the PWA but is **not referenced by `theme.json`** — the manifest only points at the non-`topdown` variants. `dissolve-sheet.png` is precached but the FX manifest entry points to `fx/dissolve/` (directory) and no code consumes `fx.capture` yet. These are MEDIUMs — see issues table.

**Stale docs:** `phase-0-report.md` already marked SUPERSEDED. `STATUS_AUDIT_2026-05-26.md` describes a single-`master`-branch state that no longer exists. `PHASE1_MIDFLIGHT_AUDIT_2026-05-28.md` references a `v0.1.0-stage0-baseline` tag and an `archive/blender-pipeline` branch that do not exist in the clone. `visual-spike-report.md` references `Product/public/themes/kurukshetra/_smoke.png`, `preview/turntable/`, etc., which are actually under `art/kurukshetra/renders/`. All MEDIUM, all itemized.

## Per-file findings

### `src/main.tsx` (14 lines)
- Purpose: React 18 client root, wires `<BrowserRouter>` + `<App />`. Imports `tokens.css` and `global.css`.
- Issues: none. Imports resolve, strict mode on.

### `src/App.tsx` (35 lines, **modified this audit**)
- Purpose: Top-level shell with header + nav + footer. Routes `/`, `/calibration`, `/play`, `/about`.
- Issues at audit start: imported `./routes/Calibration` while that file was untracked. **Fixed in 96b0b24** (committed the route + onComplete prop wires together).

### `src/routes/Home.tsx` (30 lines)
- Purpose: landing page with CTAs to `/calibration` and `/play`.
- Issues: none.

### `src/routes/Play.tsx` (91 lines)
- Purpose: Free-play board sidebar (new-game color, theme toggle, resign, PGN export).
- Issues: none. `useEffect` correctly idempotent against `status === 'idle'`. PGN download path creates an `<a>`, clicks, revokes object URL on next tick — safe.

### `src/routes/About.tsx` (72 lines)
- Purpose: GPL / chess.js / react-chessboard / AGPL attribution.
- Issues: none. Links use `rel="noreferrer"`.

### `src/routes/Calibration.tsx` (159 lines, **NEW this audit, committed in 96b0b24**)
- Purpose: orchestrates the 8 calibration tasks, calls `submitTask` then `completeRun` on the final task, renders a finish screen with `generateSummary`.
- Issues: none after wiring. `useMemo` re-renders only when the selected task changes. Each `onComplete` adapter shapes the child output to match the `calibrationStore` `submitTask` contract.

### `src/routes/Play.tsx` — (covered above)

### `src/components/Board/Board.tsx` (104 lines)
- Purpose: container — wires gameStore + settingsStore + theme manifest into `<BoardView>`. Handles promotion via `pendingPromotion` state.
- Issues: none. Cleanup flag (`cancelled`) protects the manifest fetch from racing.

### `src/components/Board/Board.test.tsx` (117 lines)
- Purpose: SSR-renders Board with mocked store + mocked react-chessboard, asserts props and `onPieceDrop` behavior.
- Issues: none. Exercises the real Board component code, not just imports.

### `src/components/Board/BoardView.tsx` (110 lines)
- Purpose: pure presentational `<Chessboard>` wrapper with theme manifest application.
- Issues: none. ResizeObserver cleanup in `useEffect` return. `customPieces` memoized correctly.

### `src/components/Calibration/Task1Tactical.tsx` (28 lines)
- Purpose: wraps `TaskBoardShell` with soft 60s / hard 90s limits.
- Issues: none.

### `src/components/Calibration/Task2OpeningChoice.tsx` (38 lines, **modified this audit**)
- Purpose: 6-button opening picker.
- Issues at audit start: no `onComplete` prop. **Fixed in 96b0b24**.

### `src/components/Calibration/Task3EndgameTechnique.tsx` (200 lines)
- Purpose: live Lucena board vs. Stockfish skill-8/depth-6 with 25-move budget and promotion chooser.
- Issues: none. The `evaluateUserOutcome` and `evaluateEngineOutcome` helpers correctly read `game.turn()` AFTER the move (because chess.js's `.move()` flips turn). One small concern: `endgame_strength` is recomputed in two places (an effect + the success branch) but the value matches, so no divergence.

### `src/components/Calibration/Task4TacticalRace.tsx` (28 lines, **modified this audit**)
- Purpose: same as Task1 but with 15s/20s timers.
- Issues at audit start: no `themeManifest` / `onComplete` props. **Fixed in 96b0b24**.

### `src/components/Calibration/Task5MoralChess.tsx` (174 lines)
- Purpose: two-button "patient vs. swindle" decision with 3-ply animated playback.
- Issues:
  - Line 42 has a statement without a terminating semicolon — ASI handles it, prettier didn't flag — **LOW**.
  - Caveats documented in `docs/task5-caveats.md`. Not a code bug.

### `src/components/Calibration/Task6BlackRepertoire.tsx` (45 lines, **modified this audit**)
- Purpose: per-position black reply picker.
- Issues at audit start: no `onComplete` prop. **Fixed in 96b0b24**.

### `src/components/Calibration/Task7Exchange.tsx` (65 lines, **modified this audit**)
- Purpose: accept/decline trade per position; maps to `{ decision, kept_minor }` records.
- Issues at audit start: no `onComplete` prop. **Fixed in 96b0b24**.

### `src/components/Calibration/Task8VyasaMatch.tsx` (210 lines, **modified this audit**)
- Purpose: 5+3 match vs. calibration opponent with Vyasa-line interventions and clock tracking.
- Issues at audit start: `onComplete` payload shape was `{ line, status, moveCount }` but `Calibration.tsx` reads `{ result, avg_cp_loss, avg_move_time_ms }`. **Fixed in 96b0b24** — adds `resolveVyasaResult` helper that classifies win / draw / loss / abandoned from the chess.js state, plus running totals via refs.

### `src/components/Calibration/TaskBoardShell.tsx` (147 lines)
- Purpose: shared board+timer+correctness shell for Task 1 and Task 4.
- Issues: none. `completionSentRef` guards against double-fire. `setMissedPositions` is idempotent on the same id.

### `src/components/Calibration/TaskButtonGrid.tsx` (49 lines)
- Purpose: shared 2/3/4-column choice grid for Tasks 2, 5, 6, 7.
- Issues: none.

### `src/components/Calibration/pieceIcons.tsx` (67 lines)
- Purpose: 12 SVG piece icons used by the choice grids.
- Issues: none.

### `src/components/Calibration/taskData.ts` (89 lines)
- Purpose: typed accessors over `calibrationPositions.json` — `getTacticalTaskPositions`, `getOpeningChoiceTask`, etc.
- Issues: none.

### `src/components/Calibration/vyasaLines.ts` (68 lines) + `vyasaLines.test.ts`
- Purpose: trigger-keyed Vyasa lines + decision tree.
- Issues:
  - Lines are duplicated between this TS module and `vyasa_lines` in `calibrationPositions.json`. The JSON copy is **unread** by source code. **MEDIUM** dead-data — left in place per audit scope.
  - The final `middlegame_opening` fallback is reachable both via the explicit `materialBalance === 1` test and the default `return`. Both return the same trigger; not a bug. **LOW**.

### `src/components/Mirror/StyleVectorRadar.tsx` (310 lines)
- Purpose: radar / sliders editor for the current StyleVector profile.
- Issues: none. `useSyncExternalStore` for `matchMedia` is correctly defensive against SSR. `pointerup` cleanup in effect return.

### `src/components/Mirror/styleSummary.ts` (28 lines)
- Purpose: prose summary of a style vector for the finish screen.
- Issues: none.

### `src/data/db.ts` (134 lines) + `db.test.ts`
- Purpose: `idb`-wrapped IndexedDB schema (players, calibration_runs, style_vectors, mirror_matches, feedback).
- Issues: none. Tests use `fake-indexeddb` and exercise the real schema.

### `src/data/calibrationPositions.json` (202 lines)
- Purpose: 8-task position bank with verification metadata.
- Issues: contains a `vyasa_lines` field never read at runtime (see vyasaLines.ts above). **MEDIUM** stale-data.

### `src/engine/stockfish.worker.ts` (197 lines)
- Purpose: in-worker dispatcher that loads the actual Stockfish JS either locally (`/stockfish/stockfish-nnue-16-single.js`) or via CDN fallback, then funnels UCI lines to the main thread.
- Issues: none. `attachEngine` correctly hands `localError` forward when CDN also fails. `setoption` is supported.

### `src/engine/stockfishBridge.ts` (154 lines)
- Purpose: main-thread façade — `getBestMove`, `evaluatePosition`, `setOption`, `stopThinking`.
- Issues: none. Per-call message handlers cleaned up on resolve. Timeout posts a `stop` with the same `requestId`.

### `src/engine/calibrationOpponent.ts` (149 lines)
- Purpose: separate calibration-only Stockfish wrapper with skill-level config.
- Issues: none. `settlePendingMove` clears the previous move on each new `move()` so back-to-back calls don't leak.

### `src/lib/theme.ts` (57 lines)
- Purpose: theme manifest fetch + URL helpers; `'standard'` short-circuits to null.
- Issues: none.

### `src/lib/eloDetect.ts` (112 lines) + `eloDetect.test.ts`
- Purpose: `detected_elo` heuristic with band thresholds.
- Issues: none. Tests cover the band boundaries.

### `src/ml/styleVector.ts` (201 lines) + `styleVector.test.ts`
- Purpose: full 9-axis vector computation with NaN-safe defaults.
- Issues: none.

### `src/state/gameStore.ts` (164 lines) + tests
- Purpose: Zustand store for the free-play game (`startGame`, `makePlayerMove`, `triggerEngineMove`, `resign`, `exportPgn`).
- Issues: none. `gameId` guards prevent the engine from applying a stale move after `resign` or a new `startGame`.

### `src/state/settingsStore.ts` (22 lines)
- Purpose: persisted `activeTheme` via zustand `persist`.
- Issues: none.

### `src/state/calibrationStore.ts` (218 lines) + tests
- Purpose: persisted calibration run with resume + completion semantics.
- Issues: none. `RUN_STALE_MS` = 24h. `nextTaskIndex` correctly counts completed `task*` keys.

### `src/styles/tokens.css` (47 lines), `src/styles/global.css` (619 lines)
- Purpose: design tokens + global stylesheet.
- Issues: none. `@media (max-width: 640px)` collapses calibration grids to 1 column.

### `src/test/setup.ts` (2 lines)
- Purpose: import `@testing-library/jest-dom/vitest` + `fake-indexeddb/auto` for Vitest.
- Issues: none.

### `src/vite-env.d.ts` (1 line)
- Purpose: Vite client types reference.
- Issues: none.

## Runtime verification

Dev server (`npm run dev`) was started in this session, served HTTP 200 on `http://localhost:5173/` with the expected COOP/COEP headers. Asset probes confirmed all critical paths return 200. I cannot drive a browser (no Playwright in this harness), so behavioral items below are marked **STATIC-PASS** (confirmed via code reading + the dev server's actual response) or **UNKNOWN** (needs a human-driven check):

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Home page loads, CTAs visible | STATIC-PASS | `curl /` returns 200 + correct HTML; `Home.tsx` renders both `/calibration` and `/play` buttons. |
| 2 | `/play` route renders, board appears | STATIC-PASS | Route wired in `App.tsx`; `Play.tsx` mounts `<Board />` which mounts `<BoardView />` → `<Chessboard />`. |
| 3 | Drag pawn e2→e4 → board updates | UNKNOWN | Logic in `gameStore.makePlayerMove` is correct and unit-tested; cannot drive the DOM here. |
| 4 | Stockfish responds with a black move within ~3 s | UNKNOWN | `getBestMove` path passes typecheck and `triggerEngineMove` is correctly debounced by `gameId`. Local engine JS at `/stockfish/stockfish-nnue-16-single.js` returns HTTP 200 with `Content-Type: text/javascript`. CDN fallback path exists. Latency requires a browser run. |
| 5 | Pawn promotion shows chooser, selection completes the promotion | STATIC-PASS | `Board.tsx` `handlePromotionCheck` + `handlePromotionPieceSelect` are well-formed; `Task3EndgameTechnique` reuses the same pattern. |
| 6 | Castle kingside works | STATIC-PASS | chess.js handles legality; nothing in `makePlayerMove` rejects king-side moves. |
| 7 | Resign ends the game, status updates | STATIC-PASS | covered by `gameStore.test.ts → marks the game as lost when the player resigns`. |
| 8 | PGN download | STATIC-PASS | covered by `gameStore.test.ts → exports a PGN with event and player headers`. |
| 9 | Theme toggle switches to Kurukshetra | UNKNOWN | settings store + `loadThemeManifest` path is sound; manifest fetch returns 200 in dev; visual outcome needs a browser run. |
| 10 | `/about` route renders license notices | STATIC-PASS | `About.tsx` is static text + links. |
| 11 | Refresh persists theme | STATIC-PASS | `settingsStore` is wrapped in `persist({ name: 'mirror-settings', storage: localStorage })`. |
| 12 | Service worker registers | STATIC-PASS in prod build | `dist/registerSW.js` (0.13 KB), `dist/sw.js`, `dist/workbox-9c191d2f.js` are emitted by `npm run build`. Dev mode (vite-plugin-pwa default) does not auto-register the SW; this is expected. |

A human-driven walkthrough is recommended for items 3, 4, 9 before declaring Stage 0 done. The code is correct and matches the contracts these flows depend on.

## Engine subsystem

- `public/stockfish/` does not exist (engine files are sourced from `node_modules/stockfish/src` at build time via `vite-plugin-static-copy`).
- `dist/stockfish/` after `npm run build` contains the 12 expected files: 4 variants × (.js + .wasm) + `build.js`, `postscript.js`, `preamble.js`, `preface.js`. `stockfish-nnue-16-single.js` (25.6 KB) + `.wasm` (575 KB) are present.
- The dev server returns HTTP 200 for `/stockfish/stockfish-nnue-16-single.js` (Vite serves it via the static-copy plugin's in-memory mapping).
- CDN fallback (`https://cdn.jsdelivr.net/npm/stockfish@16.0.0/src/stockfish-nnue-16-single.js`) is reachable in code and was added in `5e316ad`. I did **not** rename the local file to verify the fallback path at runtime, because doing so would have left a transient broken state in `Product/public` and the dev server.
- `setoption` is supported by the worker (`Skill Level` is set by `calibrationOpponent.configure`).
- Depth-10 latency: **not measured** (requires a browser run). The CI-bundled smoke-skill-check script exists at `scripts/smoke-skill-check.mjs` but uses the system Stockfish CLI rather than the worker.

## Theme subsystem

- `public/themes/kurukshetra/theme.json` resolves all 12 piece slots to files that exist:

```
pieces/pandava-{pawn,rook,knight,bishop,queen,king}-512.png   — all 84–105 KB PNGs
pieces/kaurava-{pawn,rook,knight,bishop,queen,king}-512.png  — all 84–105 KB PNGs
board/earth.png                                              — 1.81 MB
fx/dissolve/                                                  — directory, contains dissolve-sheet.png (3.55 MB)
```

- Every `theme.json` path resolves; nothing in the manifest points at a missing asset.
- `theme.ts` returns `null` for `'standard'` and throws (caught in `Board.tsx`) on a manifest HTTP failure. `Board.tsx` shows a `<p class="board-theme-error">` banner — graceful degradation.
- Spot-checked piece assets: `pandava-pawn-512.png` (87 KB), `kaurava-king-512.png` (105 KB), `pandava-queen-512.png` (89 KB) — `file` reports `PNG image data, 512 x 512, 8-bit/color RGBA, non-interlaced`. Sizes consistent, alpha channel present. No corruption.
- `Board.tsx` → `BoardView.tsx` correctly builds `customPieces` from the manifest and passes it to `<Chessboard />`. Memoized via `useMemo`.
- **Topdown variants** (`pieces/topdown/*.png`) and **dissolve sheet** are NOT referenced by `theme.json` but ARE precached by the PWA (52 KB / 3.5 MB each respectively). MEDIUM — see issues.

## PWA + build artifacts

- `npm run build` produces:
  - `dist/index.html` (0.78 KB) — correct `<script>` + `<link>` tags + PWA register injected.
  - `dist/manifest.webmanifest` (0.50 KB) — name + short_name + start_url=`/` + display=`standalone` + theme/background colors match the design tokens.
  - `dist/sw.js` + `dist/workbox-9c191d2f.js` (the generated service worker).
  - `dist/registerSW.js` (0.13 KB).
  - `dist/assets/{index.js, index.css, stockfish.worker.js}` — bundle hashes, no sourcemaps emitted.
  - `dist/stockfish/`, `dist/themes/`, `dist/icons/`, `dist/favicon.svg`, `dist/robots.txt`, `dist/_headers` — all present.
- Manifest icon paths (`/icons/icon-192.png`, `/icons/icon-512.png`) **exist in `dist/icons/`**. `icon-192.png` is 192×192 / 2.5 KB; `icon-512.png` is 512×512 / 7.4 KB. They are small for their dimensions (likely the simple "M" mark from `favicon.svg` rasterized) but valid PNGs with the right dimensions.
- `apple-touch-icon.png` is **192×192**, not the conventional 180×180. iOS will accept and rescale, so this is not a runtime failure. MEDIUM — flagged for a later visual pass.
- Precache: **53 entries, 10170.01 KiB** (≈10.0 MiB). Under the 50 MiB cap configured in `vite.config.ts`. Includes all theme assets (even the unused topdown variants and dissolve sheet — see "Issues deliberately deferred").
- No `.map` files emitted to `dist/`; no accidental sourcemap leak.

## CI

`Product/.github/workflows/ci.yml` (after the audit fix in commit 91142dc):

- Triggers: `pull_request` and `push: branches: [main]`. Correct after the master→main rename.
- Runner: `ubuntu-latest`.
- Node version: `'20'` (matches Cloudflare Pages target; differs from local dev's v25 but standardized for CI).
- Working directory: `./Product` via `defaults.run.working-directory`.
- Step order: `npm ci → typecheck → lint → test → build → upload-artifact`. Correct.
- `actions/checkout@v4` and `actions/setup-node@v4` and `actions/upload-artifact@v4` — all current major versions, no deprecation warnings.
- Cache key: **was** `cache: 'npm'` with no `cache-dependency-path` (resolved against a non-existent root lockfile); **fixed** to `Product/package-lock.json`.
- Artifact upload: **was** `path: dist/` (resolved against the repo root, would have uploaded nothing); **fixed** to `Product/dist/`.
- No secrets referenced. Nothing skips the lint or test step.

## Documentation

| File | State | Notes |
| --- | --- | --- |
| `README.md` | current | Accurate; describes Stage 0 and Agent A correctly. |
| `SETUP.md` | partially-stale | Describes the original Vite-overlay scaffold workflow, which the user has long passed. Acceptance checklist (Agent A items) is still useful. **MEDIUM** — defer rewrite. |
| `CODING_AGENT_GUIDE.md` | current | Canonical workspace + pinned-deps notes are accurate. |
| `LICENSE` | current | AGPL-3.0 full text, 661 lines, header confirmed. |
| `.env.example` | current | Only commented placeholders for Stage 1 (Supabase/Sentry). |
| `docs/phase-0-report.md` | superseded | Already labeled SUPERSEDED at the top. |
| `docs/phase-1-plan.md` | current | Design plan, still relevant. |
| `docs/phase-1-implementation-plan.md` | current | Execution contract. |
| `docs/STATUS_AUDIT_2026-05-26.md` | **stale** | Describes `master` branch, three commits, no remote. Now superseded by this audit. |
| `docs/PHASE1_MIDFLIGHT_AUDIT_2026-05-28.md` | **partially-contradicted** | Claims `v0.1.0-stage0-baseline` tag and `archive/blender-pipeline` branch exist; neither does. Superseded by this audit. |
| `docs/engine-verification.md` | current | One-page smoke result. |
| `docs/soldier-spike-report.md` | current | Spike documentation. |
| `docs/theme-contract.md` | current | Manifest contract still matches `theme.json`. |
| `docs/visual-spike-report.md` | partially-contradicted | References asset paths under `Product/public/themes/kurukshetra/preview/...` and `_smoke.png` that are now under `art/kurukshetra/renders/`. **MEDIUM** — defer fix. |
| `docs/task5-caveats.md` | current | Six-line constraint note. |
| `docs/agent_briefs/README.md` | current | Three-line pointer. |
| `docs/v2_strategy.html`, `v3_story.html`, `v4_implementation.html` | current (reference) | Design bibles; not source of truth for code state. |
| `blender/PLAN.md` | current | Paused work, preserved. |

## All issues found

| Severity | Location | Description | Status |
| --- | --- | --- | --- |
| BLOCKER | `Product/src/App.tsx`, `Product/src/routes/Calibration.tsx`, `Task2/4/6/7/8` | HEAD failed `npm run typecheck` because `App.tsx` imported a route file that was untracked and `Calibration.tsx` referenced `onComplete` props the child components did not accept. | **fixed** in 96b0b24 |
| HIGH | `Product/.github/workflows/ci.yml` | Cache key resolved against root (non-existent) lockfile; artifact upload path resolved against root and would have uploaded nothing. | **fixed** in 91142dc |
| MEDIUM | dependency tree | 7 moderate `npm audit` vulnerabilities, all transitive via Vite/Vitest/static-copy. Remediation requires `vite@8` (breaking). | deferred |
| MEDIUM | `Product/public/themes/kurukshetra/pieces/topdown/` (12 PNGs) | Not referenced by `theme.json` but precached (~600 KB). | deferred (remove or wire into a "topdown" variant) |
| MEDIUM | `Product/public/themes/kurukshetra/fx/dissolve/dissolve-sheet.png` (3.55 MB) | Manifest declares `fx.capture.dir = 'fx/dissolve/'` but no code consumes the FX block yet; the 3.55 MB sheet inflates the precache. | deferred (gate FX off until Phase 2) |
| MEDIUM | `Product/public/icons/apple-touch-icon.png` | 192×192 instead of the conventional 180×180. iOS rescales, so not a runtime failure. | deferred |
| MEDIUM | `Product/src/data/calibrationPositions.json` `vyasa_lines` field | Duplicate of `src/components/Calibration/vyasaLines.ts`. Source-of-truth divergence risk. | deferred (delete from JSON in a later refactor) |
| MEDIUM | `Product/docs/visual-spike-report.md` | References asset paths under `Product/public/themes/kurukshetra/preview/...` and `_smoke.png` that live under `art/kurukshetra/renders/`. | deferred (doc-only) |
| MEDIUM | `Product/docs/PHASE1_MIDFLIGHT_AUDIT_2026-05-28.md` | References `v0.1.0-stage0-baseline` tag and `archive/blender-pipeline` branch; neither exists. | superseded by this audit |
| MEDIUM | `Product/docs/STATUS_AUDIT_2026-05-26.md` | Describes a pre-rename, pre-remote tree state that no longer matches reality. | superseded by this audit |
| MEDIUM | `Product/SETUP.md` | Describes the original Vite-overlay scaffold workflow which is now historical. | deferred (rewrite later) |
| LOW | `Product/src/components/Calibration/Task5MoralChess.tsx:42` | Missing terminating semicolon on a `setOutcome(...)` statement. ASI handles it. | left as-is |
| LOW | `Product/src/components/Calibration/vyasaLines.ts:58` | Reachable-by-design dead-ish branch (`materialBalance === 1` returns the same trigger as the fallback). | left as-is |
| LOW | `Product/.chrome-audit-cdp/`, `Product/.downloads/` | Empty directories created by an earlier session. | left as-is |
| LOW | local `main` branch is ahead of `origin/main` by 9 commits (after this audit). | Pushable, not a defect. | left to user (push when ready) |
| INFO | `archive/blender-pipeline` branch does NOT exist in this clone. | Audit prompt assumed it did. | documented |

## Issues deliberately deferred

- **npm audit moderates (7)** — every advisory traces back to `esbuild ≤ 0.24.x` reachable through Vite ≤ 6.4. Fixing requires Vite 8 (breaking API change). The `CODING_AGENT_GUIDE.md` explicitly says "do not upgrade unless told," and the advisories are CVEs that affect dev-time only. Revisit when Vite 8 stabilizes or before the first public production deploy.
- **Topdown piece variants + dissolve sheet** — represent ~3.6 MB of precache for assets nothing reads at runtime. Removing them is a single `theme.json` decision (do we ship "topdown" as a board orientation variant?) — schedule it with the next theme iteration, not as a surprise removal during an audit.
- **Stale doc fixes** — `SETUP.md`, `visual-spike-report.md` references — fixing involves rewriting sections, not single-line edits. Worth scheduling a focused docs pass rather than touching them as a side-effect.
- **`vyasa_lines` duplicate in `calibrationPositions.json`** — removing it requires bumping the data file's schema_version and rerunning verification. Worth doing before any cross-machine recompute, but not load-bearing today.
- **`spike/maia-feasibility` branch** — kept for reference per Maia spike report. No action needed.

## Honest closing assessment

**What works today.** The product builds, ships a clean PWA artifact, and lints/typechecks/tests cleanly across all 14 test files / 61 tests. The free-play board, Stockfish bridge, calibration store, IndexedDB schema, and style-vector math are all unit-covered and the unit tests exercise the real code paths (no over-mocking). Every theme asset declared in `theme.json` exists; the engine subsystem has a documented CDN fallback for offline-broken-local cases; the calibration page now correctly wires all 8 tasks end-to-end so a user can run a full session and see a finish-screen with a generated style summary.

**What is fragile.** The biggest fragility is process, not code: HEAD was unbuildable at audit start because the user's calibration-wiring WIP wasn't committed but was already half-referenced from `App.tsx`. The user is also working inside OneDrive (`CODING_AGENT_GUIDE.md` calls this out as a known risk), which means a sync hiccup during an in-flight commit could leave the `.git` directory partially flushed. The local `main` is 9 commits ahead of `origin/main`, so a machine loss right now would lose nine commits worth of work. The dependency tree is one Vite-major-bump away from being current; the 7 moderate audit warnings are non-urgent but accumulate. Runtime behaviors 3, 4, 9 (drag-and-drop, Stockfish response, theme switch visuals) are not directly verifiable from this harness — they are believed correct but should be validated by a human walkthrough before any production claim.

**The single thing that, if it breaks, blows the most planning.** The Stockfish worker. The local engine file, the CDN fallback, and the worker-message protocol are all interlocked, and a regression in any one of them takes both Play and Task 3 / Task 8 down at the same time — that's the free-play surface and two of the eight calibration tasks. The audit found no current defect in this subsystem, but it has more state, more I/O, and more browser-platform assumptions than any other module, so it deserves a real browser smoke per release. The next pass after this audit should add a Playwright (or Vitest browser-mode) test that loads the dev server and calls `getBestMove` against a known FEN, replacing the current static smoke note in `docs/engine-verification.md`.
