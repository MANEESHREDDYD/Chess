# 3D Kurukshetra Technical Plan

This plan defines the future 3D visual track. It is design only; this milestone does not implement a full 3D battlefield.

## Milestone Sequence

- `M-3D-KURUKSHETRA-DESIGN-1`
- `M-3D-KURUKSHETRA-BOARD-1`
- `M-3D-KURUKSHETRA-PIECES-1`
- `M-3D-CAPTURE-FX-1`
- `M-3D-PERFORMANCE-POLISH-1`

## Recommended Stack

- Three.js or React Three Fiber, depending on compatibility with the existing Vite/React app.
- glTF/glb for optimized local assets.
- Local asset loading from committed, license-documented files.
- 2D board fallback for lower-end devices and reduced-motion users.
- Performance budget before realism: stable frame rate, small assets, mobile fallback.

## Asset Rules

- No copyrighted models or textures.
- No paid assets unless explicitly approved.
- Every asset needs source, license, and author notes.
- AI-generated assets must record prompt, tool/source, date, and license assumptions.
- Sacred/religious parody is not allowed.
- Graphic gore is not allowed.
- Kids mode must soften effects.

## Visual Scope

Start stylized and optimized before aiming for realism:

- battlefield background plane with sand, rocks, banners, and dust ambience
- 3D board geometry with readable squares
- low-poly soldier-like piece silhouettes mapped clearly to chess pieces
- move animations with path arcs
- capture effects that are cinematic but non-gory
- check/checkmate lighting and camera emphasis
- camera controls with accessibility defaults
- reduced-motion mode

## Integration Risks

- Chessboard input hit-testing must remain exact.
- Legal move validation must stay in chess.js and existing stores, not in 3D scene code.
- Stockfish browser boot checks must remain independent of 3D rendering.
- Mobile and low-memory devices must fall back to 2D.
- Assets must not obscure piece identity or board coordinates.

## Verification Requirements

Future 3D milestones should include browser screenshots, canvas-pixel checks, desktop/mobile viewport checks, route smoke tests, reduced-motion checks, and fallback checks before any release tag.
