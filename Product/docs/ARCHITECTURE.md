# MIRROR Architecture

> Status: Stage 0 (free-play + calibration). The Mirror match is the next real feature; everything else in this document is **architecture for what could attach later, not a build plan**.

This document maps the codebase today, names the seams where the seven future systems would plug in, declares what we are deliberately not building, and describes how the IndexedDB schema would evolve.

---

## A · Current architecture

### A.1 Layer map

```
┌────────────────────────────────────────────────────────────────────┐
│  BROWSER                                                           │
│                                                                    │
│  ┌──────────┐   ┌──────────────────────────┐   ┌────────────────┐  │
│  │ index.   │ → │ src/main.tsx             │ → │ <App />         │  │
│  │ html     │   │  - StrictMode            │   │  + Router       │  │
│  └──────────┘   │  - BrowserRouter         │   └────────────────┘  │
│                 └──────────────────────────┘                       │
│                                                                    │
│  ROUTES (src/routes/)                                              │
│  ┌──────┐ ┌──────────────┐ ┌──────┐ ┌───────┐                       │
│  │ Home │ │ Calibration  │ │ Play │ │ About │                       │
│  └──────┘ └──────┬───────┘ └──┬───┘ └───────┘                       │
│                  │            │                                    │
│  COMPONENTS      ▼            ▼                                    │
│  ┌───────────────────────┐ ┌────────────────────┐                   │
│  │ Calibration/Task1-8   │ │ Board / BoardView  │                   │
│  │ Mirror/StyleVectorRadar│ │ (react-chessboard) │                  │
│  │ Mirror/styleSummary    │ └────────────────────┘                  │
│  └──────────┬─────────────┘                                         │
│             │                                                       │
│  STATE      ▼                                                       │
│  ┌─────────────────┐ ┌────────────┐ ┌──────────────────┐            │
│  │ calibrationStore│ │ gameStore  │ │ settingsStore    │            │
│  │ (zustand)       │ │ (zustand)  │ │ (zustand+persist)│            │
│  └────┬────────┬───┘ └────┬───────┘ └──────────────────┘            │
│       │        │          │                                         │
│  DOMAIN/LIB    │          │                                         │
│  ┌──────────┐  │  ┌──────────────┐ ┌────────────┐                   │
│  │ ml/      │  │  │ lib/eloDetect│ │ lib/theme  │                   │
│  │ styleVec │◀─┘  └──────────────┘ └────────────┘                   │
│  └──────────┘     ┌──────────────┐                                  │
│                   │ vyasaLines   │                                  │
│                   │ taskData     │                                  │
│                   │ (Calibration/)│                                 │
│                   └──────────────┘                                  │
│                                                                    │
│  ENGINE                       │           STORAGE                   │
│  ┌──────────────────────┐     │           ┌──────────────────┐     │
│  │ stockfishBridge      │     │           │ data/db.ts        │     │
│  │ (free-play)          │     │           │ (idb wrapper)     │     │
│  └──────────┬───────────┘     │           └────────┬─────────┘     │
│             │                 │                    │                │
│  ┌──────────────────────┐     │           ┌──────────────────┐     │
│  │ calibrationOpponent  │     │           │ IndexedDB         │     │
│  │ (skill 8 / depth 6)  │     │           │ "mirror-pwa"      │     │
│  └──────────┬───────────┘     │           └──────────────────┘     │
│             │                                                       │
│             ▼  Worker boundary                                      │
│  ┌──────────────────────┐                                           │
│  │ stockfish.worker.ts  │  ─ local /stockfish/*.js  (primary)       │
│  │  ─ Worker context    │  ─ CDN jsdelivr stockfish (fallback)      │
│  └──────────────────────┘                                           │
│                                                                    │
│  STATIC CONTENT                                                    │
│  ┌────────────────────────┐ ┌────────────────────────────────────┐  │
│  │ data/calibrationPos.json│ │ public/themes/kurukshetra/        │  │
│  │ (typed via taskData.ts)│ │  ├─ theme.json                     │  │
│  └────────────────────────┘ │  ├─ pieces/*.png  (24 images)      │  │
│                             │  └─ board/, fx/                    │  │
│                             └────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

### A.2 Module responsibilities and public contracts

| Module | Single responsibility | Public exports | Direct consumers |
| --- | --- | --- | --- |
| `src/main.tsx` | React 18 bootstrap, BrowserRouter | _(none)_ | _(entry point)_ |
| `src/App.tsx` | Shell — header, nav, footer, route table | `default App` | `main.tsx` |
| `src/routes/Home.tsx` | Landing CTA to `/calibration` and `/play` | `default Home` | `App.tsx` |
| `src/routes/Calibration.tsx` | Orchestrates the 8-task calibration flow | `default Calibration` | `App.tsx` |
| `src/routes/Play.tsx` | Free-play sidebar (start, theme, resign, PGN) + `<Board />` | `default Play` | `App.tsx` |
| `src/routes/About.tsx` | License notices (AGPL / GPL / BSD / MIT) | `default About` | `App.tsx` |
| `src/components/Board/Board.tsx` | Container — wires gameStore + settingsStore + theme into BoardView | `Board` | `Play.tsx` |
| `src/components/Board/BoardView.tsx` | Pure react-chessboard wrapper with promotion + theme application | `BoardView` | `Board.tsx`, calibration Tasks 3 / 5 / 8 |
| `src/components/Calibration/Task{1..8}*.tsx` | Per-task UI + scoring contract back to `Calibration.tsx` | `Task{N}…` | `Calibration.tsx` |
| `src/components/Calibration/TaskBoardShell.tsx` | Shared tactical board + timer + correctness | `TaskBoardShell`, `TacticalTaskPosition` | Tasks 1, 4 |
| `src/components/Calibration/TaskButtonGrid.tsx` | Shared 2/3/4-column choice grid | `TaskButtonGrid` | Tasks 2, 5, 6, 7 |
| `src/components/Calibration/pieceIcons.tsx` | 12 SVG piece icons | `pieceIcon(code)` | Tasks 2, 5, 6, 7 |
| `src/components/Calibration/taskData.ts` | Typed accessors over `calibrationPositions.json` | `get{Tactical,OpeningChoice,BlackRepertoire,Exchange,EndgameTechnique,MoralChess}…` | Tasks + `Calibration.tsx` |
| `src/components/Calibration/vyasaLines.ts` | Trigger table + selection for Task 8 commentary | `pickVyasaLine`, `vyasaLines`, types | Task 8 |
| `src/components/Mirror/StyleVectorRadar.tsx` | 8-axis radar / slider editor | `StyleVectorRadar` | _(future, not in route tree yet)_ |
| `src/components/Mirror/styleSummary.ts` | Prose generator for a style vector | `generateSummary` | `Calibration.tsx` |
| `src/state/gameStore.ts` | Zustand store for free-play game | `useGameStore` with `{ fen, status, result, playerColor, engineThinking, gameId } + actions` | `Play.tsx`, `Board.tsx` |
| `src/state/settingsStore.ts` | Persisted UI preferences (theme today; more later) | `useSettingsStore` with `{ activeTheme, setActiveTheme }` | `Play.tsx`, `Board.tsx` |
| `src/state/calibrationStore.ts` | Zustand store for calibration run lifecycle | `useCalibrationStore` with `{ run, currentTaskIndex, taskOutputs, styleVector, isLoading } + actions` | `Calibration.tsx`, tests |
| `src/engine/stockfish.worker.ts` | Worker-side UCI dispatcher with local/CDN engine load | `default Worker` (constructed via `new Worker(import.meta.url)`) | `stockfishBridge`, `calibrationOpponent` |
| `src/engine/stockfishBridge.ts` | Main-thread facade for free-play | `getBestMove`, `evaluatePosition`, `setOption`, `stopThinking`, `waitForEngine` | `gameStore` |
| `src/engine/calibrationOpponent.ts` | Skill-capped opponent for calibration | `init`, `move`, `dispose` | Tasks 3 and 8 |
| `src/lib/theme.ts` | Theme manifest fetch + URL helpers | `ThemeManifest`, `ThemeId`, `PieceKey`, `loadThemeManifest`, `isStandardTheme`, `getThemeManifestUrl`, `getThemeAssetUrl` | `Board.tsx`, `BoardView.tsx` |
| `src/lib/eloDetect.ts` | Detected-Elo heuristic with band thresholds | `computeDetectedElo`, `computeDetectedEloFromScores`, `eloBandFromRating`, `DetectedElo` | `ml/styleVector.ts` |
| `src/ml/styleVector.ts` | 9-dimension style vector computation, NaN-safe | `computeStyleVector`, `STYLE_VECTOR_SCHEMA_VERSION`, `MOTIFS`, all types | `calibrationStore`, `data/db.ts` (type re-export), tests |
| `src/data/db.ts` | IndexedDB schema + open/close/delete helpers | `MIRROR_DB_NAME`, `MIRROR_DB_VERSION`, all record types, `openMirrorDb`, `closeMirrorDb`, `deleteMirrorDb` | `calibrationStore`, tests |
| `src/data/calibrationPositions.json` | Static authored content for 8 tasks | _(consumed via `taskData.ts`)_ | `taskData.ts` |
| `src/styles/tokens.css` | Design tokens (colors, type, spacing) | _(no JS exports)_ | `main.tsx` |
| `src/styles/global.css` | Global stylesheet | _(no JS exports)_ | `main.tsx` |

### A.3 Data model — IndexedDB `mirror-pwa`, schema v1

```
players                        (keyPath: id)
├── id: string                 — "local-player" today; future: server-issued
├── created_at: string         — ISO timestamp
├── updated_at: string
├── current_style_vector_id?: string  → style_vectors.id
├── detected_elo?: number
└── elo_band?: 'apprentice' | 'initiate' | 'adept' | 'master'

