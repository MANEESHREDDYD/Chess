# MIRROR — Status Audit

**Date:** 2026-05-26
**Workspace:** `C:\Users\md200\OneDrive\Desktop\Chess\Product\`
**Auditor session:** this Claude Code session, commands run as listed below.

This is a ground-truth audit. Every claim below is backed by a command run in this session or a file inspected this session. Where I could not verify in this session, the item is marked **UNKNOWN**.

---

## SECTION 1 — Repository state

### `git log --oneline --all`

```
d3f14b1 chore: lock versions, clean workspace, update agent guide path
ffc8cb4 chore(phase-0): add tsconfig + lint config, verify Agent A baseline
2f38c61 chore: finalize Stage 0 Agent A requirements
```

Three commits total. Single branch.

### `git log --pretty='%h | %ai | %an <%ae> | %s'`

```
d3f14b1 | 2026-05-26 22:30:52 +0530 | Maneesh Reddy D <1nh19cs717.maneeshreddyd@gmail.com> | chore: lock versions, clean workspace, update agent guide path
ffc8cb4 | 2026-05-26 22:28:04 +0530 | Maneesh Reddy D <1nh19cs717.maneeshreddyd@gmail.com> | chore(phase-0): add tsconfig + lint config, verify Agent A baseline
2f38c61 | 2026-05-22 07:18:19 +0530 | Agent <agent@example.com> | chore: finalize Stage 0 Agent A requirements
```

The initial commit (`2f38c61`) was authored with the placeholder identity `Agent <agent@example.com>`. The two recent commits use the real identity.

### `git status`

```
On branch master
Changes to be committed:
  (use "git restore --staged <file>..." to unstage)
	modified:   docs/phase-1-plan.md
```

One staged but uncommitted change: `docs/phase-1-plan.md`. No untracked files.

### `git tag -l`

```
v0.1.0-stage0-baseline
```

One tag, on commit `ffc8cb4`. No `v0.2.0-agent-b` exists.

### `git branch -a`

```
* master
```

Only `master`. No `main`. No remote configured.

---

## SECTION 2 — Environment & build

### `node --version`

```
v25.6.0
```

**Note:** the v4 doc specifies Node 20 LTS; this machine is on v25. CI's `actions/setup-node@v4` uses `node-version: '20'`, so CI is on 20 but local development is on 25.

### `npm --version`

```
11.8.0
```

### `npm ls --depth=0`

```
mirror-pwa@0.1.0-stage0 C:\Users\md200\OneDrive\Desktop\Chess\Product
+-- @types/react-dom@18.3.7 invalid: "18.3.0" from the root project
+-- @types/react@18.3.29 invalid: "18.3.3" from the root project
+-- @typescript-eslint/eslint-plugin@7.18.0
+-- @typescript-eslint/parser@7.18.0
+-- @vitejs/plugin-react@4.7.0
+-- chess.js@1.4.0
+-- eslint-plugin-react-hooks@4.6.2
+-- eslint-plugin-react-refresh@0.4.26 invalid: "0.4.9" from the root project
+-- eslint@8.57.1 invalid: "8.57.0" from the root project
+-- prettier@3.8.3 invalid: "3.3.3" from the root project
+-- react-chessboard@4.7.3
+-- react-dom@18.3.1
+-- react-router-dom@6.30.3
+-- react@18.3.1
+-- stockfish@16.0.0
+-- typescript@5.9.3
+-- vite-plugin-pwa@0.20.5
+-- vite-plugin-static-copy@1.0.6
+-- vite@5.4.21
+-- vitest@2.1.9
`-- zustand@4.5.7
```

Exit code from `npm ls`: **1** (ELSPROBLEMS — five packages marked "invalid"). The "invalid" packages are cases where `package.json` was pinned to exact versions **lower** than what `node_modules/` contains. Affected: `@types/react`, `@types/react-dom`, `eslint`, `eslint-plugin-react-refresh`, `prettier`. A fresh `npm install` will either error or downgrade these.

