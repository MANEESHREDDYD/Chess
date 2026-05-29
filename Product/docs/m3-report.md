# M3 Report — Strength Regime Fix + Re-analysis Pipeline

**Date:** 2026-05-29
**Status:** code merged on `main`, pushed. **Hold for human re-play before M4-CORE.**

---

## What was wrong

Pre-M3, `src/engine/mirrorOpponent.ts` configured the engine unconditionally:

```ts
await setOption('UCI_LimitStrength', true);
await setOption('UCI_Elo', clampElo(styleVector.detected_elo));
```

with `clampElo` defined as:

```ts
function clampElo(value: number): number {
  return Math.max(1320, Math.min(3190, Math.round(value)));
}
```

Two consequences fell out of that design:

1. **Sub-1320 detected_elo got floored at 1320.** Stockfish's `UCI_LimitStrength`
   accepts `UCI_Elo` only within `[1320, 3190]`. Every apprentice (detected_elo
   below 1200) and every low-initiate (1200–1319) faced an identical
   ~1320-strength base engine. The reranker on top of that floor was the only
   source of personalization at the low end of the band — the actual base
   strength didn't move at all from detected_elo 800 to 1319.

2. **The in-match trace could not validate "human-like."** Both
   `rerankedEngineScore` and `stockfishTopEngineScore` in the stored
   `mirror_moves` traces come from the same single weakened-engine call. They
   measure "played move vs weakened-multipv-1," not "played move vs
   full-strength engine top." Override frequency was the only signal the
   trace could provide; the actual centipawn distance to strong-engine play
   was not recorded anywhere.

The diagnostic snippet shipped earlier in this conversation was supposed to
extract the in-browser numbers to confirm (1) empirically before fixing.
Numbers did not arrive. The fix is structural — the bug exists regardless of
specific player data — so M3 went forward without empirical confirmation.

---

## Part 2 — the fix (commit `1b612bf`)

`mirrorOpponent.ts` now selects between two regimes via `mirrorEngineRegimeFor`:

```
detected_elo >= 1320 :  { regime: 'uci-limit', uciElo: clamp(detectedElo, 1320, 3190) }
detected_elo  < 1320 :  { regime: 'skill', skillLevel: 0..10, depthCap: 2..6 }
```

The `skill` regime ramps linearly from detected_elo 800 → 1319 across
`skillLevel 0 → 10` and `depthCap 2 → 6`. Worked examples:

| detected_elo | regime | engine settings sent | per-call depth |
| ---: | --- | --- | --- |
| 800 | skill | `UCI_LimitStrength=false`, `Skill Level=0` | capped at 2 |
| 1000 | skill | `UCI_LimitStrength=false`, `Skill Level=4` | capped at 4 |
| 1199 | skill | `UCI_LimitStrength=false`, `Skill Level=8` | capped at 5 |
| 1319 | skill | `UCI_LimitStrength=false`, `Skill Level=10` | capped at 6 |
| 1320 | uci-limit | `UCI_LimitStrength=true`, `UCI_Elo=1320` | uncapped (defaults to 8) |
| 1500 | uci-limit | `UCI_LimitStrength=true`, `UCI_Elo=1500` | uncapped |
| 2100 | uci-limit | `UCI_LimitStrength=true`, `UCI_Elo=2100` | uncapped |
| 3500 | uci-limit | `UCI_LimitStrength=true`, `UCI_Elo=3190` | uncapped |

Skill Level / depth choices match `calibrationOpponent.ts`'s shape, which has
been in production since the calibration phase. The reranker
(`rankMirrorCandidates`) runs identically on top of either regime — no
behavior change there.

Five new unit tests cover the floor boundary, the ceiling clamp, the linear
ramp, the sub-floor clamp, and non-finite input. Existing rerank / trace
tests are unchanged.

---

## Part 3 — the measurement (commit `54dbb08`)