calibration_runs               (keyPath: id, index started_at)
├── id: string                 — "calibration-run-<uuid>"
├── player_id: string          → players.id
├── started_at: string
├── completed_at?: string
├── status: 'in_progress' | 'completed' | 'abandoned'
├── current_task_index: number — 1..8
├── task_outputs: Record<string, unknown>  — { task1: {...}, task2: {...}, … }
└── style_vector_id?: string   → style_vectors.id

style_vectors                  (keyPath: id, index computed_at)
├── id: string                 — "style-vector-<uuid>"
├── player_id: string          → players.id
├── calibration_run_id?: string  → calibration_runs.id
├── source: 'calibration' | 'tuned'
├── vector: StyleVector        — 9 dimensions + detected_elo + elo_band + schema_version
├── computed_at: string
└── previous_vector_id?: string  → style_vectors.id  (chain for tuning history)

mirror_matches                 (keyPath: id)   ─ store exists, no writers yet
├── id: string
├── player_id: string
├── started_at: string
├── completed_at?: string
├── pgn?: string
├── result?: string
└── metadata?: Record<string, unknown>

feedback                       (keyPath: id)   ─ store exists, no writers yet
├── id: string
├── player_id?: string
├── mirror_match_id?: string   → mirror_matches.id
├── created_at: string
├── felt_like_me?: boolean
├── notes?: string
└── metadata?: Record<string, unknown>
```

Two stores (`mirror_matches`, `feedback`) are pre-declared in v1 but have no writers yet. That is intentional — they are the immediate next surface (Mirror match + post-match feedback) and reserving the keypaths now avoids a v2 bump the moment the Mirror lands.

`settingsStore` lives in **localStorage** (`mirror-settings` key), separate from IndexedDB. It holds only ephemeral UI preference (`activeTheme`) today.

---

## B · The seams

For each future system: **where it attaches, what contract, what already anticipates it, what would change, complexity tag**.

### B.1 The GAME MODE seam

**Observation.** Free-play, the three board-based calibration tasks (3, 5, 8), a future Mirror match, a future story chapter, a future ranked game, a future multiplayer game, and a future task challenge are all "a chess game with different rules around setup, opponent, scoring, and completion."

Today there is no shared abstraction. `gameStore` is hardcoded to free-play. Task 3 (`Task3EndgameTechnique.tsx`) and Task 8 (`Task8VyasaMatch.tsx`) each maintain their own `Chess` instance and engine wiring. Task 1 / 4 / 5 use `TaskBoardShell` which is closer to a shell than a contract.

**Proposed contract** (sketch — would be refined by the Mirror builder):

```ts
type GameOutcome =
  | { kind: 'in-progress' }
  | { kind: 'win';  by: 'checkmate' | 'resignation' | 'objective' }
  | { kind: 'loss'; by: 'checkmate' | 'resignation' | 'timeout' | 'objective-failed' }
  | { kind: 'draw'; by: 'stalemate' | 'repetition' | 'fifty-move' | 'insufficient' | 'agreement' }
  | { kind: 'abandoned' };