### `npm run typecheck`

```
> mirror-pwa@0.1.0-stage0 typecheck
> tsc --noEmit
```

Exit 0.

### `npm run lint`

```
> mirror-pwa@0.1.0-stage0 lint
> eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0
```

Exit 0. No output (clean).

### `npm test`

```
> mirror-pwa@0.1.0-stage0 test
> vitest run

 RUN  v2.1.9 C:/Users/md200/OneDrive/Desktop/Chess/Product

 ✓ src/components/Board/Board.test.tsx (3 tests) 9ms
 ✓ src/state/gameStore.test.ts (3 tests) 7ms

 Test Files  2 passed (2)
      Tests  6 passed (6)
   Start at  22:38:07
   Duration  634ms
```

Exit 0. 6/6 tests pass across 2 files.

### `npm run build`

```
> mirror-pwa@0.1.0-stage0 build
> tsc --noEmit && vite build

vite v5.4.21 building for production...
transforming...
✓ 56 modules transformed.
rendering chunks...
computing gzip size...
dist/registerSW.js                          0.13 kB
dist/manifest.webmanifest                   0.50 kB
dist/index.html                             0.78 kB │ gzip:  0.45 kB
dist/assets/stockfish.worker-C3GRQuJ4.js    1.34 kB
dist/assets/index-C_CFXwsU.css              4.74 kB │ gzip:  1.56 kB
dist/assets/index-CPh9f0CY.js             312.47 kB │ gzip: 97.59 kB
[vite-plugin-static-copy] Copied 12 items.
✓ built in 1.32s

PWA v0.20.5
mode      generateSW
precache  27 entries (3114.18 KiB)
files generated
  dist/sw.js
  dist/workbox-9c191d2f.js
```

Exit 0.

---

## SECTION 3 — File inventory

Line counts are from `Get-Content | Measure-Object -Line`. Dates are last-modified.

### `src/`

```
src\App.tsx                            31 lines    2026-05-22
src\main.tsx                           13 lines    2026-05-22
src\vite-env.d.ts                       1 line     2026-05-22   ◀ flag: <10 lines (intentional — vite types ref)
src\components\Board\Board.tsx         87 lines    2026-05-22
src\components\Board\Board.test.tsx    99 lines    2026-05-26
src\engine\stockfish.worker.ts         94 lines    2026-05-22
src\engine\stockfishBridge.ts         121 lines    2026-05-22
src\routes\Home.tsx                    26 lines    2026-05-22
src\routes\Play.tsx                    74 lines    2026-05-22
src\routes\About.tsx                   66 lines    2026-05-26
src\state\gameStore.ts                142 lines    2026-05-22
src\state\gameStore.test.ts            27 lines    2026-05-22
src\styles\tokens.css                  39 lines    2026-05-22
src\styles\global.css                 252 lines    2026-05-22
```

Total src/: **14 files, 1072 lines**.

Notable absences relative to the v4 doc §3 repo structure: no `src/components/Calibration/`, `src/components/Mirror/`, `src/components/Coach/`, `src/components/Character/`, `src/components/Analysis/`, `src/data/`, `src/ml/`, `src/lib/`, `src/story/`. No `src/routes/Calibration.tsx`, `Profile.tsx`, `Mirror.tsx`, `Coach.tsx`, `DailyMirror.tsx`, `Story.tsx`. No `src/engine/mirror.ts`, `maia.worker.ts`, `motifClassifier.ts`. No `src/state/playerStore.ts`, `settingsStore.ts`, `calibrationStore.ts`.

### `docs/`

