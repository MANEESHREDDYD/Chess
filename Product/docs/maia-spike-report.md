# Maia Spike Report

Date: 2026-05-29
Branch: `spike/maia-feasibility`
Verdict: DEGRADED

## Executive summary

- Chrome desktop can load Maia 1500 in a Web Worker via `@lichess-org/zerofish` and return a legal move well inside the target latency.
- iOS Safari was not measured in this session because this Windows machine has no Safari, iOS simulator, `simctl`, or `xcrun`; therefore the full cross-device PASS bar is not met.
- Recommendation for MVP M2: use Stockfish `UCI_LimitStrength` / `UCI_Elo` as the shippable base layer, and keep Maia as a deferred/optional path unless the human confirms iOS Safari on-device.

## Candidate tested

Primary candidate:

- Engine wrapper: `@lichess-org/zerofish@0.0.40`
- Browser engine assets from npm tarball:
  - `zerofish.js`
  - `zerofishEngine.js`
  - `zerofishEngine.wasm`
- Weight file: CSSLab `maia-1500.pb.gz`
- Runtime mode: `go nodes 1`, matching Maia/Lc0 guidance

Sources checked:

- CSSLab Maia repo: https://github.com/CSSLab/maia-chess
- CSSLab Maia 1500 release file: https://github.com/CSSLab/maia-chess/releases/download/v1.0/maia-1500.pb.gz
- Lc0 human sparring network list: https://lczero.org/play/networks/sparring-nets/
- Zerofish repo/package: https://github.com/lichess-org/zerofish and https://www.npmjs.com/package/@lichess-org/zerofish

The package named `lc0-wasm` was checked with `npm view lc0-wasm` and returned npm 404, so it is not a viable dependency name today.

## Temporary harness

No production dependency was added and no source code was changed for this spike. The measurement harness was created under:

`%TEMP%\mirror-maia-spike\site`

It served a static page with COOP/COEP/CORP headers, created a module Web Worker, imported Zerofish, loaded decompressed Maia 1500 weights, and called `goZero(..., { nodes: 1 })`.

The harness used Chrome DevTools Protocol polling for real wall-clock behavior. A virtual-time `--dump-dom` attempt was also tried and falsely timed out while `makeZerofish()` was still starting, so those virtual-time numbers were discarded.

## Chrome desktop result

Environment:

- OS: Windows 11 Pro 10.0.26200, 64-bit
- Node: v25.6.0
- Chrome: 148.0.7778.179
- RAM visible to OS: 33,025,772 KB

Measured FEN:

`rn1qkbnr/ppp2ppp/3p4/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3`

Result:

| Metric | Result | Target | Status |
| --- | ---: | ---: | --- |
| Engine wrapper startup | 27.05 ms | cold < 8,000 ms | PASS |
| Maia 1500 raw weight bytes | 1,738,564 bytes | delivered <= 60 MB | PASS |
| Maia 1500 gz download bytes | 1,258,199 bytes | delivered <= 60 MB | PASS |
| Weight fetch from local static server | 15.58 ms | informational | PASS |
| First Maia move at nodes=1 | 184.21 ms | warm move < 800 ms | PASS |
| Warm Maia move at nodes=1 | 2.62 ms | warm move < 800 ms | PASS |
| First bestmove | `f1c4` | legal move | PASS |
| Warm bestmove | `f1c4` | legal move | PASS |
| Chrome process working set after keeping worker resident | 581,357,568 bytes | informational | CAUTION |
| Chrome process private bytes after keeping worker resident | 412,426,240 bytes | informational | CAUTION |

Raw successful CDP result:

```json
{
  "ok": true,
  "engineReadyMs": 27.049999998882413,
  "weightFetchMs": 15.575000001117587,
  "weightBytes": 1738564,
  "weightBufferBytes": 1738564,
  "firstMoveMs": 184.2050000000745,
  "warmMoveMs": 2.6200000010430813,
  "firstBestmove": "f1c4",
  "warmBestmove": "f1c4",
  "totalMs": 229.589999999851
}
```

## iOS Safari result

Status: UNKNOWN

I could not measure iOS Safari from this machine. The command check for local Safari/iOS tooling returned no `safari`, `simctl`, or `xcrun` executable. This means the full milestone requirement "Chrome desktop AND iOS Safari" is not satisfied in this session.

To turn this into PASS, the human needs to run the same harness or a committed equivalent on an iPhone/iPad Safari build with real service-worker/PWA headers. The critical observations to capture are:

- Does module Worker plus WASM load under iOS Safari?
- Does COOP/COEP isolation behave in the deployed host on iOS?
- Does the first nodes=1 Maia move return under 800 ms after weights are resident?
- Does memory pressure remain acceptable on older iPhones?

## Integration caveats

1. `@lichess-org/zerofish` is AGPL-3.0-or-later, compatible with this app's AGPL posture but still a dependency-license commitment.
2. Zerofish documents LC0 as CPU-only OpenBLAS/Eigen and warns that only low block/filter-size networks are appropriate. Maia 1500 worked here, but this is not a general "any Lc0 net works" result.
3. Calling `engine.quit()` threw `TypeError: w.quit is not a function` in the harness after a successful first move. The harness used `engine.stop()`/worker termination instead. Production integration would need a defensive lifecycle wrapper.
4. Chrome process memory with the worker kept resident was roughly 581 MB working set / 412 MB private bytes. That may be acceptable on desktop but is the main reason iOS must be measured before making Maia the default base layer.
5. Maia at nodes=1 is deterministic for a fixed FEN unless we add opening-book or perturbation behavior. That is acceptable for a base layer only if M2's style reranking and opportunistic weakness probing introduce variety.

## Verdict against M1 criteria

| Criterion | Result |
| --- | --- |
| Cold start < 8s | PASS on Chrome desktop |
| Warm move < 800ms | PASS on Chrome desktop |
| Weights <= 60MB | PASS |
| Chrome desktop | PASS |
| iOS Safari | UNKNOWN |

Overall verdict: DEGRADED.

## Architecture decision recommendation

For MVP M2, choose:

`Mirror = Stockfish UCI_LimitStrength/UCI_Elo + style reranking + opportunistic weakness probing`

Reason: the Chrome Maia result is promising, but the required iOS Safari measurement is missing and the resident memory footprint is large enough to threaten PWA reliability on mobile. Stockfish-only is the safer cross-device MVP base and still supports the wedge: the Mirror's recognizability comes from style reranking and the deterministic explanation line, not from Maia alone.

If the human can verify iOS Safari quickly and accepts the memory cost, Maia can be reconsidered as:

`Mirror = Maia base + style reranking + opportunistic Stockfish`

but I do not recommend making that the default without the iOS device check.

## Checkpoint request

Please confirm one architecture for M2:

1. Recommended: Stockfish-only base for MVP, with Maia deferred.
2. Conditional: Maia base only after a real iOS Safari pass.

I will not begin M2 until this checkpoint is confirmed.