interface GameMode<TConfig = unknown, TState = unknown> {
  readonly id: string;
  readonly displayName: string;
  initialFen(config: TConfig): string;
  evaluateState(game: Chess, state: TState): GameOutcome;
  moveBudget?(state: TState): { used: number; remaining?: number };
}
```

**Where future systems attach.**
- Mirror match → a `MirrorMatchMode` implementing `GameMode`, using a Mirror `OpponentProvider`.
- Story chapter → `StoryChapterMode` reading FEN + objective from authored content.
- Ranked → `RankedMode` (just free-play + a recorded outcome that updates a rating store).
- Multiplayer → `LocalMultiplayerMode` (two humans, same `gameStore`-shaped controller, no opponent provider) and later `RemoteMultiplayerMode`.
- Task challenge → looks structurally like a per-position tactical task; closer to `TaskBoardShell` than to a full GameMode.

**What already anticipates it.** Not much. `TaskBoardShell` is the shape of a partial mode-shell for tactical content. `gameStore.startGame` accepts a `'random'` color, which is the closest the codebase has to a mode flag.

**What would change.**
- A future Mirror match lives next to `gameStore`, not inside it. `gameStore` likely renamed `freePlayStore` or stays as the implementation of FreePlayMode.
- Task 3 / Task 5 / Task 8 could opt in to GameMode incrementally; they are not blocking the Mirror.

**Complexity:** **medium**. The contract is straightforward, but every existing flow has its own shape, so harmonizing is non-trivial. Don't force it; refactor when each flow is next touched.

### B.2 The OPPONENT seam

**Observation.** `stockfishBridge.getBestMove(fen, depth, timeoutMs)` and `calibrationOpponent.move(fen, options)` are both "a thing that produces the next move." A future Mirror opponent (Stockfish + style reranker) and a future human opponent (multiplayer over a transport) fit the same shape.

`calibrationOpponent` already exposes `init / move / dispose`, which is essentially the OpponentProvider lifecycle.

**Proposed contract** (formalized today in `src/types/opponent.ts` — see Deliverable 2):

```ts
interface OpponentMoveOptions {
  depth?: number;
  timeoutMs?: number;
  skillLevel?: number;
  signal?: AbortSignal;
}