```
docs\phase-0-report.md                 174 lines    2026-05-26
docs\phase-1-plan.md                   341 lines    2026-05-26
docs\v2_strategy.html                  887 lines    2026-05-22   ◀ >500 lines (design doc, expected)
docs\v3_story.html                    1815 lines    2026-05-22   ◀ >500 lines (design doc, expected)
docs\v4_implementation.html           1934 lines    2026-05-22   ◀ >500 lines (design doc, expected)
docs\agent_briefs\README.md              6 lines    2026-05-22   ◀ <10 lines (stub, points back to v4 §7)
```

### `public/`

```
public\favicon.svg
public\robots.txt
public\_headers
public\icons\apple-touch-icon.png
public\icons\icon-192.png
public\icons\icon-512.png
```

No `public/engines/` directory (v4 §3 specifies one for stockfish + maia). Stockfish is copied into `dist/stockfish/` at build time via `vite-plugin-static-copy`; no Maia files anywhere.

### `supabase/`

**ABSENT.** The directory specified in v4 §3 (migrations, functions, seed) does not exist.

### Project root

```
.env.example
.eslintrc.cjs
.gitignore
.prettierrc
CODING_AGENT_GUIDE.md
LICENSE                  (662 lines — full AGPL-3.0 text, NOT a stub)
README.md
SETUP.md
index.html
package.json
package-lock.json
tsconfig.json
tsconfig.node.json
vite.config.ts           (2026-05-26 modified)
vite-dev.log             (2026-05-26 — captured dev server output from an earlier session)
```

Directories at root: `.git`, `.github`, `docs`, `public`, `scripts`, `src` (+ ignored `node_modules`, `dist`). `scripts/` contains only `setup-stockfish.js`.

### Files referenced but missing

Searched src/ for references to known-planned modules; **none of these were found in any source file** (so they are not yet imported by anything):
- `calibration` / `Calibration` — 0 references in src/
- `styleVector` / `StyleVector` — 0 references in src/
- `indexedDB` / `IDBDatabase` / `idb` — 0 references in src/

This means the missing modules aren't dangling imports — they simply have not been built yet.

---

## SECTION 4 — Feature-by-feature status

### A · Foundation

| Item | Status | Evidence |
| --- | --- | --- |
| Vite + React + TypeScript scaffold | **DONE** | `npm run build` exits 0; `tsconfig.json`, `vite.config.ts`, `package.json` all present |
| PWA manifest and service worker | **DONE** | Build emits `manifest.webmanifest`, `sw.js`, `workbox-9c191d2f.js`. Manifest declared in `vite.config.ts` |
| Cloudflare `_headers` file | **DONE** | `public/_headers` exists and is copied to `dist/_headers` at build |
| Design tokens (`tokens.css`) | **DONE** | `src/styles/tokens.css` exists, 39 lines |
| Global styles | **DONE** | `src/styles/global.css` exists, 252 lines |
| GPL/license notices in About route | **DONE** | `src/routes/About.tsx` enumerates Stockfish GPLv3, chess.js BSD-2-Clause, react-chessboard MIT |
| LICENSE file with full AGPL-3.0 text | **DONE** | 662 lines, full canonical AGPL text. (Phase 0 report claim that this was a stub is now stale.) |
| GitHub Actions CI (typecheck + lint + build) | **DONE** | `.github/workflows/ci.yml` runs `npm ci`, `typecheck`, `lint`, `build` in that order, with `lint` between typecheck and build per the directive. Build artifact uploaded. |
| Production build succeeds and `dist/` populated | **DONE** | Verified this session — `dist/index.html`, `dist/assets/*`, `dist/stockfish/*` (12 items), `dist/sw.js` all present |

### B · Chess core

