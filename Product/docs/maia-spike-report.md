# Maia Spike Report

Date: 2026-05-29
Branch: `spike/maia-feasibility`
Verdict: DEGRADED
Human checkpoint decision: Stockfish-only base for MVP; Maia deferred.

## Result

Chrome desktop can load Maia 1500 in a Web Worker through `@lichess-org/zerofish` and return a nodes=1 move inside the target latency. The measured first move was `f1c4` from:

`rn1qkbnr/ppp2ppp/3p4/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3`

Measured on Chrome 148 / Windows 11:

| Metric | Result | Target | Status |
| --- | ---: | ---: | --- |
| Engine wrapper startup | 27.05 ms | cold < 8,000 ms | PASS |
| Maia 1500 raw weight bytes | 1,738,564 bytes | delivered <= 60 MB | PASS |
| Maia 1500 gz download bytes | 1,258,199 bytes | delivered <= 60 MB | PASS |
| First Maia move at nodes=1 | 184.21 ms | warm move < 800 ms | PASS |
| Warm Maia move at nodes=1 | 2.62 ms | warm move < 800 ms | PASS |
| Chrome resident working set | 581,357,568 bytes | informational | CAUTION |

The iOS Safari requirement was not verified because this Windows machine has no Safari, iOS simulator, `simctl`, or `xcrun`.

## MVP decision

The MVP Mirror will use:

`Stockfish UCI_LimitStrength / UCI_Elo + style reranking + opportunistic weakness probing`

No Maia package and no `@lichess-org/zerofish` dependency will be added to the MVP.

## Deferred upgrade gate

Maia is deferred, not dropped. It is a post-MVP base-layer upgrade gated on a real iOS Safari on-device pass:

- first nodes=1 move returns in <800 ms after warm start
- the Safari tab is not killed under normal PWA use
- COOP/COEP isolation holds on the deployed host

If that gate passes, Maia swaps in behind the existing `OpponentProvider` contract. M2's Mirror logic should not need to be rewritten.

## References

- Spike branch retained for future swap: `spike/maia-feasibility`
- CSSLab Maia repo: https://github.com/CSSLab/maia-chess
- Maia 1500 weights: https://github.com/CSSLab/maia-chess/releases/download/v1.0/maia-1500.pb.gz
- Lc0 human sparring networks: https://lczero.org/play/networks/sparring-nets/
- Zerofish package/repo: https://www.npmjs.com/package/@lichess-org/zerofish and https://github.com/lichess-org/zerofish