interface OpponentProvider {
  readonly id: string;
  getMove(fen: string, options?: OpponentMoveOptions): Promise<string | null>;
  dispose?(): void;
}
```

**Where future systems attach.**
- Mirror opponent → `class MirrorOpponent implements OpponentProvider` — wraps stockfishBridge internally, applies the style-reranker on candidate moves.
- Multiplayer (remote) → `class RemoteOpponent implements OpponentProvider` — translates a network message into a UCI move.
- Multiplayer (same-device) → no `OpponentProvider`; the second human's input is just another `makePlayerMove` call.
- Task challenge → reuses calibrationOpponent or its own skill-capped instance.

**What already anticipates it.** The interface is half-implemented by `calibrationOpponent`. `stockfishBridge` has the same intent under a different signature.

**What would change.**
- Neither existing engine module is being refactored today. A thin adapter (1 file, ~20 lines) per implementor wraps the real call to match the OpponentProvider signature when the first consumer arrives.
- `gameStore.triggerEngineMove` is hard-coded to `stockfishBridge.getBestMove`. The Mirror match would have its own store/controller that takes an `OpponentProvider` as a dependency.

**Complexity:** **small**. The interface is small, the existing modules conform in spirit, and the Mirror's wrap-and-rerank pattern is well-understood.

### B.3 The STORAGE seam

**Observation.** Today everything is local (IndexedDB + `settingsStore` in localStorage). Three future systems need server state: ranked play, cross-device multiplayer, the analysis platform. Two would benefit from server mirroring but could survive without: feedback (the beta-cohort signal), style vector history (cross-device portability).

The Supabase-or-similar layer has no code today. The line we want to draw is **between data the server would own vs. data the device would own**:

| Store / key | Persistence intent | Notes |
| --- | --- | --- |
| `localStorage["mirror-settings"]` | **LOCAL-ONLY (device-bound UI preference)** | Theme today. Not synced. Lost on browser clear. |
| `players` | **USER-OWNED (would mirror to server when accounts exist)** | `id: "local-player"` until accounts arrive. |
| `calibration_runs` | **USER-OWNED (mirror)** | Authored on device, valuable cross-device. |
| `style_vectors` | **USER-OWNED (mirror)** | Authored on device, primary Mirror input. |
| `mirror_matches` | **USER-OWNED (mirror)** | Authored on device, eventual server analytics source. |
| `feedback` | **USER-OWNED (mirror)** | Whole purpose is to reach Anthropic-side review later. |
| _(future)_ `ratings`, `leaderboard_cache` | **SERVER-CANONICAL (read-through cache)** | Cannot be device-authoritative. |
| _(future)_ `match_invites`, `multiplayer_games` | **SERVER-CANONICAL** | Cross-device coordination requires server. |
| _(future)_ `story_progress` | **USER-OWNED (mirror) OR LOCAL-ONLY** | Decision deferred until story exists. |
| _(future)_ `task_attempts`, `task_definitions` | **USER-OWNED (mirror) + AUTHORED (read-only from server)** | Defs come from server/repo; attempts are user-owned. |

**Where it attaches.** A future `src/data/sync.ts` (does not exist) would, on a schedule or on user request, push user-owned records to Supabase and pull authored records down. The boundary is the persistence intent column. `db.ts` is annotated with these intents today so the future builder doesn't have to re-derive them.

**What already anticipates it.** Nothing — by design. We do NOT pre-build the sync layer. We DO mark the line.

**What would change.**
- `players.id` stops being `"local-player"` once accounts exist.
- A `sync_state` column or sidecar store appears at v2+ to track per-record sync status.
- `feedback` may grow a `submitted_at` field.

**Complexity:** **large** when actually built. Server choice, auth, conflict resolution, offline-first reconciliation. Justifies a dedicated phase.

### B.4 The PROGRESSION seam

**Observation.** Story chapters (1 of 19), tasks (DAG of challenges), badges, children's-mode lessons, ranked-ladder rank, calibration tasks (1 of 8) all share the shape: **ordered or graph-structured content, with per-player position tracked over time**.

Today only calibration has this — and it's a flat 1..8 progression inside `calibrationStore`.

**Proposed contract** (sketch — too speculative to commit as a type today):

```ts
interface ProgressionTrack<TStep, TState> {
  trackId: string;
  allSteps(): TStep[];
  currentStep(state: TState): TStep | null;
  isComplete(state: TState): boolean;
  recordResult(state: TState, step: TStep, result: unknown): TState;
}
```

**Where future systems attach.** Each "ordered content" system becomes a `ProgressionTrack` implementation. State persists in a new `progression` store at v2+.

**What already anticipates it.** `calibrationStore.currentTaskIndex` + `taskOutputs` is the pattern. It just hasn't been generalized.

**What would change.**
- A `progression` store added at v2 with `{ player_id, track_id, current_step_id, completed_steps, completed_at? }`.
- `calibrationStore` either re-uses the new store or stays bespoke (recommendation: stay bespoke; calibration is one-and-done, not a track).

**Complexity:** **medium** once two real systems exist. **Premature** with only calibration. Do not generalize until story + tasks both need it.

### B.5 The CONTENT seam

**Observation.** `calibrationPositions.json` + `taskData.ts` is one model: **static JSON in `src/data/`, typed accessors in a sibling module, imported at build time**. The 200-line JSON costs ~10 KB in the bundle.

Future content: story dialogue (Vyasa lines × 19 chapters, branching), task definitions (positions + grading rules), lessons (positions + instructional copy + age-appropriate language), opening books, theme manifests (already at runtime).

**Proposed pattern** (documented at the top of `taskData.ts` today — see Deliverable 2):

```
src/data/
├── calibrationPositions.json     ─ current
├── storyChapters.json            ─ future (one file? lazy-loaded per chapter?)
├── taskDefinitions.json          ─ future
└── lessons.json                  ─ future