| Item | Status | Evidence |
| --- | --- | --- |
| Chess board renders | **UNKNOWN** | `Board.tsx` mounts `<Chessboard>` from react-chessboard; tests verify it receives correct props but no browser-render verification this session |
| Drag-to-move works | **UNKNOWN** | `onPieceDrop` delegates to `gameStore.makePlayerMove`; test confirms wiring but not visual interaction |
| Promotion piece chooser appears at 8th rank | **PARTIAL** | Code path exists (`onPromotionCheck` + `onPromotionPieceSelect` in `Board.tsx:47-75`); not exercised in any test or in this session |
| Castling kingside works | **UNKNOWN** | chess.js handles validation; no test, no runtime verification this session |
| Castling queenside works | **UNKNOWN** | Same as kingside |
| En passant works | **UNKNOWN** | chess.js handles; no test or runtime verification |
| Stalemate detected | **PARTIAL** | `gameStore.ts:45` checks `game.isStalemate()`; not exercised in tests |
| Threefold repetition detected | **PARTIAL** | `gameStore.ts:45` checks `game.isThreefoldRepetition()`; not exercised in tests |
| Insufficient material draw detected | **PARTIAL** | `gameStore.ts:45` checks `game.isInsufficientMaterial()`; not exercised in tests |
| 50-move rule detected | **PARTIAL** | `gameStore.ts:45` `game.isDraw()` covers it (chess.js fold) but not exercised |
| PGN export downloads valid file | **PARTIAL** | `Play.tsx:20-31` constructs Blob and clicks `<a download>`; `gameStore.test.ts:25-32` verifies the PGN string contains expected headers; download-trigger code path is not unit-tested |

### C · Engine

| Item | Status | Evidence |
| --- | --- | --- |
| Stockfish loads in Web Worker | **UNKNOWN** | `stockfishBridge.ts:25` constructs a Worker from `./stockfish.worker.ts`; worker uses `new Worker('/stockfish/stockfish-nnue-16-single.js')` (nested worker). Build copies file to dist/stockfish. Not exercised in this session. |
| Stockfish responds at depth 10 within 1 second | **UNKNOWN** | Cannot verify without runtime |
| CDN fallback fires when local file missing | **BROKEN** | The CDN fallback existed in earlier code but was **removed** in the worker rewrite. `stockfish.worker.ts` now only loads from `/stockfish/stockfish-nnue-16-single.js`; on failure it sends an error message and stops. No CDN URL present. |
| Skill level / Elo limit can be set via UCI options | **PLANNED** | No `setoption` for Skill Level or UCI_Elo anywhere in `stockfish.worker.ts` or `stockfishBridge.ts`. Bridge exposes only `getBestMove(fen, depth)` and `evaluatePosition(fen, depth)`. |
| Multi-PV (top N candidate moves) supported | **PLANNED** | No `setoption name MultiPV` anywhere. Bridge returns only the single best move + a running eval. |

### D · Calibration (Agent B / Phase 1)

| Item | Status | Evidence |
| --- | --- | --- |
| `calibrationStore` exists and is wired | **PLANNED** | No file `src/state/calibrationStore.ts` exists |
| All 8 task components exist | **PLANNED** | No `src/components/Calibration/` directory exists |
| `calibrationPositions.json` has all 8 tasks specified | **PLANNED** | File does not exist |
| Every position's "best move" verified by Stockfish at depth 14 | **PLANNED** | Verification cannot be performed: no positions file exists |
| Vyasa lines pass the specificity test | **PLANNED** | Lines are drafted in `docs/phase-1-plan.md` §3 but not yet in code |
| Task 8 uses isolated `calibrationOpponent.ts` | **PLANNED** | No `src/engine/calibrationOpponent.ts` exists |
| Soft and hard timers fire correctly | **PLANNED** | No timer code exists |
| In-progress calibration resumes after page reload | **PLANNED** | No persistence code exists |
| Calibration completes and writes a `style_vector` row | **PLANNED** | No storage layer exists |

### E · Style vector

