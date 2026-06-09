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

## Stability Script

```bash
npm run stockfish:stability
```

Equivalent direct command:

```bash
node scripts/run-stockfish-stability-check.mjs
```

The script validates:

- local Stockfish worker startup
- UCI readiness before search
- candidate and evaluation output
- player-as-Black first engine move
- duplicate/repeated search serialization
- isolated health checks using fresh workers

## Gates

- `npm run typecheck` - pass
- `npm run lint` - pass
- targeted engine lifecycle tests - pass
- `node scripts/run-stockfish-stability-check.mjs` - pass