src/content/
├── calibration.ts                ─ today: taskData.ts moved here
├── story.ts                      ─ future
├── tasks.ts                      ─ future
└── lessons.ts                    ─ future
```

For content >100 KB, prefer `import('./bigContent.json')` (lazy `await`) so it does not enter the main bundle.

**What already anticipates it.** `calibrationPositions.json` is the prototype. The PWA precache already accepts JSON files.

**What would change.**
- When the second content type lands, consider moving `taskData.ts` to `src/content/calibration.ts` and adding `src/content/story.ts` next to it. This is a one-time rename. Do not do it today.

**Complexity:** **small** per content type. The shape is well-understood.

### B.6 The THEME / PRESENTATION seam

**Observation.** The Kurukshetra theme is the prototype: a `theme.json` manifest, piece PNGs, board colors, a (currently unused) FX block. `loadThemeManifest` + `isStandardTheme` form the load boundary; `Board.tsx` consumes the manifest.

**Theme today covers only visual assets.** Children's mode and analysis mode want **behavioral** changes (no clock; larger touch targets; eval bar; annotation overlays). Those are **not** theme concerns.

**Proposed distinction:**

| Concern | Layer | Mechanism |
| --- | --- | --- |
| Piece art, board colors, capture FX | **Theme** | `theme.json` (current contract) |
| Clock visible? | **PresentationMode** | Component prop (does not exist yet) |
| Touch-target size, font scale | **PresentationMode** | CSS variable or media-query equivalent |
| Eval bar visible? | **PresentationMode** | New prop on `BoardView` or a sibling overlay |
| Coordinate labels | **PresentationMode** | react-chessboard already supports |
| Move arrows / annotations | **PresentationMode + DataLayer** | New component, future analysis layer |

**Where future systems attach.**
- Children's mode → a PresentationMode (large + no-clock + simplified language) + likely its own children-friendly theme.
- Analysis mode → a PresentationMode (eval bar + arrows + annotations) overlaying any theme.

**What already anticipates it.** `ThemeManifest` is solid. `BoardView` already renders with composable `customBoardStyle` + `customPieces` — a future PresentationMode would add more such props.

**What would change.**
- A `PresentationMode` enum / prop appears on `<BoardView>` and on `<Play>` / `<Calibration>` when the first non-default mode is real.

**Complexity:** **medium**. Theme stays small; PresentationMode is the new abstraction and should not be created until at least two concrete modes exist.

### B.7 The seven future systems mapped to seams

| Future system | Game-mode | Opponent | Storage | Progression | Content | Theme / Presentation |
| --- | --- | --- | --- | --- | --- | --- |
| 1 · Story (19 chapters) | yes | yes (per-chapter Mirror or scripted) | local + content | yes | **heavy** | maybe |
| 2 · Multiplayer (same-device) | yes | _(no — two humans)_ | local | no | no | no |
| 2 · Multiplayer (cross-device) | yes | yes (RemoteOpponent) | **server** | no | no | no |
| 3 · Ranked play | yes (existing modes) | reuses | **server** | yes (rank) | no | no |
| 4 · Task system | yes (challenge mode) | yes (skill-capped) | local + content | yes | **heavy** | no |
| 5 · Analysis platform | yes (review mode) | reuses (eval) | **server** (large) | no | _(stored games)_ | **heavy (presentation)** |
| 6 · Children's mode | yes (simplified) | yes (very-low-skill) | local | yes (lessons) | **heavy** | **heavy (presentation)** |
| 7 · AI Mirror opponent | yes (MirrorMatch) | yes (MirrorOpponent) | local | _(repeat play)_ | no | no |

Pattern: Mirror, Story, Tasks, Children's all share Content + Mode + (mostly) local-only storage. Multiplayer, Ranked, Analysis all share Storage (server) + Mode.

---

## C · Non-goals

**None of the seven systems are built.** This document describes attachment points only. The codebase has zero implementation of:

- Mirror opponent (the core premise)
- Story mode, story content, story progression
- Multiplayer (same-device or cross-device)
- Ranked play, ratings, KD, badges, leaderboards
- Task system (challenges, grading, completion)
- Analysis platform (review, eval, annotation)
- Children's learning mode (lessons, simplified UI)
- Server, API client, sync layer, authentication
- A GameMode router, opponent registry, content registry, or progression engine

Each of these should be built only after **(a)** the Mirror is validated with real players and **(b)** that specific system is prioritized over the other six. The seven systems should not all be built; some will likely be dropped after Mirror validation reshapes the product.

The audit prompt's "Do not build" rule is the binding constraint. The seam analysis above is documentation of where work would land; it is not a commitment to land it.

---

## D · Data model evolution

### D.1 Migration strategy

`openMirrorDb` calls `idb.openDB` with an `upgrade(db, oldVersion)` callback. Adding a new store at v2 looks like:

```ts
function createV2(db: IDBPDatabase<MirrorDB>): void {
  // example only; do NOT add today
  const progression = db.createObjectStore('progression', { keyPath: 'id' });
  progression.createIndex('player_id', 'player_id');
}