| Item | Status | Evidence |
| --- | --- | --- |
| `styleVector.ts` exists with the StyleVector interface | **PLANNED** | No `src/ml/` directory exists |
| `computeStyleVector` never returns NaN under edge-case inputs | **PLANNED** | Function not implemented |
| Aggressive and defensive fixtures exist | **PLANNED** | No `src/ml/__fixtures__/` directory exists |
| Differentiation test asserts multiple behavioral fields differ | **PLANNED** | Test not implemented |
| `eloDetect` produces detected_elo and band correctly at all 4 boundaries | **PLANNED** | No `src/lib/eloDetect.ts` exists |
| `swindle_preference` correctly null when Task 5 skipped | **PLANNED** | Field not implemented; would live in unwritten `styleVector.ts` |

### F · Storage

| Item | Status | Evidence |
| --- | --- | --- |
| IndexedDB schema (`db.ts`) | **PLANNED** | No `src/data/db.ts` exists; no `idb` import anywhere in src/ |
| Schema upgrade path defined in `onupgradeneeded` | **PLANNED** | No db code at all |
| `source: 'tuned'` creates new row, never overwrites `source: 'calibration'` | **PLANNED** | Style-vector persistence not implemented |
| `previous_vector_id` field exists on `style_vectors` | **PLANNED** | Schema not implemented |

### G · UI — Style vector visualization

| Item | Status | Evidence |
| --- | --- | --- |
| `StyleVectorRadar` SVG component exists | **PLANNED** | No `src/components/Mirror/` directory exists |
| Desktop radar renders with 8 visible axes | **PLANNED** | Component not implemented |
| Drag-end on axis creates new tuned `style_vector` row | **PLANNED** | Component + storage not implemented |
| Mobile (viewport <600px) renders slider list instead of radar | **PLANNED** | Component not implemented |
| Plain-English summary line renders deterministically below | **PLANNED** | No `styleSummary.ts` exists |

### H · Routes

| Route | Status | Evidence |
| --- | --- | --- |
| `/` (Home) | **DONE** | `App.tsx:20` registers `<Route path="/" element={<Home />} />`; `Home.tsx:18` has `<Link to="/play">Begin</Link>` |
| `/play` (free play vs Stockfish) | **DONE** | `App.tsx:21`; `Play.tsx` mounts Board + sidebar + actions. Engine path UNKNOWN at runtime (see C). |
| `/calibration` | **PLANNED** | Not registered in `App.tsx`; no `Calibration.tsx` |
| `/profile` | **PLANNED** | Not registered; no `Profile.tsx` |
| `/about` (GPL notices) | **DONE** | `App.tsx:22`; `About.tsx` has the attribution sections |
| `/mirror` | **PLANNED** | Not registered; no `Mirror.tsx` |

### I · Mirror (Phase 2)

| Item | Status |
| --- | --- |
| `motifClassifier.ts` | **PLANNED** (no file) |
| `perturbPolicy.ts` | **PLANNED** (no file) |
| `mirror.ts` orchestrator | **PLANNED** (no file) |
| `SelfRecognitionTest` component | **PLANNED** (no file) |
| `ShareCard` PNG export | **PLANNED** (no file) |
| `/mirror` route and full flow | **PLANNED** (no route) |

### J · Beyond Phase 2

All **PLANNED**. No code present for: Coach (Gemini, Drona voice, puzzle drills), Daily Mirror loop, story system, chapter loader, theme toggle, character portraits, Supabase backend (`supabase/` directory absent), multiplayer.

---

## SECTION 5 — Open issues, known bugs, and drift

1. **`npm ls` reports 5 packages as `invalid`.** `package.json` pins exact versions BELOW what `node_modules/` has. Specifically: `@types/react@18.3.3` (have 18.3.29), `@types/react-dom@18.3.0` (have 18.3.7), `eslint@8.57.0` (have 8.57.1), `eslint-plugin-react-refresh@0.4.9` (have 0.4.26), `prettier@3.3.3` (have 3.8.3). A clean `npm install` will either error or downgrade. Either the pinned versions should be raised to installed versions, or `node_modules` should be reinstalled to match the pins.

