# Phase 1 Plan — Agent B · Calibration & Style Vector

> Status as of 2026-05-27: implementation has not yet begun.
> See git log and STATUS_AUDIT_*.md for current state.

STATUS: approved plan, NOT yet implemented.

**Workspace:** `C:\Users\md200\OneDrive\Desktop\Chess\Product\` (the OneDrive path; no relocation occurred in Phase 0)
**Status of prerequisites you cited:**

> **Locked implementation update, 2026-05-26:** This plan is approved with revisions. `Product/` has the Phase 0 baseline commit tagged `v0.1.0-stage0-baseline`, plus the pre-Phase-1 housekeeping commit on top. The canonical tree is `Product/`.

This plan no longer blocks on approval. Implementation proceeds in the exact sequence locked by the human.

## 0 - Locked implementation revisions

- `calibrationStore` is a separate Zustand store in `src/state/calibrationStore.ts`.
- `swindle_preference` is the 9th dimension with type `'principled' | 'swindle' | null`; it renders as a small tag below the radar and is never a radar axis.
- Vitest gets a separate `vitest.config.ts` using `environment: 'jsdom'`, `globals: true`, and `setupFiles: ['./src/test/setup.ts']`.
- Task 8 uses `src/engine/calibrationOpponent.ts`, a calibration-only Stockfish helper with Skill Level 8 and depth 6. It must not import from the Mirror flow and must tear down when calibration completes.
- Tests use fixture-based aggressive and defensive calibration runs, plus synthetic NaN edge cases.
- `eloDetect` clamps to `[800, 2100]` using `clamp(1000 + 600*tactical + 200*endgame + 300*vyasa, 800, 2100)`.
- Task 5 uses interactive step-through: after the chosen move, render 3 plies, advance one ply per Next click or board tap, animate each ply in about 250ms, show the outcome label, then auto-advance after 1 second.
- Tuned radar edits always create a new `style_vectors` row with `source: 'tuned'` and `previous_vector_id`; never overwrite a calibration-source vector.
- Desktop radar is used above 600px. Below 600px, render the same 8 axes as a vertical slider list with full labels and current values. Both emit the same `onChange(newVector)` callback.
- Vyasa Task 8 conditional lines must pass the specificity test before commit; rejected lines and replacements are listed in the report.
- In-progress calibration resumes from the last completed task unless `started_at` is more than 24 hours old; then mark abandoned and start over. Show only "Resuming from Task N."
- The Phase 1 report must include depth-14 verification for each calibration position, rejected Vyasa lines and replacements, side-by-side fixture vectors, and a 360px mobile screenshot.

### Exact commit sequence

1. `feat(db): IndexedDB schema for calibration + style vectors`
2. `feat(ml): style vector with 9 dimensions + fixture-based tests`
3. `feat(ml): detected_elo heuristic with band assignment`
4. `feat(engine): isolated calibration opponent`
5. `feat(state): calibration store with resume support`
6. `feat(data): 8 calibration tasks with verified positions`
7. Task components, per task or batched
8. `feat(calibration): task progress strip`
9. `feat(ui): style vector radar with mobile slider fallback`
10. `feat(routes): calibration flow wired end-to-end`
11. `feat(routes): profile page with style vector`
12. `feat(ui): home CTA for calibration, play page copy`
13. `docs: phase 1 report`, then tag `v0.2.0-agent-b` only after checkpoint revisions are absorbed.

> **Current audit update, 2026-05-22:** This plan predates the latest cleanup. The active repo now has Git initialized, a full `LICENSE`, request-scoped Stockfish bridge calls, and `src/state/gameStore.test.ts`.

- `npm run typecheck` / `npm run build` / `npm run dev` — **all green** on current tree (verified end of Phase 0).
- `git log` tag `v0.1.0-stage0-baseline` — **does not exist.** You told me to skip the commit in Phase 0. No `.git` directory exists. See **§9 Open Questions** for the decision needed before this phase's tag.

> 2026-05-26 correction: The previous bullet is historical; the tag now exists on the Phase 0 baseline commit.

This historical draft sentence is superseded by the locked approval above.

---

## 1 · Goal & guardrails (recap, for shared context)

A user clicks **Begin Calibration** from Home, completes 8 tasks in 12–18 minutes, lands on `/profile` with an editable 8-axis radar, and that vector persists across reloads via IndexedDB. The vector becomes Agent C's input next phase.

**Guardrails I will not violate:**
- No new npm dependencies. Radar is hand-rolled SVG.
- No edits to `src/engine/*` except a thin `playStockfishMatch(skill, depth, onMove)` helper for Task 8, documented and isolated from Mirror-bound code.
- No edits under `docs/` except adding `phase-1-plan.md` (this file) and later `phase-1-report.md`.
- Every Vyasa line is **original prose** — no quotes from source material.
- No emoji, no modern icons. Manuscript aesthetic.

---

## 2 · File creation order & dependency graph

The order matters because later files import earlier ones. I'll build bottom-up:

```
1. src/data/calibrationPositions.json     (pure data; no deps)
2. src/data/db.ts                         (idb schema; depends on types only)
3. src/ml/styleVector.ts                  (types + compute; depends on chess.js)
4. src/ml/styleVector.test.ts             (Vitest)
5. src/lib/eloDetect.ts                   (depends on styleVector types)
6. src/state/calibrationStore.ts          (Zustand; new — orchestrates the 8-task run)
7. src/engine/stockfishMatch.ts           (thin helper for Task 8 ONLY)
8. src/components/Calibration/Progress.tsx
9. src/components/Calibration/Task1Tactical.tsx       (tactical_sight)
10. src/components/Calibration/Task2OpeningChoice.tsx
11. src/components/Calibration/Task3Endgame.tsx
12. src/components/Calibration/Task4TacticalRace.tsx
13. src/components/Calibration/Task5MoralChess.tsx
14. src/components/Calibration/Task6BlackRepertoire.tsx
15. src/components/Calibration/Task7Exchange.tsx
16. src/components/Calibration/Task8VyasaMatch.tsx
17. src/components/Mirror/StyleVectorRadar.tsx
18. src/components/Mirror/styleSummary.ts                (deterministic prose generator)
19. src/routes/Calibration.tsx
20. src/routes/Profile.tsx
21. Update src/routes/Home.tsx (primary CTA)
22. Update src/routes/Play.tsx (note copy)
23. Update src/state/gameStore.ts if Task 8 needs hooks (TBD)
24. CSS additions to src/styles/global.css for the manuscript task screens
```

`src/state/calibrationStore.ts` is **new** — not in your brief's file list, but needed: each task component needs to write its result somewhere observable while the router decides when to advance. Putting state in IndexedDB on every keystroke is wrong; putting it in component-local state breaks the "resume mid-calibration" requirement. A Zustand store mediating between the two solves both. **Flag for your approval.**

---

## 3 · The 8 tasks — design, FEN sketches, Vyasa lines

Final FENs will be verified at Stockfish depth 14 during implementation (per your design principle 5). What's below is the design intent + a credible sketch FEN. If verification at depth 14 shows the position doesn't behave as designed (e.g., the "best" move isn't ≥150 cp better), I'll source a replacement from Lichess CC0 puzzle DB and record the swap in the report.

> **Vyasa voice contract:** patient, slightly weary, sometimes amused. Measured, occasional pause mid-sentence. Old-fashioned phrasing. Never raises voice. Never modern slang. ≤2 sentences per task screen. (Source: v3 §3 Vyasa character page, lines 670–696.)

### Task 1 — `tactical_sight` (4 positions, motif-tagged)

- **What it measures:** Tactical sight across the four core motifs (fork, pin, skewer, removing-the-defender) without time pressure.
- **Soft timer:** 60s per position. Hard timer: 90s.
- **Structure:** 4 positions, each with 3 candidate moves. Exactly one is best by ≥150 cp at depth 14; the other two are plausible-but-worse.
- **Sketch FENs (one per motif):**
  - *Fork* (knight fork on K+Q): a position after `1.e4 e5 2.Nf3 Nc6 3.Bc4 Nd4? 4.Nxe5 Qg5 5.Nxf7` style — candidate FEN `r1bqkbnr/pppp1ppp/8/4p3/2B1n3/5N2/PPPP1PPP/RNBQK2R w KQkq - 2 4`. Best: `Nxe5`. Candidates also include `Nxd4` (good but inferior) and `O-O` (slow).
  - *Pin* (absolute pin on knight by Bg5): position after typical Italian/Spanish where ...Bg4 pins ...Nf3 against the queen — `r1bqkb1r/pppp1ppp/2n2n2/4p3/4P3/2N2N2/PPPP1PPP/R1BQKB1R w KQkq - 4 4` with a candidate move requiring breaking the pin awareness.
  - *Skewer* (queen skewer through king to rook): a back-rank construction — `4r1k1/ppp2ppp/8/8/8/8/PPP2PPP/3RR1K1 w - - 0 1`. Best: `Re8+ Rxe8 Rxe8+`.
  - *Removing the defender* (capture-the-defender of a key square): a classic `Bxh6` or `Rxc6` motif — sketch FEN reserved for implementation.
- **Tracks:** `motif_blindness.{fork,pin,skewer,removing_the_defender}` (each 0..1, higher = more often missed).
- **Vyasa line:** *"Show me what you see. Three moves are possible — only one of them is honest."*

### Task 2 — `opening_choice` (1 position, 6 candidates)

- **What it measures:** White repertoire preference. No correct answer.
- **Soft timer:** 90s. Hard: 120s.
- **Structure:** Starting position. User clicks one piece-emblazoned button: `1.e4`, `1.d4`, `1.c4`, `1.Nf3`, `1.b3`, `1.f4`.
- **Tracks:** `opening_white_top3` (single choice in Phase 1; the "top 3" semantics emerge from Mirror match history in Phase 2 — for Phase 1, this is a 1-item array).
- **Vyasa line:** *"Begin a game in the way that pleases you. There are six doors. Walk through one."*

### Task 3 — `endgame_technique` (K+R+P vs K+R, full play)

- **What it measures:** Endgame conversion technique under unhurried conditions.
- **Soft timer:** 120s total. Hard: 150s. (Note: this is wall-clock, not chess clock. The user has 2 minutes to demonstrate the technique or it's marked unconverted.)
- **Position:** Lucena-position or near-Lucena setup, White to move. FEN candidate: `1K6/1P1k4/8/8/8/8/r7/2R5 w - - 0 1` (classic Lucena).
- **Engine:** Stockfish at depth 6 plays defense (deliberately weak, per your brief — depth 6 will still be strict enough that the user needs to know the bridge/box-up technique).
- **Scoring:** Pawn promotes within 25 moves OR mate delivered within 25 moves → `endgame_strength = 1.0`. Else `endgame_strength = 0.0`. Partial credit (0.5) if pawn reaches 7th rank but is captured.
- **Tracks:** `endgame_strength` (0..1).
- **Vyasa line:** *"An old position. The pawn wishes to become a queen — the black rook is unwilling to allow it. Convince it."*

### Task 4 — `tactical_race` (4 positions, 15s each)

- **What it measures:** Tactical sight under time pressure → `time_pressure_blunder_rate`.
- **Soft timer:** 15s per position. Hard: 20s. (Aggregate hard: 80s.)
- **Structure:** Same shape as Task 1 — 3 candidates per position, one best by ≥150 cp. Different positions from Task 1; same four motifs in shuffled order to avoid order effects.
- **Tracks:** `time_pressure_blunder_rate` = (incorrect_or_timed_out / 4). A user who solved Task 1 but blows Task 4 is the canonical "panic under pressure" profile.
- **Vyasa line:** *"The same kind of question, but less time. A man under pressure shows you what he is."*

### Task 5 — `moral_chess` (1 position, style choice, **no score**)

- **What it measures:** Swindle vs. patient preference — a style signal, not a skill signal.
- **Soft timer:** 60s. Hard: 90s.
- **Position:** A middlegame where:
  - Move A ("patient line"): a quiet positional move that maintains a ≥150 cp advantage at depth 14 with no opponent-error dependency.
  - Move B ("swindle"): a tactical lunge that wins ≥300 cp **only if** Black plays one specific sub-optimal response within the next 3 plies; otherwise loses ≥80 cp.
- **UI:** After click, render 3 plies of the chosen line. The user advances one ply at a time with **Next** or by tapping the board on mobile. Each ply animates in about 250ms. After ply 3, show the outcome label, then auto-advance to Task 6 after 1 second.
- **Locked track shape:** `swindle_preference: 'principled' | 'swindle' | null`; `null` when Task 5 is skipped or timed out.
- **Tracks:** **`swindle_preference`** - `'principled' | 'swindle' | null`; it is a 9th style dimension, not a radar axis.
- **Vyasa line:** *"Two paths to the same destination. One is long and certain. The other is short, and depends on your opponent erring. Choose."*

### Task 6 — `black_repertoire` (2 positions, 4 candidates each)

- **What it measures:** Black repertoire preference.
- **Soft timer:** 60s per position. Hard: 90s.
- **Structure:**
  - Position 1: after `1.e4`. Buttons: `...e5`, `...c5`, `...e6`, `...c6`.
  - Position 2: after `1.d4`. Buttons: `...d5`, `...Nf6`, `...f5`, `...e6`.
- **Tracks:** `opening_black_top3` (1-item array in Phase 1).
- **Vyasa line:** *"Now you sit on the other side of the board. They have moved first. What do you answer?"*

### Task 7 — `exchange_willingness` (4 positions)

- **What it measures:** `exchange_willingness` + `preferred_minor`.
- **Soft timer:** 30s per position. Hard: 45s.
- **Structure:** Each position offers a clean equal trade. User chooses **Accept** or **Decline**. All four positions are within ±50 cp at depth 14 either way — so neither choice is "winning."
- **Minor-piece signal:**
  - 2 positions: a knight-for-bishop trade (one offered with the user keeping a knight, one keeping a bishop)
  - 2 positions: a bishop-for-knight trade (mirror)
  - Aggregated: if user consistently keeps knights → `preferred_minor = 'knight'`. Consistently keeps bishops → `'bishop'`. Mixed → `'neutral'`.
- **Tracks:** `exchange_willingness` (accept-rate, 0..1), `preferred_minor`.
- **Vyasa line:** *"Trades are offered. Some men accept everything that looks equal. Some refuse on principle. Which are you today?"*

### Task 8 — `vyasa_match` (full game vs Stockfish skill 8, depth 6, 5+3)

- **What it measures:** `avg_move_time_ms`, blunder phase distribution, and `detected_elo`.
- **Time control:** 5+3 chess clock (user clock; engine moves are forced near-instant for skill-level emulation).
- **Engine:** Stockfish at **UCI_LimitStrength=true, UCI_Elo≈1500** OR `Skill Level 8` (whichever the existing worker exposes; currently the worker only takes `depth` — I'll add a minimal `setSkill` message to `stockfish.worker.ts` ONLY for Task 8). Limited to depth 6 as a hard cap.
- **Game end:** resign, mate, draw by 3-fold/insufficient/50-move, OR clock flag.
- **Conditional Vyasa interventions:** Vyasa speaks 3 times — after moves 8, 16, 24 if the game has reached that point. Line is chosen from the library below based on detected game state.

**Library of 12 conditional lines** (state → line):

| Trigger | Line |
| --- | --- |
| `ahead_in_material` (Δ ≥ +1.5 pawn equivalent) | *"You are ahead. This is when most apprentices throw the game away."* |
| `behind_in_material` (Δ ≤ −1.5) | *"Material is against you. The position need not be."* |
| `balanced` (\|Δ\| < 1.0, eval \|cp\| < 80) | *"Even, still. We are honest with each other today."* |
| `winning_endgame` (≤ 12 pieces, eval ≥ +200 cp) | *"You have arrived. Do not stumble at the door."* |
| `losing_endgame` (≤ 12 pieces, eval ≤ −200 cp) | *"I am ahead now. I will not show mercy out of politeness."* |
| `time_pressure` (clock < 30s after move 16) | *"Your clock runs faster than your thinking. Slow the one, or the other will."* |
| `after_blunder` (cp_loss > 200 on last user move) | *"An expensive move. We learn from these, or we are condemned to repeat them."* |
| `after_brilliancy` (last user move = engine first choice AND eval improved ≥150 cp) | *"That, I did not see. I will need to think tonight about how."* |
| `opening_phase` (move ≤ 8 catch-all) | *"We are still arranging our houses. The fight comes later."* |
| `middlegame_opening` (move 16 catch-all) | *"Now you tell me what kind of game we are playing."* |
| `queens_exchanged` (Q-trade in last 4 plies) | *"Without the queens, the position breathes differently. Or it suffocates. We shall see."* |
| `match_end` (any terminal) | *"Enough. Close the board."* |

Selection: at intervention point, evaluate triggers in priority order (after_brilliancy > after_blunder > time_pressure > queens_exchanged > ahead/behind > winning/losing > opening_phase > middlegame_opening). Catch-all guarantees one line is always available.

- **Tracks:** `avg_move_time_ms` (mean of user move durations), blunder phase counts (opening/middlegame/endgame cp_loss>200 totals), `vyasa_match_result` (win/loss/draw), `vyasa_avg_cp_loss`.
- **Vyasa task-open line:** *"Enough preparation. Let us play. Five minutes each, with three for safety. I will speak when I have something to say."*

---

## 4 · `StyleVector` interface (proposed, with swindle_preference)

```ts
export interface StyleVector {
  // 1. Opening repertoire
  opening_white_top3: string[];           // ['e4'] in Phase 1
  opening_black_top3: string[];           // ['e5', 'd5'] (vs e4, vs d4)

  // 2. Time signature
  avg_move_time_ms: number;               // from Task 8
  time_pressure_blunder_rate: number;     // 0..1, from Task 4

  // 3. Trade behaviour
  exchange_willingness: number;           // 0..1, from Task 7
  preferred_minor: 'knight' | 'bishop' | 'neutral';

  // 4. Tactical sight
  motif_blindness: {
    fork: number;                         // each 0..1, higher = more often missed
    pin: number;
    skewer: number;
    removing_the_defender: number;
  };

  // 5. Endgame
  endgame_strength: number;               // 0..1, from Task 3

  // 6. 9th dimension, not rendered as a radar axis
  swindle_preference: 'principled' | 'swindle' | null;

  // derived
  detected_elo: number;
  elo_band: 'apprentice' | 'initiate' | 'adept' | 'master';

  // metadata for forward compatibility
  schema_version: 1;
}
```

This shape is forward-compatible with v4 §11's `MirrorConfig.styleVector` consumer — Agent C reads `motif_blindness.fork|pin|skewer|removing_the_defender` and the other fields directly. No mismatch.

---

## 5 · `eloDetect` — math, comments, and limitations

A heuristic, not a rating system. Documented as such.

```
inputs:
  t1_correct:        int 0..4
  t4_correct:        int 0..4   (timed-out positions count as incorrect)
  t3_converted:      'full' | 'partial' | 'none'   (full=mate or promote, partial=7th rank, none=other)
  t8_result:         'win' | 'draw' | 'loss' | 'abandoned'
  t8_avg_cp_loss:    number (centipawns; abandoned → 999)

tactical_score   = (t1_correct + t4_correct) / 8          # 0..1
endgame_score    = {full:1.0, partial:0.5, none:0.0}[t3_converted]
result_factor    = {win:1.0, draw:0.5, loss:0.0, abandoned:0.0}[t8_result]
cp_loss_factor   = if t8_avg_cp_loss <  30: 1.0
                   if t8_avg_cp_loss <  70: 0.7
                   if t8_avg_cp_loss < 150: 0.4
                   else:                    0.1
vyasa_score      = 0.5 * result_factor + 0.5 * cp_loss_factor

detected_elo     = round( 1000
                          + 600 * tactical_score      # 0..600
                          + 200 * endgame_score       # 0..200
                          + 300 * vyasa_score         # 0..300
                        )                              # range 1000..2100

clamp detected_elo to [800, 2100] for safety

elo_band         = if elo < 1200: 'apprentice'
                   if elo < 1500: 'initiate'
                   if elo < 1800: 'adept'
                   else:          'master'

// Band table to copy into eloDetect.ts:
// elo < 1200          -> apprentice
// 1200 <= elo < 1500  -> initiate
// 1500 <= elo < 1800  -> adept
// elo >= 1800         -> master
```

**Edge-case defaults** (NEVER NaN, per design principle):

| Scenario | tactical | endgame | vyasa | elo | band |
| --- | --- | --- | --- | --- | --- |
| All tasks timed out | 0 | 0 | 0 | 1000 | apprentice |
| Resigned Task 8 in 3 moves (no Vyasa data) | use Tasks 1+4 | from Task 3 if available | result_factor=0, cp_loss_factor=0.1 | computed normally | computed |
| Skipped Task 3 somehow | 0 | 0 | normal | computed | computed |

**Limitations to document inline in `eloDetect.ts`:**
1. This is a single-session heuristic; real Elo requires many games. Stage 2 should recompute from match history.
2. Adept and master are under-discriminated — both require strong tactical + endgame play, and the formula caps at 2100.
3. The formula is calibrated against the bands in v2 (Apprentice <1200, Initiate 1200-1500, Adept 1500-1800, Master ≥1800). If band thresholds shift in a later v4 doc edit, re-tune.

---

## 6 · The 9th dimension: `swindle_preference` — **LOCKED: ADD**

**Yes, I recommend adding it.** Rationale:

1. **It's the cleanest free signal in the calibration.** Task 5 already exists, and its sole output is this binary. Dropping it discards the only piece of pure-style (vs. skill) information the calibration captures.
2. **Downstream consumer is identified.** v3 §3 already specifies that Yudhishthira has a "no-swindle constraint" (line 739) and Bhima has an "attacking bias" — character chess signatures already presuppose this dimension exists. Mirror generation in Phase 2 will want it to tune the exploitation layer (§11): a swindle-preferring player will fall harder for swindle-style traps and the Mirror should bait them.
3. **Zero radar-axis cost.** It doesn't fit the 8 axes; render it as a small annotation below the radar - "Tends toward the principled line" / "Tends toward the swindle" - *not* as a 9th axis. The radar stays octagonal.
4. **Schema-compatible.** It is nullable so skipped or timed-out Task 5 runs parse cleanly.

Decision locked: add it with type `'principled' | 'swindle' | null`.

---

## 7 · Mobile responsive radar strategy

Locked revision: viewports below 600px render a vertical slider list instead of the SVG radar. Each slider shows the full plain-English axis label, current value, and touch drag behavior. Viewports 600px and wider render the SVG radar with 8 draggable endpoints. Both forms emit the same `onChange(newVector)` callback and share the same summary line below.

Pure SVG. No charting library. Geometry:

- Root element: `<svg viewBox="0 0 600 600" preserveAspectRatio="xMidYMid meet" width="100%" style="max-width: 600px">`
- Concentric ring grid at 0.2/0.4/0.6/0.8/1.0 of radius, stroke `var(--rule)` 60% opacity.
- 8 radial spokes at 45° intervals, same stroke.
- Vector polygon: `<polygon>` filled with Pandava indigo at 20% opacity, stroked with Pandava gold.
- Axis labels: rendered with `<text>` at radius 1.15. Font: `'Lora', serif`. Two-line labels accepted via `<tspan>`.
- Drag handles: a 12-radius `<circle>` at each polygon vertex, with a transparent 24-radius `<circle>` overlay for touch hit area.

**Interaction:** pointer events (`onPointerDown`/`Move`/`Up`) on the document during a drag. `preventDefault` on pointer-down to suppress mobile scroll/zoom. On `pointerup`, compute the new normalized value for that axis (0..1), call `onChange(newVector)`, persist immediately to IndexedDB.

**Breakpoints:**

| Viewport | Radar size | Label font | Layout |
| --- | --- | --- | --- |
| ≥ 720px | 600 × 600 px | 14px | Radar centered, summary below |
| 480–720px | fluid 100%, max 480 | 13px | Same |
| < 480px (iPhone SE width 375) | fluid 100%, max 360 | 11px, labels wrap to 2 lines | Same |

Touch targets minimum 24px diameter (handle + halo). iOS Safari rubber-band suppressed by `touch-action: none` on the SVG during drag.

---

## 8 · State / persistence flow

```
USER ACTION                 STATE WRITE                          INDEXEDDB WRITE
-----------                 -----------                          ---------------
Begin calibration           store.startRun() → runId             calibration_runs row, status='in_progress'
Complete Task N             store.recordTask(N, output)          calibration_runs.tasks[tN] = output
Complete Task 8 (final)     store.completeRun()                  calibration_runs.status='completed',
                                                                  style_vectors row (computed),
                                                                  players row updated
                                                                  (current_style_vector_id)
Drag a radar axis           store.tuneVector(field, value)       new style_vectors row source='tuned',
                                                                  previous_vector_id = prior vector id,
                                                                  players row updated
Navigate away mid-task      (nothing immediate)                  next visit loads in_progress run,
                                                                  resumes at first incomplete task
Click "Redo calibration"    store.abandonRun()                   calibration_runs.status='abandoned',
                                                                  new run started
```

The IndexedDB schema matches your brief's spec (3 stores: players, calibration_runs, style_vectors; indices on started_at and computed_at; `previous_vector_id` on tuned rows; `onupgradeneeded` handler in place for Phase 2 extension). Calibration-source vectors are ground truth and are never overwritten.

---

## 9 · Decisions — locked before coding

All questions in the original draft are answered by the 2026-05-26 directive. The numbered items below remain only as historical context.

1. **Approve `src/state/calibrationStore.ts`?** Not in your file list but justified in §2. If you'd rather inline state in the route component, say so and I'll redesign.

2. **Approve `swindle_preference` 9th dimension?** Recommended yes per §6.

3. **Git init now or after the phase?** Without a repo, your commit & tag step (`v0.2.0-agent-b`) can't run. Options:
   - (a) `git init` now in `Product/`, retroactive `v0.1.0-stage0-baseline` tag on a "Phase 0 baseline" commit, then this phase's commit + tag at the end.
   - (b) `git init` now, single initial commit covering everything, this phase's commit + tag at the end. (No retroactive Phase 0 tag.)
   - (c) Stay un-versioned for one more phase. Commit & tag step deferred.
   - Recommendation: **(a)** — gives proper baseline-to-baseline diffs starting now.

4. **Vitest config.** `vitest` is in devDependencies but no `vitest.config.ts` exists. The default config + `tsconfig.json` is enough for the `.test.ts` files I'll add. Confirm it's OK to leave config implicit, or ask me to add an explicit `vitest.config.ts`.

5. **Engine helper for Task 8.** I plan a `src/engine/stockfishMatch.ts` (~40 lines) that wraps the existing `stockfishBridge.ts` with: skill-level setting (`setoption name Skill Level value 8`), depth cap, and a move-by-move callback. **Question:** the brief says "Do NOT modify `src/engine/*` unless task 8 needs hook points... add a minimal helper... and isolate it from the existing Mirror-bound code path." That's what I plan to do. The helper goes in `src/engine/` — confirm that counts as "minimal helper" and not "modification."

6. **Path collision risk.** Your brief specifies `src/components/Calibration/Task1Tactical.tsx` etc. through `Task8VyasaMatch.tsx`. The Phase 0 directory has no `Calibration/` subfolder. Creating it is uncontroversial. **No question — just flagging.**

7. **Differentiation test data.** The test requires "two opposite-style mock runs differ on ≥4 of 8 dimensions." I'll hand-craft two `CalibrationRunData` fixtures (aggressive: blitzes Task 4, takes the swindle in Task 5, blunders endgame; defensive: thinks long, declines all trades, converts endgame). Confirm fixture-based testing is acceptable; alternatives would be property-based testing with `fast-check` (would require new dep — out of scope).

---

## 10 · Time estimate

Rough, assuming reasonable continuous sessions:

| Day | Work | Hours |
| --- | --- | --- |
| 1 | Position FENs + depth-14 verification + Vyasa lines finalized + db.ts + calibrationPositions.json | 4–5 |
| 2 | styleVector.ts + styleVector.test.ts + eloDetect.ts + tests | 4–5 |
| 3 | Tasks 1, 2, 6, 7 components + Progress.tsx | 5–6 |
| 4 | Tasks 3, 4, 5, 8 components + stockfishMatch.ts | 5–6 |
| 5 | Calibration.tsx router + resume flow + calibrationStore | 3–4 |
| 6 | StyleVectorRadar.tsx + styleSummary.ts + Profile.tsx | 5–6 |
| 7 | Manual run-through (2 styles), screenshots, fixes, phase-1-report.md | 3–4 |

**Total: ~30–35 hours over 5–7 working sessions.** Matches your brief's 4–5 days estimate for Agent B if "day" is interpreted as ~7-hour session.

---

## 11 · Acceptance gates (recap from your brief — for the report)

- [ ] `npm run typecheck` exit 0
- [ ] `npm test` all green; differentiation test passes (aggressive vs defensive runs differ on ≥4 dims)
- [ ] `npm run build` exit 0
- [ ] Manual: Home → Begin Calibration → all 8 tasks → /profile with populated radar, 12–18 min wall clock
- [ ] Refresh `/profile` → radar persists
- [ ] Drag a radar axis → vector updates, no console errors
- [ ] Two run-throughs with deliberately opposite styles → visibly different radars

---

## 12 · What I'll write in `phase-1-report.md` (sketch, for your visibility)

- Files created (lines), files modified (lines)
- Final FEN list with depth-14 verification notes (cp delta of best vs second-best per position; cited Lichess study IDs for any sourced positions)
- Vitest output, in full
- Two screenshot descriptions: aggressive radar polygon vs defensive radar polygon, summary lines for each
- Actual measured timing per task during my own test run-through
- Anything I stubbed for Phase 2 (e.g., `opening_white_top3` carries only 1 entry until Mirror match history exists)
- Deviations from this plan, with reasons
- PASS or BLOCKED verdict

---

## STOP

I will not write code until you reply. The minimum responses I need:

- (1) **calibrationStore.ts** — yes / no / different design
- (2) **swindle_preference** — add / drop
- (3) **git** — option a / b / c
- (4) **vitest config** — implicit / add explicit file
- (5) **stockfishMatch helper** — OK as described / different boundary
- (6) **fixture-based differentiation test** — OK / alternative

Anything else is fair game to push back on. I'd rather take edits now than rework later.