openDB<MirrorDB>(dbName, 2, {
  upgrade(db, oldVersion) {
    if (oldVersion < 1) createV1Schema(db);
    if (oldVersion < 2) createV2(db);
  },
});
```

Each branch is additive against the prior `oldVersion`. **Never delete a store in the same version that adds its replacement** — deprecate at v(N), remove at v(N+1) after a confirmed migration run.

Field additions to existing stores are free because `idb` stores plain objects; old records simply lack the new field. Reads must default-fill on consumption.

### D.2 Future systems → new object stores (not built)

| System | New store(s) at | Shape sketch |
| --- | --- | --- |
| Mirror match (already provisioned) | `mirror_matches` (v1) | `id, player_id, started_at, pgn, result, metadata` |
| Feedback (already provisioned) | `feedback` (v1) | `id, player_id?, mirror_match_id?, created_at, felt_like_me?, notes?, metadata?` |
| Progression / story / tasks / lessons | `progression` (v2) | `id, player_id, track_id, current_step_id, completed_steps[], updated_at` |
| Tasks attempts (per-attempt history) | `task_attempts` (v2 or later) | `id, player_id, task_id, started_at, completed_at?, result, metadata` |
| Ranked play | `ratings` (v3, read-through) | `id, player_id, rating, kd, last_match_at` |
| Multiplayer | `match_invites`, `multiplayer_games` (v3, server-canonical) | server-defined |
| Analysis | `saved_analyses` (v3 or later) | `id, player_id, pgn, annotations[], evaluations[], created_at` |
| Sync metadata (when sync layer arrives) | `sync_state` (vN) | `record_type, record_id, last_synced_at, dirty: boolean` |

**None of these stores exist today.** Pre-declaring them now would create maintenance liability for systems that may never ship.

---

## E · Recommended build order

This is an engineering recommendation. The human decides; this is advice.

```
┌─────────────────────────────────────────────────────────────┐
│ 1 · MIRROR MATCH ── prerequisite for everything             │
│                                                             │
│ The product premise. Until the Mirror is validated with     │
│ real players, every other system is speculative scope. The  │
│ Mirror sits at the OpponentProvider seam (B.2) and the      │
│ GameMode seam (B.1). It needs no new storage stores         │
│ (mirror_matches + feedback already exist at v1).            │
│                                                             │
│ Effort: medium. Risk: high (the core hypothesis).           │
│ Validation question: "Does it feel like me?"                │
└─────────────────────────────────────────────────────────────┘
              │
              ▼  Only proceed after the Mirror is validated
