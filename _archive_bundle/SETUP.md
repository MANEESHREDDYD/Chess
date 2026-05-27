# Agent A Setup — Step by Step (Final)

This folder is the **complete** Agent A bundle: original files + fixes + design docs, merged. Follow these steps in order.

## 1 · Create the real repo location

```bash
# Outside OneDrive if possible — OneDrive sync breaks Vite's file watcher and can corrupt .git.
cd C:/dev    # or wherever
```

## 2 · Scaffold Vite, then overlay this folder

```bash
npm create vite@latest mirror-pwa -- --template react-ts
cd mirror-pwa
```

Vite creates the default React + TypeScript project. Now overlay this bundle on top, **overwriting** when prompted.

The files in this bundle that **replace** Vite defaults:

```
package.json       ← REPLACES Vite default
vite.config.ts     ← REPLACES Vite default
index.html         ← REPLACES Vite default
src/main.tsx       ← REPLACES Vite default
src/App.tsx        ← REPLACES Vite default
.gitignore         ← REPLACES Vite default
README.md          ← REPLACES Vite default
```

The files in this bundle that are **new** (no conflict with Vite scaffold):

```
LICENSE
SETUP.md           (this file)
.env.example
.github/workflows/ci.yml
docs/v2_strategy.html
docs/v3_story.html
docs/v4_implementation.html
public/_headers
public/favicon.svg
public/robots.txt
public/icons/icon-192.png
public/icons/icon-512.png
public/icons/apple-touch-icon.png
scripts/setup-stockfish.js
src/routes/Home.tsx
src/routes/Play.tsx
src/routes/About.tsx
src/components/Board/Board.tsx
src/engine/stockfish.worker.ts
src/engine/stockfishBridge.ts
src/state/gameStore.ts
src/styles/tokens.css
src/styles/global.css
```

**Delete** these Vite-generated leftovers:

```
src/App.css           ← we use styles/global.css
src/index.css         ← same
src/assets/           ← Vite default logo folder
public/vite.svg       ← optional, replaced by our favicon
```

**Keep** these Vite-generated files (they're fine as-is):

```
tsconfig.json
tsconfig.node.json
src/vite-env.d.ts
```

## 3 · Install dependencies

```bash
npm install
```

The `postinstall` script will check that Stockfish files exist in `node_modules/stockfish/`. If you see a warning, the build will still work because we have a CDN fallback in the worker, but local-first is faster.

## 4 · Fetch the full AGPL-3.0 license text

The bundled `LICENSE` is a stub with the SPDX header and the copyright notice. Before the repo goes public, fetch the canonical text:

```bash
# On Linux/macOS:
curl -L https://www.gnu.org/licenses/agpl-3.0.txt -o LICENSE

# On Windows PowerShell:
Invoke-WebRequest -Uri https://www.gnu.org/licenses/agpl-3.0.txt -OutFile LICENSE
```

Or download manually from <https://www.gnu.org/licenses/agpl-3.0.txt> and paste into `LICENSE`.

## 5 · Run locally

```bash
npm run dev
```

Open <http://localhost:5173>. You should see:

1. Landing page: "Play a chess opponent built from how *you* play."
2. **Begin** → `/play` with a chess board.
3. Drag pieces. Illegal moves snap back.
4. Stockfish responds within ~500ms.
5. **Download PGN** gives a valid `.pgn` file.

## 6 · Production build sanity check

```bash
npm run build
npm run preview
```

If `npm run build` fails, debug there first. The most likely failure points:

- **Stockfish files missing from `dist/stockfish/`** → check `vite.config.ts` static-copy targets and your `node_modules/stockfish/` layout. The worker will fall back to CDN, but local is preferred.
- **TypeScript error** → run `npm run typecheck` for the exact location.

## 7 · Git: initialize, private push

```bash
git init
git add .
git commit -m "feat(agent-a): scaffold PWA, chess board, Stockfish worker"

# GitHub CLI: https://cli.github.com
gh auth login
gh repo create mirror-pwa --private --source=. --push
```

## 8 · Deploy to Cloudflare Pages

1. Sign in to Cloudflare → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
2. Authorize, select `mirror-pwa` repo
3. Build configuration:
   - Framework preset: **Vite**
   - Build command: `npm run build`
   - Build output: `dist`
   - Root directory: `/`
   - Environment variables → `NODE_VERSION = 20`
4. Save and Deploy

~2 minutes later you have a live URL: `https://mirror-pwa.pages.dev`.

## 9 · Acceptance checklist (Agent A)

Confirm before moving to Agent B:

- [ ] `npm run dev` runs with no console errors
- [ ] Chess board renders and accepts drag-to-move
- [ ] Stockfish responds in under 500ms at depth 10
- [ ] PGN export downloads a valid `.pgn` file
- [ ] Castling kingside and queenside both work
- [ ] En passant works (set up a position to verify)
- [ ] **Promotion shows a piece chooser** when a pawn reaches the 8th rank
- [ ] Stalemate detected (set up a position to test)
- [ ] `/about` route shows GPL notices for Stockfish
- [ ] Deployed PWA is reachable on `*.pages.dev` URL
- [ ] Lighthouse PWA score ≥ 90 on the deployed URL

## 10 · What's next

Reply with one of:

- **"Agent A passes"** → I deliver Agent B (calibration + style vector)
- **"Stuck on [step N]"** → paste the error or screenshot, we debug
- **"Quality issue with [file]"** → I revise that file

## Common gotchas

**Stockfish 404 on `/stockfish/stockfish.js`.** The worker falls back to CDN automatically — check the browser console. If you see "[stockfish] loaded from CDN fallback" the local copy step failed but the app still works. To fix the local path: inspect `node_modules/stockfish/` and adjust `vite.config.ts` static-copy targets.

**"importScripts is not defined" in worker.** The worker must be classic, not module. Check `src/engine/stockfishBridge.ts` line 18: `type: 'classic'`.

**Promotion piece picker doesn't appear.** Make sure you have the fixed `Board.tsx` from this bundle — the previous version's `onPieceDrop`-based promotion was broken.

**OneDrive corrupts `.git`.** Move the repo out of OneDrive entirely. `C:/dev/mirror-pwa` is safer than `C:/Users/<you>/OneDrive/Desktop/mirror-pwa`.

**COEP/COOP errors on Cloudflare Pages.** The `public/_headers` file handles this. Verify it copied to `dist/_headers` after build.

**Vite import.meta.url worker resolution fails.** Make sure `tsconfig.json` includes `"module": "ESNext"` and `"target": "ES2020"` or later.
