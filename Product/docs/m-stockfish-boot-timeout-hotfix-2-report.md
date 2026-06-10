# M-STOCKFISH-BOOT-TIMEOUT-HOTFIX-2 Report

**Date:** 2026-06-10  
**Tag:** `v1.19.3-stockfish-boot-timeout-hotfix-2`

## Reproduced Bug

Regular engine play could show:

```text
ENGINE_BOOT_TIMEOUT: Stockfish worker did not become ready in time after 8000ms.
The worker did not report ready after UCI startup.
```

The reported user flow was:

- Match
- You play: White
- Opponent: Stockfish (Club)
- Theme: Kurukshetra
- Status: Engine unavailable

## Exact Failing Phase

The new browser preview check reproduced the failure before UCI startup:

- `worker_constructing` succeeded.
- `worker_constructed` succeeded.
- `worker_booted` was never received.
- `stockfish_script_loading` was never received.
- `uciok_received` was never received.
- `readyok_received` was never received.

The worker URL in the failing production preview path was a generated `data:video/mp2t;base64,...` URL. The browser constructed the worker but crashed it before the top-level worker heartbeat could run.

## Root Cause

`stockfishBridge.ts` stored `new URL('./stockfish.worker.ts', import.meta.url)` in a constant and later passed that constant into `new Worker(...)`.

Vite did not rewrite that indirect worker URL the same way it rewrote inline worker construction in other files. In production preview, the bridge received an unsafe data URL with an incorrect MIME shape for a module worker. The outer Stockfish wrapper worker crashed before posting `{ type: "worker_booted" }`.

The previous stability milestone did not catch this because its main check used the dev server and imported `/src/engine/stockfishBridge.ts` directly. That did not prove the built/preview worker URL emitted by Vite.

## Worker / Asset / WASM Fix

- Replaced the indirect worker URL with Vite's `?worker&url` asset import.
- Stockfish bridge now constructs the outer worker from the Vite-emitted worker asset URL.
- Pinned browser Stockfish assets under `public/stockfish`.
- Postinstall now refreshes the exact required assets:
  - `stockfish-nnue-16-single.js`
  - `stockfish-nnue-16-single.wasm`
  - `stockfish-nnue-16-no-simd.js`
  - `stockfish-nnue-16-no-simd.wasm`
- The worker runtime now uses local SIMD first and local no-SIMD second.
- The old CDN fallback was removed from this path to keep the engine local-first.
- The Stockfish package already logs and falls back from streaming WASM compilation to ArrayBuffer instantiation; MIRROR now also probes local WASM reachability and MIME for diagnostics.

## UCI Readiness Fix

- Removed the previous fake ready fallback that marked the worker ready without `readyok`.
- The engine is considered ready only after real `readyok`.
- Boot is now broken into phase-specific deadlines:
  - `WORKER_SCRIPT_TIMEOUT`
  - `STOCKFISH_ASSET_LOAD_TIMEOUT`
  - `UCI_OK_TIMEOUT`
  - `READY_OK_TIMEOUT`
  - `FIRST_SEARCH_TIMEOUT`
- Failures include phase, elapsed time, worker URL/source, environment, user agent, raw error, WASM reachability, `uciok` flag, `readyok` flag, timeline, and recent raw messages.

## Player-As-White UI Fix

Player-as-White remains playable before Stockfish responds. The engine is only required after the user makes the first move. The new preview check verifies:

- White game starts without blocking `Engine unavailable`.
- White can make `e2e4`.
- Stockfish replies locally.

Player-as-Black still requires engine boot because Stockfish must make the first White move; this path is also verified.

## Diagnostics Added

New route:

```text
/stockfish-diagnostics
```

It can:

- Run boot check.
- Run UCI check.
- Run first move check.
- Show worker URL/source.
- Show boot phase timeline.
- Show recent raw engine messages.
- Copy diagnostics JSON.

Diagnostics are local only and do not include secrets or uploaded gameplay data.

## Browser Build / Preview Verification

New script:

```bash
node scripts/run-stockfish-browser-boot-check.mjs
```

It builds if needed, starts Vite preview, opens `/play?stockfishBootCheck=1` in Chromium, verifies White and Black regular engine flows, checks Stockfish asset reachability, and asserts the required boot phases are present.

## Remaining Risks

- Extremely slow devices may still hit phase-specific timeouts, but the failure will now name the exact phase instead of collapsing into a vague boot timeout.
- The regular Play route still auto-starts a random game on first load; the browser check intentionally overrides this via a query-gated test hook.
- Calibration still has its own smaller Stockfish wrapper; the shared regular/Mirror/review engine now has stronger production-preview coverage.