┌─────────────────────────────────────────────────────────────┐
│ 2 · CHILDREN'S MODE ── cheapest validator of the rest       │
│                                                             │
│ Why second: forces real definition of PresentationMode      │
│ (B.6) and the content seam (B.5). Children's content is     │
│ small in scope. Local-only data, no server, no progression  │
│ store needed if lessons are linear.                         │
│                                                             │
│ Alternative: skip and go straight to Story. Children's      │
│ first only if early Mirror users include children, OR if    │
│ a children's onboarding lowers the activation bar.          │
│                                                             │
│ Effort: medium. Risk: low.                                  │
└─────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────┐
│ 3 · STORY MODE ── the framing the Kurukshetra theme implies │
│                                                             │
│ 19 chapters of Mahabharata. Reuses Mirror as the per-       │
│ chapter opponent. Content seam (B.5) becomes load-bearing:  │
│ 19 chapters of dialogue + FENs is the first time content    │
│ is large enough to need lazy loading. Progression seam      │
│ (B.4) gets its first real implementation here.              │
│                                                             │
│ Effort: large (mostly content authoring, not code).         │
│ Risk: medium. Validation: do users finish chapter 1? 3? 9?  │
└─────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────┐
│ 4 · TASK SYSTEM ── extends the progression + content seams  │
│                                                             │
│ Once story has shown the content + progression seam works,  │
│ tasks reuse them. HackerRank-style challenges are a graph,  │
│ not a list, so the progression contract may evolve here.    │
│                                                             │
│ Effort: medium (content) + small (code, reuses).            │
│ Risk: low if shapes are right; high if progression contract │
│ has to change after story ships.                            │
└─────────────────────────────────────────────────────────────┘
              │
              ▼  All four above are local-only. Below = server.
