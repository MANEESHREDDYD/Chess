# Test Review - 2026-05-29

Phase: review findings with Phase 2 fix status appended.

## Executive summary

- Overall release-readiness verdict after Phase 2: green. The review tests that originally failed now pass without weakening or deleting them.
- BLOCKERs found: 0. HIGH issues found: 5; all HIGH/MEDIUM/LOW review items B01-B16 are fixed or documented in the commit listed below.
- Biggest remaining risk: Stockfish is still a shared worker by design, so future consumers must keep configuring/resetting engine options explicitly.

## Review scope and commands

- Reviewed every file under `src/`: 68 files after adding review tests.
- Reviewed every file under `scripts/`: 6 files.
- Search passes used: async/worker lifecycle, DEBUG/TODO markers, IndexedDB, Stockfish option names, timers, downloads, URL lifecycle, route copy, and unused seam references.
- Gates from the Phase 1 review session:
  - `npm run typecheck`: exit 0.
  - `npm run lint`: exit 0.
  - `npm test`: exit 1, with 87 passing tests and 3 failing tests.
  - `npm run build`: exit 0. Vite built 87 modules; PWA precache reported 53 entries, 10201.57 KiB.
- Final Phase 2 gates:
  - `npm run typecheck`: exit 0.
  - `npm run lint`: exit 0.
  - `npm test`: exit 0, with 24 test files and 100 passing tests.
  - `npm run build`: exit 0. Vite built 87 modules; PWA precache reported 53 entries, 10203.18 KiB.

## Bugs found

