# MIRROR — The Apprentice

A chess prototype where the final opponent is built from how you play. This commit ships **Agent A** from `docs/v4_implementation.html` — the foundation: PWA shell, chess board with drag-to-move, Stockfish in a Web Worker, PGN export.

## Design docs

Read these before extending the codebase. They live in `docs/`:

| File | What it covers |
| --- | --- |
| `docs/v2_strategy.html` | Staging plan (Stage 0 / 1 / 2), gate criteria, kill criteria |
| `docs/v3_story.html`    | Full Mahabharata Mode 1 bible (Stage 2 scope) |
| `docs/v4_implementation.html` | Executable plan — the spec this codebase implements |

## What's in this commit (Agent A)

- React + TypeScript PWA on Vite 5
- Chess board with drag-to-move, real promotion chooser, color selection
- Stockfish in a Web Worker, fixed depth 10, bundled from the pinned npm package
- PGN export, resign, new-game flow
- `/about` route with GPL notices for Stockfish (license compliance, required)
- Cloudflare `_headers` file for COEP/COOP
- PWA manifest with proper icons

**Not yet built**: calibration (Agent B), Mirror generator (Agent C), story system (Agent E), Coach (Agent F). All remain Stage 0 except where noted in `v4_implementation.html` §7.

## Quickstart

```bash
# Need Node 20 LTS first. nvm-windows or nvm.
npm install
npm run dev
```

Open <http://localhost:5173>. Click **Begin**. Play a game.

## Scripts

| Command             | Effect                              |
| ------------------- | ----------------------------------- |
| `npm run dev`       | Vite dev server with HMR            |
| `npm run build`     | Production build → `dist/`          |
| `npm run preview`   | Serve the production build locally  |
| `npm run typecheck` | TypeScript check without emitting   |
| `npm run lint`      | ESLint over `src/`                  |
| `npm test`          | Vitest unit tests                   |

## Deployment

Cloudflare Pages, GitHub-connected:

- Build command: `npm run build`
- Build output: `dist`
- Node version env var: `NODE_VERSION = 20`

## Stack

| Layer            | Tool                                   |
| ---------------- | -------------------------------------- |
| Framework        | React 18 + TypeScript                  |
| Build            | Vite 5 + vite-plugin-pwa               |
| State            | Zustand                                |
| Chess validation | chess.js                               |
| Board UI         | react-chessboard v4                    |
| Engine           | Stockfish (Web Worker, GPLv3)          |
| Hosting          | Cloudflare Pages (free)                |

## License

This project: **AGPL-3.0-or-later**. See `LICENSE`.

Stockfish, bundled: GPLv3 — see `/about` in the running app for full attribution.

## Status

`v0.1.0-stage0` — Agent A complete. Agents B–H to follow.
