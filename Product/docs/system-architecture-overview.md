# MIRROR — System Architecture Overview

Updated: 2026-06-11 (M-MIRROR-FULL-FRONTEND-3D-BATTLEFIELD-EXPECTATION-LOOP-1)
Companion docs: `ARCHITECTURE.md`, `architecture-overview.md`, `data-architecture.md`.

## Layers

1. **Rules core** — chess.js. The ONLY legality authority. All boards (2D, 3D, Mirror,
   Clue, Story, Calibration) call into it via the game stores.
2. **Engine runtime** — Stockfish 16 WASM in a managed Web Worker (boot phases, readyok
   gating, serialized searches, one auto-restart, diagnostics UI at
   `/stockfish-diagnostics`).
3. **State** — zustand stores (`gameStore`, `playerStore`, `settingsStore`) over IndexedDB
   (local-first; optional Supabase auth/backup bridge).
4. **Presentation shell** — React Router routes inside the Nova shell, themed exclusively
   by the **MIRROR Apple Mono** token layer (`src/styles/mirrorAppleMono.css`, loaded last;
   black/white/graphite, blue primary, dark/light via `html[data-ui-theme]`).
5. **Board renderers** —
   - 2D: `react-chessboard` inside `BoardView` (stable `.board-stage` measurement,
     tournament-neutral Classic squares, functional blue/red interaction layer);
   - 3D: `src/three/` Kurukshetra Battlefield (three + @react-three/fiber, lazy chunk,
     procedural placeholder assets, WebGL/reduced-motion/error fallback to 2D).
   Both renderers are display-only and share the same move pipeline.
6. **Intelligence** — StyleVector calibration, Mirror personalities, Game Review Pro,
   Analytics dashboard, Clue adaptive training, deterministic local Coach (no runtime
   GenAI), plus the Python/SQL analytics layer over exported backups.
7. **QA harness** — browser-driven checks in `scripts/`: board interaction stability,
   complete frontend bug loop (12 routes × 2 themes × 7 viewports with defect assertions),
   3D performance/fallback/CDN-policy check, Stockfish stability/boot checks, and
   feature-level verification scripts. Screenshot artifacts live under `artifacts/`.

## Invariants

- Local-first: no required backend, no external CDN at runtime (enforced by the 3D check).
- Rendering layers never own rules; chess.js + stores stay authoritative.
- The app shell stays monochrome; warm tones only inside board squares / 3D scene.
- Every visual claim is backed by fresh screenshots from the QA harness.
- 3D assets ship only with licensing declared in `assets/3d/asset-manifest.json`
  (currently: procedural-only, zero binaries).