| ID | Severity | Location | Description | Why it is a bug | Test coverage | Fix status |
| --- | --- | --- | --- | --- | --- | --- |
| B01 | HIGH | `src/engine/stockfishBridge.ts:53`, `src/engine/stockfishBridge.ts:65`, `src/engine/stockfishBridge.ts:77` | Worker error events are only logged; readiness waiters reject only after the generic timeout. | A real worker load error looks like "did not become ready in time", delaying diagnosis and leaving UI flows stalled until timeout. | `src/engine/stockfishBridge.lifecycle.test.ts` now covers never-ready timeout and immediate error rejection. | Fixed in `03eacb7`. |
| B02 | HIGH | `src/engine/mirrorOpponent.ts:136`, `src/engine/mirrorOpponent.ts:140`, `src/engine/mirrorOpponent.ts:180`, `src/state/gameStore.ts:115` | Mirror configures the shared Stockfish worker but dispose does not reset/terminate those strength options before `/play` uses the same bridge. | Free play can inherit Mirror's low-strength UCI/Skill settings after visiting `/mirror`, making "Stockfish depth 10" misleading and route state cross-contaminated. | `src/engine/mirrorOpponent.lifecycle.test.ts:79`. | Fixed in `f65610a`. |
| B03 | HIGH | `src/engine/mirrorOpponent.ts:158`, `src/engine/mirrorOpponent.ts:161`, `src/engine/stockfish.worker.ts:193` | Non-finite depth can pass through to `getCandidateMoves` and then to the worker as `go depth NaN`. | Any bad caller option can make the engine command invalid and return no move or hang. | `src/engine/mirrorOpponent.lifecycle.test.ts:63`. | Fixed in `f65610a`. |
| B04 | HIGH | `src/routes/Mirror.tsx:78`, `src/routes/Mirror.tsx:321`, `src/routes/Mirror.tsx:671` | Temporary DEBUG instrumentation is still visible and logged on `/mirror`. | Release UI exposes debug internals and noisy console output; it was intentionally marked for removal before v1.0.0. | Confirmed by source grep; no DEBUG markers remain in `Mirror.tsx`. | Fixed in `dbb6916`. |
| B05 | HIGH | `src/routes/Mirror.tsx:204`, `src/routes/Mirror.tsx:238` | `finishGame` sets `persistedRef.current = true` before IndexedDB writes complete. | If save fails halfway through, the route cannot retry persistence or export the match; this can lose the completed Mirror match and trace data. | `src/routes/Mirror.persistence.test.tsx`. | Fixed in `8db5aff`. |
| B06 | MEDIUM | `src/engine/stockfish.worker.ts:135`, `src/engine/stockfish.worker.ts:136` | Worker posts `uci`/`isready` and then marks ready after 1500ms even without `readyok`. | The main thread can send options/go while Stockfish is not actually ready, especially on cold starts. | `src/engine/stockfishWorkerRuntime.test.ts`. | Fixed in `2cc7916`. |
| B07 | MEDIUM | `src/engine/stockfish.worker.ts:82`, `src/engine/stockfish.worker.ts:121`, `src/engine/stockfish.worker.ts:154` | CDN fallback is fragile: fallback only fires from local inner-worker load errors, and the blob-imported CDN script may not resolve its WASM sibling correctly. | Local asset 404 or CDN/WASM path problems may still surface as a bridge timeout instead of a clean two-source failure. | `src/engine/stockfishWorkerRuntime.test.ts`. | Fixed in `2cc7916`. |
| B08 | MEDIUM | `src/engine/calibrationOpponent.ts:66`, `src/engine/calibrationOpponent.ts:86`, `src/engine/calibrationOpponent.ts:94`, `src/engine/calibrationOpponent.ts:124` | Calibration opponent has the same readiness weakness; dispose resolves waiters even when the worker is being torn down. | A task unmount during init can make `init` resolve against a disposed worker, then a later move can be sent before ready/configured. | `src/engine/calibrationOpponent.lifecycle.test.ts`. | Fixed in `bd24043`. |
| B09 | MEDIUM | `src/components/Calibration/Task3EndgameTechnique.tsx:72`, `src/components/Calibration/Task3EndgameTechnique.tsx:73`, `src/components/Calibration/Task3EndgameTechnique.tsx:110` | Task 3 async engine replies are not guarded against unmount or a finished game. | A stale reply can call state setters after unmount or after the task has completed. | `src/components/Calibration/Task3EndgameTechnique.test.tsx`. | Fixed in `1186418`. |
| B10 | MEDIUM | `src/components/Calibration/Task8VyasaMatch.tsx:63`, `src/components/Calibration/Task8VyasaMatch.tsx:72`, `src/components/Calibration/Task8VyasaMatch.tsx:127`, `src/components/Calibration/Task8VyasaMatch.tsx:128` | Task 8 can call `onComplete` on every render while game-over, and async engine replies are not cancelled. | Duplicate calibration submission and stale state updates are possible in timeout/game-over edges. | `src/components/Calibration/Task8VyasaMatch.test.tsx`. | Fixed in `b911219`. |
| B11 | MEDIUM | `src/state/calibrationStore.ts:104`, `src/state/calibrationStore.ts:111`, `src/state/calibrationStore.ts:202` | `submitTask(Number.NaN, ...)` persists `taskNaN` and sets `current_task_index` to `NaN`. | Store APIs should reject or sanitize non-finite task indexes; corrupt runs can break resume/completion logic. | `src/state/calibrationStore.edge.test.ts:15`. | Fixed in `f65610a`. |
| B12 | MEDIUM | `scripts/analyze_mirror_match.mjs:90`, `scripts/analyze_mirror_match.mjs:107`, `scripts/verify-calibration-positions.mjs:29`, `scripts/verify-calibration-positions.mjs:51`, plus other script communicators | Native Stockfish script `readUntil` helpers have no timeout or process error rejection. | If the CLI hangs or exits early, these verification scripts hang indefinitely. | Syntax-checked touched scripts; helper rejects on timeout/exit/error. | Fixed in `90b6df5`. |
| B13 | MEDIUM | `scripts/setup-stockfish.js:15`, `scripts/setup-stockfish.js:18`, `scripts/setup-stockfish.js:27`, `scripts/setup-stockfish.js:29` | Postinstall warns but exits 0 when required Stockfish files are missing. | Dependency install can appear successful while the primary engine asset is absent. | `node scripts/setup-stockfish.js` exits 0 with assets present and now exits 1 when assets are missing. | Fixed in `6d9eacd`. |
| B14 | MEDIUM | `src/routes/Mirror.tsx:112`, `src/data/db.ts:139`, `src/data/db.ts:144`, `src/data/db.ts:215` | `/mirror` loads the latest style vector by timestamp, not the player's `current_style_vector_id`. | If timestamps skew or a user deliberately rolls back a pointer, Mirror can load a non-current vector. | `src/data/db.test.ts` pointer-selection test. | Fixed in `504041e`. |
| B15 | LOW | `src/routes/Play.tsx:82`, `src/routes/About.tsx:8`, `src/routes/Home.tsx:14`, `src/App.tsx:32` | Copy still says Stage 0/no theme/Mirror next phase while Mirror and the theme exist. | Stale UX copy can confuse testers but does not break runtime behavior. | Source grep confirms active copy was refreshed. | Fixed in `6634971`. |
| B16 | LOW | `src/types/gameMode.ts:1`, `src/engine/stockfishBridge.ts:186` | Some exported seams/helpers are not imported by runtime code yet. | Intentional architecture seams, but future agents may mistake them for active contracts. | Source comments now mark seams/helpers as intentional future contracts. | Fixed in `76f8297`. |