`scripts/analyze_mirror_match.mjs` is a one-off Node script that re-evaluates
a stored Mirror match at fixed depth with `UCI_LimitStrength = false`. It
uses the native Stockfish CLI already bundled at
`tools/stockfish/stockfish/stockfish-windows-x86-64-avx2.exe`.

For each `metadata.mirror_moves` trace it:

1. Loads the `fenBefore` into Stockfish.
2. Calls `go depth 14` to get the **full-strength top move + cp**.
3. Calls `go depth 14 searchmoves <played>` to get the **played move's full-strength cp**.
4. Computes `gapCp = topCp - playedCp` (positive = Mirror played worse than full strength).

Reports per-move detail plus `avg / median / max` gap and an interpretation
guide:

```
~  0-30 cp : near-perfect engine (premise broken — reranker not creating human-like drop)
~ 30-80 cp : adept / master territory (within engine noise)
~ 80-200 cp: initiate territory (meaningful human-like deviation)
~ 200+ cp  : apprentice territory (visibly weaker than full-strength engine)
```

The expectation we're validating: **the avg gap should scale with the
player's band.** A 1200 player's Mirror should produce a bigger avg gap
than a 1700 player's. If the avg gap is in the 0–30 cp range across all
bands, the Mirror is still playing near-engine-perfect and the reranker is
not pulling it down toward human-like play — that's a deeper issue than the
1320 floor and would warrant a redesign of the reranker bias weights.

### Running it

In the browser, with the app open on any route, paste the export snippet
from the script's header comment into DevTools console. It copies the most
recent `mirror_matches` record to clipboard.

Then locally:

```sh
cd Product
node scripts/analyze_mirror_match.mjs path/to/match.json
```

Optional env:

- `STOCKFISH_PATH` — override the native binary path (default points at the
  bundled Windows AVX2 build under `tools/`).
- `ANALYSIS_DEPTH` — override the analysis depth (default 14, matching the
  depth used by `calibrationPositions.json` verification).

Each move analyzes in ~1–3 seconds on commodity hardware, so a 20-move game
takes a minute or two end-to-end.

---

## Why the order matters

Part 2 changes the engine the *next* Mirror game will play against. Part 3
re-analyzes a *past* game — but if you re-run Part 3 against a game from
*before* commit `1b612bf`, the trace will reflect the old, floored-at-1320
Mirror. The honest validation needs a freshly played game on `main` post-fix.

This is why M3 ends with **HOLD for human re-play before M4-CORE.** The
re-play is the empirical check that the regime split actually produced a
meaningful avg-gap-to-band relationship. Without that check, M4-CORE would
ship the MVP with the strength-floor fix unverified.

---

## What to do next

1. Pull `main` (commits `1b612bf` + `54dbb08`).
2. In the browser:
   - Clear the `mirror-pwa` IndexedDB so the regime fix runs from a clean
     base (DevTools → Application → IndexedDB → mirror-pwa → Delete).
   - `/calibration` → finish a run (or restore your existing run if you'd
     rather keep your style vector; the regime fix reads `detected_elo`
     at engine config time, so it picks up automatically).
   - `/mirror` → play one game to completion.
3. Export the stored `mirror_matches` record (snippet in the script header).
4. Run `node scripts/analyze_mirror_match.mjs path/to/match.json`.
5. Paste back the summary block (the `Avg cp gap` line is the headline).

Once those numbers land — and they look consistent with the player's band —
M3 closes, and M4-CORE begins.

If the avg gap is near zero (Mirror is still playing near-engine-perfect),
the reranker bias weights in `rankMirrorCandidates` need a separate pass
before we layer the MVP polish on top. Better to find that out now than at
the v1.0.0-mvp tag.

---

## Commits

- `1b612bf` — `fix(mirror): split base-strength regime at the UCI_Elo 1320 floor`
- `54dbb08` — `feat(scripts): add Mirror full-strength re-analysis script`
- _this report_ — `docs: M3 report`

All pushed to `origin/main`. Working tree clean. Four gates green:
typecheck, lint, 83/83 tests, build 53-entry precache.