2. **Stockfish CDN fallback was removed.** Earlier code in the bundle and earlier audit notes referenced a CDN fallback if the local Stockfish file 404'd. The current `src/engine/stockfish.worker.ts` (94 lines) has no CDN URL. If `/stockfish/stockfish-nnue-16-single.js` fails to load (e.g., deploy without the static-copy step, or path mismatch), the engine emits an error and the user cannot play. This is a deliberate design change but worth noting.

3. **`docs/phase-0-report.md` contains stale claims that the audit contradicts.** Specifically, §7.6 of that report said *"LICENSE is a stub."* — the file is now the full 662-line canonical AGPL text. The audit-update banner at the top of the report (line 7) acknowledges this. The report should be cleaned or marked superseded.

4. **`docs/phase-1-plan.md` says implementation has begun** (line 8: *"This plan no longer blocks on approval. Implementation proceeds in the exact sequence locked by the human."*). **No Phase 1 implementation has happened.** Zero source files referenced by that plan exist on disk. Reader of the plan would expect commits and code that are not there.

5. **`docs/agent_briefs/README.md` (6 lines) is a stub.** Points back to v4 §7 and says "Use this folder for extracted per-agent Markdown briefs as the project moves past Agent A." No briefs extracted yet.

6. **Initial commit (`2f38c61`) has placeholder author.** `Agent <agent@example.com>`. Cosmetic but worth knowing for any future contribution attribution checks.

7. **One staged change uncommitted: `docs/phase-1-plan.md`.** It was modified externally (the plan was edited with a "Locked implementation update" preamble). It is staged but not committed.

8. **Node version mismatch between dev (25.6.0) and CI (20).** CI specifies Node 20 in `ci.yml`. Locally I am running 25.6.0. The v4 doc specifies Node 20 LTS. Possible silent compatibility issues are not blocking now but should be watched.

9. **TODO in `src/routes/About.tsx:58`**: `{/* TODO: add real repo URL after gh repo create */}`. Placeholder `https://github.com/` link still present. Documented in commit `d3f14b1`.

10. **No `public/engines/` directory.** v4 §3 specifies it (with subdirectories for `stockfish/` and `maia/`). The Stockfish files are copied from `node_modules` to `dist/stockfish/` at build time via `vite-plugin-static-copy`, so they reach the served output, but the source-side structure differs from spec. No Maia files anywhere — expected for Phase 0/1, but spec deviation worth flagging since Phase 2 will need them.

11. **`supabase/` directory absent.** v4 §3 specifies it (migrations, functions, seed). Phase 0 used IndexedDB only and Supabase is Stage 1+ work, so this is expected, but worth flagging that nothing exists yet.

12. **CI uses `node-version: '20'` and `branches: [main]`** but the local branch is `master`, so CI's `push` trigger will never fire on this repo until either the branch is renamed or the workflow is updated. Pull-request trigger still works.

13. **No live game-end testing.** Code paths for stalemate, threefold repetition, insufficient material, 50-move rule, and promotion picker exist in `gameStore.ts` and `Board.tsx`, but no test exercises any of them. The two tests that exist cover (a) start-a-white-game, (b) resign, (c) export PGN, and three Board-rendering assertions.

14. **No end-to-end engine test.** Nothing in the test suite verifies that Stockfish actually loads, becomes ready, and returns a move. `npm test` passes without ever running the engine.

---

## SECTION 6 — Time accounting

- **Total commits to master:** 3
- **Date of first commit:** 2026-05-22 07:18 IST (`2f38c61`)
- **Date of most recent commit:** 2026-05-26 22:30 IST (`d3f14b1`)
- **Phase tags reached:** `v0.1.0-stage0-baseline` only. No `v0.2.0-agent-b`.
- **Calendar days from first commit to now:** 4
- **Approximate codebase breakdown (by tracked src/ line count, 1072 total):**
  - Foundation / Agent A scope (Vite scaffold, routes Home/Play/About, Board, gameStore, Stockfish bridge & worker, styles): **~1072 lines, ~100%**
  - Calibration / Agent B scope: **0 lines, 0%**
  - Anything beyond Agent B (Mirror, Coach, Story, etc.): **0 lines, 0%**