## Tests added

| Area | File | Tests | Failure mode guarded |
| --- | --- | ---: | --- |
| Engine/worker lifecycle | `src/engine/stockfishBridge.lifecycle.test.ts` | 2 | Worker never reports ready -> bridge rejects after timeout; worker load error -> readiness rejects immediately with the real error. |
| Engine/worker runtime | `src/engine/stockfishWorkerRuntime.test.ts` | 3 | Ready waits for `readyok`; ready fallback logs when used; local asset failure falls through to the pinned CDN/WASM path. |
| Calibration engine lifecycle | `src/engine/calibrationOpponent.lifecycle.test.ts` | 2 | Worker load error and dispose-before-ready reject pending startup instead of resolving against a dead worker. |
| Mirror engine lifecycle | `src/engine/mirrorOpponent.lifecycle.test.ts` | 5 | Sub-1320 skill regime returns legal move; UCI regime returns legal move; empty MultiPV falls back to bestmove; non-finite depth is rejected/sanitized; Mirror disposal resets shared worker strength. |
| Mirror persistence | `src/routes/Mirror.persistence.test.tsx` | 1 | Failed IndexedDB match save does not latch persistence and can be retried. |
| Storage/current vector | `src/data/db.test.ts` | 1 | Player `current_style_vector_id` takes precedence over latest-by-timestamp vector selection. |
| Calibration async safety | `src/components/Calibration/Task3EndgameTechnique.test.tsx` | 1 | Late engine reply after unmount is ignored. |
| Calibration async safety | `src/components/Calibration/Task8VyasaMatch.test.tsx` | 1 | Game-over completion fires once across rerenders. |
| Calibration store | `src/state/calibrationStore.edge.test.ts` | 1 | Non-finite task index must not persist `taskNaN` or `NaN` current task state. |

Honest added-test count by area:

- Engine/worker lifecycle/runtime: 7.
- Mirror: 6.
- Calibration/storage edge and async safety: 4.
- Total review/fix tests counted here: 17.

Originally failing tests after Phase 1 review; all now pass:

- `src/engine/mirrorOpponent.lifecycle.test.ts > guards against non-finite depth before asking the worker for candidates`.
- `src/engine/mirrorOpponent.lifecycle.test.ts > does not leave the shared Stockfish worker strength-limited after disposal`.
- `src/state/calibrationStore.edge.test.ts > does not persist a taskNaN key or non-finite current task index`.

## File review table

