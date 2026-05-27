# Phase 0 Report — Clean Baseline + Verify Agent A

> **Note (2026-05-27)**: This report contains stale claims.
> See docs/STATUS_AUDIT_2026-05-26.md for current ground truth.

SUPERSEDED by STATUS_AUDIT_2026-05-26

**Date:** 2026-05-22
**Workspace:** `C:\Users\md200\OneDrive\Desktop\Chess\Product\`
**Verdict:** **PASS**

> **Current audit update, 2026-05-22:** This report predates the latest cleanup. The current tree now has a Git repository, full AGPL-3.0 license text in `LICENSE`, request-scoped Stockfish bridge calls, a local `stockfish-nnue-16-single.js` worker path, and a Vitest suite for `gameStore`.

---

## 1 · What was done

| Step | Action | Result |
| ---- | ------ | ------ |
| 0    | Copy `mirror-pwa-final/*` → `Product/*` (the OneDrive-move-or-not question, resolved as "fresh tree in `Product/`") | OK |
| 1    | Generate 5 missing scaffold files | OK |
| 2    | `npm install` | OK, exit 0, 535 packages, 7 moderate vulns (transitive — not blocking) |
| 3    | `npm run typecheck` | One error → fixed → clean (see §4) |
| 4    | `npm run build` | OK, exit 0, 12 stockfish items copied, PWA precache 27 entries / 3.1 MB |
| 5    | `npm run dev` | OK, Vite 5.4.21 ready in 800ms at `http://localhost:5173/` |
| 6    | This report | You're reading it |
| 7    | Commit | **Skipped per your instruction** (no `.git` initialized) |

---

## 2 · The five generated config files

### `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable", "WebWorker"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": false,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["vite/client"]
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

Standard Vite 5 + React 18 + TS 5.4 template. `WebWorker` lib because `stockfish.worker.ts` uses worker globals (`importScripts` originally, `self` / `DedicatedWorkerGlobalScope` now). `module: ESNext` is required for the `new URL(..., import.meta.url)` worker pattern in `stockfishBridge.ts:15` (SETUP.md:188 confirms).

### `tsconfig.node.json`

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts"]
}
```

Vite default. Lets tsc type-check `vite.config.ts` without dragging in DOM libs.

### `src/vite-env.d.ts`

```ts
/// <reference types="vite/client" />
```

Minimal. Did not add `vite-plugin-pwa/client` because no virtual-module imports exist in the source.

### `.eslintrc.cjs`

```js
module.exports = {
  root: true,
  env: { browser: true, es2020: true, node: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', 'node_modules', 'public/stockfish', '.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
  },
};
```

ESLint 8.57 + `@typescript-eslint` v7 ⇒ legacy `.eslintrc.cjs` (flat config is ESLint 9+). Matches the Vite official React-TS template so `npm run lint`'s `--max-warnings 0` is achievable. **Not run as part of Phase 0** — outside the brief — but the file is in place for Phase 1.

### `.prettierrc`

```json
{
  "singleQuote": true,
  "semi": true,
  "trailingComma": "all",
  "printWidth": 100
}
```

Matches the style already in the bundled source (verified in `App.tsx`, `vite.config.ts`).

---

## 3 · Installed versions (ground truth via `npm ls --depth=0`)

| Package           | `package.json` | Installed |
| ----------------- | -------------- | --------- |
| chess.js          | `^1.0.0`       | 1.4.0     |
| react             | `^18.3.1`      | 18.3.1    |
| react-dom         | `^18.3.1`      | 18.3.1    |
| react-chessboard  | `^4.7.2`       | 4.7.3     |
| react-router-dom  | `^6.26.0`      | 6.30.3    |
| zustand           | `^4.5.4`       | 4.5.7     |
| stockfish         | `^16.0.0`      | 16.0.0    |
| typescript        | `^5.4.5`       | 5.9.3     |
| vite              | `^5.4.0`       | 5.4.21    |
| vite-plugin-pwa   | `^0.20.0`      | 0.20.5    |

All caret resolutions stayed inside the original major. **No version drift across majors.** The v4 doc's stack table pins `^5.4.0`/`^4.5.4`/`^6.26.0`/`^5.4.0` etc., so installed versions are spec-compliant. (If you want stricter pinning, replace carets with exact versions — that is a separate decision, not a Phase 0 outcome.)

---

## 4 · Bug fixed in bundled source

**File:** `src/engine/stockfish.worker.ts:64-66` (original numbering)
**Symptom:** `tsc` reported `TS2578: Unused '@ts-expect-error' directive.`
**Cause:** Line 1's `/// <reference lib="webworker" />` already exposes `importScripts` as a global, so the `@ts-expect-error` above the call was suppressing a non-existent error.
**Fix:** Removed the `@ts-expect-error` comment (no behavioral change).
**Diff:**

```diff
 function tryLoad(url: string, locateBase: string): boolean {
   try {
-    // @ts-expect-error importScripts is available in classic workers
     importScripts(url);
```

> **Note:** After this report's typecheck pass, `stockfish.worker.ts` was rewritten externally (by you) to a different architecture — nested `new Worker(LOCAL_ENGINE)` against `/stockfish/stockfish-nnue-16-single.js` directly, without `importScripts` or the `STOCKFISH` global. Typecheck and build were re-run after that edit — **both pass clean (exit 0)**. The rewrite incidentally resolves the runtime concern flagged in §5.

---

## 5 · Stockfish filename observation

`vite.config.ts`'s `STOCKFISH_SOURCES` glob set was not modified — the existing `node_modules/stockfish/src/*.js` pattern matches the actual files. **No edits needed.**

Evidence:

```
node_modules/stockfish/src/  → stockfish-nnue-16{,-no-simd,-no-Worker,-single}.{js,wasm}
                              + nn-5af11540bbfe.nnue, build.js, postscript.js, preamble.js, preface.js
dist/stockfish/              → same set, 12 items (vite-plugin-static-copy log: "Copied 12 items")
```

The **original** `stockfish.worker.ts` hard-coded `LOCAL_SF = '/stockfish/stockfish.js'`, which the npm package does not ship — local load would have 404'd and the CDN fallback (`stockfish@16.0.0/src/stockfish.js`) probably also 404s. This was a latent runtime bug, not a build-time bug, so it didn't surface in Phase 0's gates.

Your subsequent rewrite points at `/stockfish/stockfish-nnue-16-single.js`, which **does** exist in `dist/stockfish/`. Local load now resolves. Not verified end-to-end in a browser as part of Phase 0 (out of scope), but the path mismatch is gone.

---

## 6 · Localhost URL and what's at `/`

```
VITE v5.4.21  ready in 800 ms
➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

`/` renders the `Home` route (`src/routes/Home.tsx`). Visual description, read from source:

- Hero section with eyebrow text "A chess prototype"
- Headline: *"Play a chess opponent built from how **you** play."*
- Lede paragraph framing Stage 0 as a bare prototype
- A single `Begin` button (`<Link to="/play">`)
- Privacy footnote: "We don't track you. Games stay on your device unless you submit feedback."
- App-shell header with `MIRROR` brand link, `Play` / `About` nav
- App-shell footer with `Stage 0 prototype` text and `Credits & GPL notices` link

Not opened in a browser (per the brief: "Do not try to open a browser yourself").

---

## 7 · Other observations (not Phase 0 fixes — for triage)

These are findings that surfaced while working but are out of Phase 0 scope:

1. **Duplicate workspace resolved.** `mirror-pwa-final/` was deleted from beside `Product/`; the canonical tree is `Product/`.
2. **Git now exists.** The original Step 7 was skipped during Phase 0, but the current `Product/` tree is now a Git repository.
3. **`stockfishBridge.ts` request tracking is resolved.** The bridge now emits per-request `requestId` values and ignores stale engine replies.
4. **`Board.test.tsx` is resolved.** A focused SSR smoke test now covers board props and engine-thinking move blocking.
5. **CI doesn't lint.** `.github/workflows/ci.yml` was not inspected as part of Phase 0; if it lacks a lint step you'll want that before Phase 1.
6. **`LICENSE` is resolved.** The current tree includes canonical GNU AGPL-3.0 text and the package metadata uses `AGPL-3.0-or-later`.
7. **About.tsx placeholder GitHub link.** Needs real repo URL once one exists.
8. **8 moderate npm audit vulnerabilities.** Current audit reports the esbuild dev-server advisory through Vite and related plugins; npm reports no available fix in this dependency tree. Keep local dev servers bound to `127.0.0.1`.

---

## Verdict

**PASS.** All Phase 0 gates met:

- [x] Scaffold files generated and match installed deps
- [x] `npm install` succeeds (exit 0)
- [x] `npm run typecheck` succeeds (exit 0)
- [x] `npm run build` succeeds (exit 0), dist generated, Stockfish copied
- [x] `npm run dev` starts, serves at localhost:5173
- [x] One clear-bug fix in `src/`, documented
- [x] Report written
- [ ] ~~Commit~~ (skipped per your instruction)

Ready for Phase 1 pending your decisions on §7 (canonical path, git, etc.).