┌─────────────────────────────────────────────────────────────┐
│ 5 · SAME-DEVICE MULTIPLAYER ── no server, validates GameMode │
│                                                             │
│ Two humans on one device. No `OpponentProvider`. Exercises  │
│ the GameMode seam (B.1) cleanly because there is no engine. │
│ This is also a useful sanity check before the network       │
│ multiplayer cost.                                           │
│                                                             │
│ Effort: small. Risk: low.                                   │
└─────────────────────────────────────────────────────────────┘
              │
              ▼  Below this line all systems need server.
┌─────────────────────────────────────────────────────────────┐
│ 6 · STORAGE / SYNC LAYER ── prerequisite for 7, 8, 9        │
│                                                             │
│ Supabase or equivalent. Pulls user-owned data up (mirror_   │
│ matches, calibration_runs, feedback) and adds server-       │
│ canonical stores (ratings, multiplayer games). Auth lands   │
│ here. `players.id` stops being "local-player".              │
│                                                             │
│ Effort: large. Risk: medium. Validation: do the              │
│ migrations work for existing local users without loss?      │
└─────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────┐
│ 7 · CROSS-DEVICE MULTIPLAYER                                │
│                                                             │
│ `RemoteOpponent` implements `OpponentProvider`. Matchmaking │
│ store + transport layer. Same-device multiplayer's GameMode │
│ work pays off here.                                         │
│                                                             │
│ Effort: large. Risk: medium-high (real-time, abandonments). │
└─────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────┐
│ 8 · RANKED PLAY                                             │
│                                                             │
│ Needs a userbase (cross-device MP) and server infra. Don't  │
│ invest before there is something to rank. Ratings + KD +    │
│ badges layer over existing match storage.                   │
│                                                             │
│ Effort: medium (code) + ongoing (anti-abuse).               │
│ Risk: only worth it after MP retention is real.             │
└─────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────┐
│ 9 · ANALYSIS PLATFORM ── the largest, the latest            │
│                                                             │
│ Competing with chess.com / lichess for analysis means       │
│ eval bars, annotation, opening explorer, engine-line trees, │
│ shareable URLs. Several months of work even with the seams  │
│ in place. Build last, only if the user base is asking.      │
│                                                             │
│ Effort: very large. Risk: feature creep.                    │
└─────────────────────────────────────────────────────────────┘
```

### E.1 Reasoning summary

- **Mirror first** because the entire product is a bet on Mirror; without that bet paying off, the other six are speculative.
- **Children's + Story + Tasks before any server** because they share the content + progression + presentation seams and validate those abstractions while staying offline-cheap.
- **Same-device multiplayer before the server** because it forces the GameMode seam without the cost of a transport, and it's a useful product surface on its own.
- **Server / sync / auth as a single phase** because incremental sync without a sync layer is worse than no sync at all. Do not half-sync.
- **Ranked + cross-device MP gate on having users to serve.** Don't pre-build either.
- **Analysis platform last** because it is the largest scope, the most competitive against polished incumbents, and the most likely to drift into a tar pit.

### E.2 What this document does NOT recommend

- No "build all the seams as code now and feature-flag them off." That is exactly the scaffolding the audit prompt forbids.
- No reordering of the audit's existing fix commits to align with this plan. The Mirror builder picks up from green `main` as-is.
- No new dependencies. The seams above can all be expressed with the current dependency set.

---

## F · Open questions left for the next builder

1. **Is `calibrationStore` ever re-run by the same player?** Today the staleness rule abandons a 24-hour in-progress run. Multi-run history is not modeled. If the Mirror match wants to recompute the style vector from updated calibration data, do we keep a chain of `style_vectors` (we already have `previous_vector_id`) or a chain of `calibration_runs`?
2. **Does the Mirror need access to `mirror_matches` for self-tuning?** If yes, the GameMode that produces the match should write to `mirror_matches`, and the Mirror's reranker should read from it.
3. **Where does `feedback` go?** Local store today, but the whole point is that it reaches Anthropic. A flat-file export is sufficient for the beta cohort; a real submit pipeline is the storage seam's first server-side surface.
4. **Should `settingsStore` migrate from localStorage to IndexedDB?** Today it persists one key. If presentation modes add many keys, the IndexedDB stores are nicer to migrate. Defer until there is a second setting.