| File | Reviewed | Issues found |
| --- | --- | --- |
| `src/App.tsx` | yes | B15 |
| `src/main.tsx` | yes | None |
| `src/vite-env.d.ts` | yes | None |
| `src/components/Board/Board.tsx` | yes | None |
| `src/components/Board/Board.test.tsx` | yes | Test gap: BoardView direct rendering not covered |
| `src/components/Board/BoardView.tsx` | yes | Possible future ResizeObserver fallback risk |
| `src/components/Calibration/Task1Tactical.tsx` | yes | None |
| `src/components/Calibration/Task2OpeningChoice.tsx` | yes | None |
| `src/components/Calibration/Task3EndgameTechnique.tsx` | yes | B09 |
| `src/components/Calibration/Task3EndgameTechnique.test.tsx` | yes | Happy-path only |
| `src/components/Calibration/Task4TacticalRace.tsx` | yes | None |
| `src/components/Calibration/Task5MoralChess.tsx` | yes | None |
| `src/components/Calibration/Task5MoralChess.test.tsx` | yes | None |
| `src/components/Calibration/Task6BlackRepertoire.tsx` | yes | None |
| `src/components/Calibration/Task7Exchange.tsx` | yes | None |
| `src/components/Calibration/Task8VyasaMatch.tsx` | yes | B10 |
| `src/components/Calibration/Task8VyasaMatch.test.tsx` | yes | Happy-path only |
| `src/components/Calibration/TaskBoardShell.tsx` | yes | None |
| `src/components/Calibration/TaskBoardShell.test.tsx` | yes | None |
| `src/components/Calibration/TaskButtonGrid.tsx` | yes | None |
| `src/components/Calibration/TaskButtonGrid.test.tsx` | yes | None |
| `src/components/Calibration/pieceIcons.tsx` | yes | None |
| `src/components/Calibration/taskData.ts` | yes | None |
| `src/components/Calibration/vyasaLines.ts` | yes | None |
| `src/components/Calibration/vyasaLines.test.ts` | yes | None |
| `src/components/Mirror/StyleVectorRadar.tsx` | yes | Possible malformed motif object could produce NaN in radar average |
| `src/components/Mirror/StyleVectorRadar.test.tsx` | yes | None |
| `src/components/Mirror/scoutingCard.ts` | yes | Canvas API is browser-only by design |
| `src/components/Mirror/scoutingCard.test.ts` | yes | None |
| `src/components/Mirror/selfRecognition.ts` | yes | None |
| `src/components/Mirror/selfRecognition.test.ts` | yes | None |
| `src/components/Mirror/styleSummary.ts` | yes | None |
| `src/data/calibrationPositions.json` | yes | None found in schema/content spot-check |
| `src/data/db.ts` | yes | B14 |
| `src/data/db.test.ts` | yes | B14 pointer-selection test added |
| `src/engine/calibrationOpponent.ts` | yes | B08 |
| `src/engine/mirrorOpponent.ts` | yes | B02, B03 |
| `src/engine/mirrorOpponent.test.ts` | yes | Existing truth-rule tests good; lifecycle gaps added separately |
| `src/engine/mirrorOpponent.lifecycle.test.ts` | yes | Review tests now pass after B02/B03 fixes |
| `src/engine/stockfish.worker.ts` | yes | B06, B07 |
| `src/engine/stockfishBridge.ts` | yes | B01, B02 |
| `src/engine/stockfishBridge.lifecycle.test.ts` | yes | New review test |
| `src/lib/eloDetect.ts` | yes | None |
| `src/lib/eloDetect.test.ts` | yes | None |
| `src/lib/theme.ts` | yes | Manifest shape is trusted, no runtime validation |
| `src/ml/__fixtures__/aggressiveCalibration.json` | yes | None |
| `src/ml/__fixtures__/defensiveCalibration.json` | yes | None |
| `src/ml/evolvingMirror.ts` | yes | None |
| `src/ml/evolvingMirror.test.ts` | yes | None |
| `src/ml/styleVector.ts` | yes | None |
| `src/ml/styleVector.test.ts` | yes | None |
| `src/routes/About.tsx` | yes | B15 |
| `src/routes/Calibration.tsx` | yes | None |
| `src/routes/Home.tsx` | yes | B15 |
| `src/routes/Mirror.tsx` | yes | B04, B05, B14 |
| `src/routes/Play.tsx` | yes | B15 |
| `src/state/calibrationStore.ts` | yes | B11 |
| `src/state/calibrationStore.test.ts` | yes | Existing happy-path coverage remains |
| `src/state/calibrationStore.edge.test.ts` | yes | Review test now passes after B11 fix |
| `src/state/gameStore.ts` | yes | B02 via shared bridge |
| `src/state/gameStore.test.ts` | yes | Missing invalid-engine-move/path test |
| `src/state/gameStore.endConditions.test.ts` | yes | None |
| `src/state/settingsStore.ts` | yes | Browser-only localStorage is acceptable for this Vite app |
| `src/styles/global.css` | yes | B15 copy is route text, not CSS |
| `src/styles/tokens.css` | yes | None |
| `src/test/setup.ts` | yes | None |
| `src/types/gameMode.ts` | yes | B16 |
| `src/types/opponent.ts` | yes | B16 comments now mark the seam as intentional |
| `scripts/analyze_mirror_match.mjs` | yes | B12 |
| `scripts/eval_post_move.mjs` | yes | B12 |
| `scripts/find_task5_candidates.mjs` | yes | B12 |
| `scripts/setup-stockfish.js` | yes | B13 |
| `scripts/smoke-skill-check.mjs` | yes | B12 |
| `scripts/verify-calibration-positions.mjs` | yes | B12 |

