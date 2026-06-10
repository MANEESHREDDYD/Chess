# Engine Verification

**Date:** 2026-06-10

## Result

PASS

## Method

- Started or reused a local Vite dev server at `http://127.0.0.1:5173/play`.
- Opened the app in Chromium through Puppeteer.
- Imported `src/engine/stockfishBridge.ts` from the page context.
- Verified `waitForEngine()`, `getBestMove()`, `getCandidateMoves()`, `evaluatePosition()`, repeated searches, and `runStockfishHealthCheck()`.
- Started a regular chess game as Black and verified Stockfish makes the first White move without leaving the UI stuck in an engine-thinking state.
- Built the app and ran a Vite preview browser check against `/play?stockfishBootCheck=1`.
- Verified regular engine play as White does not show blocking `Engine unavailable` before the first move, Stockfish replies after White moves, and player-as-Black still receives Stockfish's first White move.
- Verified boot diagnostics include `worker_booted`, `stockfish_script_loaded`, `uciok_received`, `readyok_received`, and `first_bestmove_received`.

## Stability Script

```bash
npm run stockfish:stability
```

Equivalent direct command:

```bash
node scripts/run-stockfish-stability-check.mjs
node scripts/run-stockfish-browser-boot-check.mjs
```

The script validates:

- local Stockfish worker startup
- production-preview worker asset URL startup
- immediate outer-worker heartbeat
- local Stockfish JS/WASM asset reachability
- UCI readiness before search
- candidate and evaluation output
- player-as-Black first engine move
- player-as-White first move remains playable before Stockfish responds
- duplicate/repeated search serialization
- isolated health checks using fresh workers
- first bestmove from the built preview app

## Gates

- `npm run typecheck` - pass
- `npm run lint` - pass
- targeted engine lifecycle tests - pass
- `node scripts/run-stockfish-stability-check.mjs` - pass
- `node scripts/run-stockfish-browser-boot-check.mjs` - pass