---

## SECTION 7 — Honest assessment

**1. What is genuinely working.** A real chess player can open `npm run dev`, see the Home page with a Begin button, click into `/play`, start a game as White, Black, or random side, drag pieces, see Stockfish respond (assuming the worker initializes — see unknowns), have promotion offer a piece picker, resign, and download a PGN. The About page enumerates third-party licenses. The build pipeline (typecheck → lint → tests → build) is clean and reproducible. The PWA manifest is generated; service worker precaches assets. That is the entire current product surface.

**2. What looks done on paper but I would not yet trust a stranger with.** Three things specifically. First, none of the chess game-end conditions (stalemate, threefold, insufficient material, 50-move) have been exercised by a test or by a verified play-through this session — the code path exists but I cannot say from this audit that it correctly classifies any of them. Second, the Stockfish engine subsystem: the worker was rewritten to spawn a nested worker pointed at `stockfish-nnue-16-single.js`, the CDN fallback was removed, and there is no automated test that the engine ever becomes ready and emits a move. The reported `npm run dev` ran without the engine being interactively used in this audit. If the file path drifts or the nested-worker pattern breaks under some browser, the user gets a non-responsive board with no fallback. Third, the Phase 1 plan document is written as if implementation is in progress, but no Phase 1 code exists. The plan should not be read as a status report.

**3. The single biggest unknown.** Not the absence of Phase 1 code (which is honest absence). The biggest unknown is whether **Maia weights running in the browser via lc0-wasm will actually load and perform within the latency budget the Mirror needs**. v4 §1 lists `lc0-wasm v0.30.x` plus 50MB Maia weight files per band, cached in service worker. None of this is installed. None of this is tested. Stage 0 / Stage 1 / Stage 2 all rest on the Mirror feeling human, and the Mirror's base layer is Maia. If Maia weights are too slow in WASM, too large to ship to mobile, or the lc0-wasm bridge is harder to wire than Stockfish was, the Mirror generator collapses and the calibration we are about to build feeds nothing useful. This is currently the single largest piece of execution risk in the v2 strategy and nothing in the current codebase begins to test it.

---

## SECTION 8 — Next gate

- **Next milestone tag:** `v0.2.0-agent-b`.
- **Single concrete acceptance criterion:** a user can run `npm run dev`, navigate Home → Begin Calibration → complete 8 tasks → land on `/profile` with a populated StyleVector radar (or sliders on mobile), reload, see the radar still there, drag an axis, see the vector update; two run-throughs with deliberately different styles produce visibly different summaries. (Underlying gates: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` all exit 0 with the new code, and the differentiation test asserts multiple behavioral fields differ between aggressive and defensive fixtures.)
- **Honest estimate of working days until that gate, if nothing surprises me:** 5–7 focused working days at ~5–6 hours each. The plan in `docs/phase-1-plan.md §10` budgeted ~30–35 hours. That estimate still looks right.
- **What I would do if something surprises me:** if the surprise is the Stockfish worker actually being broken under the new nested-Worker pattern (i.e., Phase 1 can't even use the engine for Task 8 position verification or the calibration match), I'd stop, restore the CDN fallback as a Phase 0.5 fix, get the engine back to verifiable working, then resume. If the surprise is in `idb`/IndexedDB behavior (Phase 1 storage), I'd add a small smoke test before continuing — the cost of debugging persistence bugs against a half-built calibration UI is much higher than a one-hour smoke test. If the surprise is the Maia question above (which would only surface in Phase 2), I'd stop and force a spike: load Maia weights in a worker, measure latency, decide whether to keep Maia or fall back to a perturbed-Stockfish-only Mirror. The whole staging plan depends on that question; better to learn the answer in week 2 than week 12.