## Possible future bugs and fragile areas

- `BoardView` relies on `ResizeObserver` existing globally. Current target browsers support it, but tests do not cover the no-ResizeObserver path.
- Theme manifests are trusted after `fetch` without validating all 12 piece keys and board fields. A malformed `theme.json` degrades later during render rather than at load time.
- The Stockfish bridge has one global worker and request sequence. Phase 2 now resets Mirror strength and rejects startup errors honestly, but future routes still need explicit configure/reset discipline.
- `renderScoutingCardPng` depends on canvas and `toBlob`; browser support is good, but the component should keep graceful error messaging because this cannot run in SSR or old locked-down browsers.
- Script UCI helpers are now shared through `scripts/lib/uci-engine.mjs`; future scripts should use that helper rather than hand-rolled `readUntil` promises.
- Architecture seam files (`types/gameMode.ts`, `types/opponent.ts`, and the analysis helper in `stockfishBridge.ts`) are now explicitly documented as intentional, but not every runtime flow is adapted to those seams yet.

## Gate output summary

Final Phase 2 gate outputs:

`npm run typecheck`

```text
> mirror-pwa@0.1.0-stage0 typecheck
> tsc --noEmit
```

Exit code: 0.

`npm run lint`

```text
> mirror-pwa@0.1.0-stage0 lint
> eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0
```

Exit code: 0.

`npm test`

```text
Test Files  24 passed (24)
Tests       100 passed (100)
```

Exit code: 0. The three originally failing review tests now pass because the code was fixed.

`npm run build`

```text
vite v5.4.21 building for production...
87 modules transformed.
[vite-plugin-static-copy] Copied 12 items.
PWA v0.20.5
precache  53 entries (10203.18 KiB)
```

Exit code: 0.

## Phase 2 fix status

Completed in severity order:

1. Group 1 engine correctness: B02, B05, B01, B03 fixed in `f65610a`, `8db5aff`, and `03eacb7`.
2. Group 2 worker robustness: B06, B07, B08 fixed in `2cc7916` and `bd24043`.
3. Group 3 calibration async safety and validation: B09, B10, B11 fixed in `1186418`, `b911219`, and `f65610a`.
4. Group 4 cleanup: B14, B04, B12, B13, B15, B16 fixed in `504041e`, `dbb6916`, `90b6df5`, `6d9eacd`, `6634971`, and `76f8297`.

No tests were weakened or deleted.
