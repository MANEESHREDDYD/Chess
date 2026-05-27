# Maia Spike Report

Verdict: FAIL

## Scope

Phase 1.5 feasibility check for an lc0-wasm / Maia-based Mirror engine path.

## Candidate evaluation

1. `lc0-wasm` / `lc0-web` candidate
   - URL checked: `https://github.com/Mk-Chan/lc0-web`
   - Result: GitHub returned 404 page not found.
   - Status: unavailable for evaluation.

2. Maia browser demo candidate
   - URL checked: `https://patricklyster.com/maia-chess`
   - Result: DNS resolution failed (`ERR_NAME_NOT_RESOLVED`).
   - Status: unavailable for evaluation.

## Criteria check

The spike criteria were not met because no working browser candidate could be loaded to measure:

- cold-start < 8s
- first-move latency < 800ms warm
- weight file <= 60 MB delivered
- Chrome desktop compatibility
- iOS Safari compatibility

## Decision

Abandon the Maia path for Phase 1. Continue with the Stockfish-only Mirror assumption and resume the Phase 1 build order on `main`.
