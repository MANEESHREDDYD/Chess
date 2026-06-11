# MIRROR — Page-by-Page Frontend Design Contract

Milestone: M-MIRROR-FULL-FRONTEND-3D-BATTLEFIELD-EXPECTATION-LOOP-1
Date: 2026-06-11

Shared contract for every page (assumed below, not repeated):

- Shell: Apple Mono black/white/graphite; 64px command bar; bottom nav on mobile; single
  icon-only appearance switch fixed bottom-right (shows the theme you can switch to).
- Buttons/icons/typography per `interaction-design-contract.md` and
  `mirror-apple-mono-visual-system.md`.
- States: loading = quiet skeleton/“Setting up” chip, error = contained alert card with a
  primary recovery action, empty = EmptyState card with one next step. No raw text dumps.
- Animation: 120–180ms UI transitions; board moves 180–250ms; respect prefers-reduced-motion.
- Screenshot pass criteria (all pages): no horizontal overflow, header never covers content,
  no beige/gold shell, readable text in both themes, no raw links/buttons/selects.
- Interaction pass criteria (all pages): keyboard reachable controls, visible focus rings,
  Escape closes popovers, aria labels on icon buttons.

---

## 1. Play (`/play`)

- **Purpose:** premium normal-chess cockpit vs Stockfish.
- **First visual focus:** the board. Large, centered, fully visible above the fold when the
  viewport allows; never below ~480px even in short windows.
- **Layout:** desktop ≥1200px: controls (≤280px) | board column (1fr) | review+history
  (≤320px). 901–1199px: board spans full width centered, controls+history below in two
  columns. ≤900px: single column — board, controls, history.
- **Primary button:** New game – White (blue). Secondary: New game – Black; Ghost: Random,
  Download PGN. Danger: Resign (only while playing).
- **Compact context bar** (not a hero): "Play · STOCKFISH · LOCAL" + status chips (side,
  difficulty, board theme, engine state).
- **Hidden/collapsed:** review tools until game end; debug details behind a disclosure.
- **Error state:** engine failure shows alert + **Retry engine** + **Open Diagnostics**.
- **Must never:** tiny board, cropped board, floating piece, giant empty canvas, toggle over
  board, gold buttons.
- **Pass criteria:** board rect fully inside viewport at 1366×768; board ≥480px at desktop;
  appearance switch never intersects the board; all controls styled.

## 2. Mirror (`/mirror`)

- **Purpose:** play the AI opponent built from your own style ("AI opponent lab").
- **First focus:** empty state → Create Profile (blue) / board once active.
- **Layout:** personality selector + "Why Mirror moved" explanation panel beside the board;
  confidence/evidence chips under the explanation.
- **Primary:** Create Player Profile (empty) / personality Start. Pass criteria: explanation
  panel readable, evidence chips present, board obeys Play board rules.

## 3. Story (`/story`)

- **Purpose:** Kurukshetra campaign — a campaign map, not a puzzle list.
- **First focus:** the next available mission card, highlighted.
- **Layout:** acts as sections (Act I/II/III) with progress; mission cards with briefing,
  objective, reward preview, and locked/current/completed states; story serif only in
  mission titles; tiny bronze accents.
- **Must never:** read clue-first, become a text wall, paint parchment page backgrounds.
- **Pass criteria:** act structure visible, next mission highlighted, campaign wording.

## 4. Clue Chess (`/clue-chess`)

- **Purpose:** calm training studio.
- **First focus:** mode cards (Adaptive/Review/Streak/Boss/Kids) with a blue selected state.
- **Layout:** mode cards → stats strip → board + clue rail; clue levels progressive; final
  reveal separated; evidence tag explains why each clue was chosen.
- **Pass criteria:** monochrome cards, green progress, gold only on boss/reward accents.

## 5. Analytics (`/analytics`)

- **Purpose:** actionable intelligence.
- **First focus:** headline insights, then one recommended next action.
- **Layout:** summary metric cards → sections in a two-column grid → findings each with a
  linked recommendation. Blue = analysis, green = improvement, red = critical weakness only.
- **Pass criteria:** a visible recommended action; no chart wall; readable in both themes.

## 6. Profile (`/progress`)

- **Purpose:** player identity.
- **First focus:** level + XP progress.
- **Layout:** identity hero (level, XP bar, streak) → next-action cards → achievements →
  backup card. Green XP/progress, blue actions.
- **Pass criteria:** XP/progress visible; achievements preview; backup reachable.

## 7. Game Review (`/review/:sourceType/:sourceId`)

- **Purpose:** review studio.
- **First focus:** board replay with the move timeline beside/below.
- **Layout:** summary metrics (accuracy, CP loss) → board + key moments → full move timeline
  with classification pills; retry-mistake action; export.
- **Pass criteria:** timeline visible, classification pills use semantic tokens only.

## 8. Import Games (`/import-pgn`)

- **Purpose:** three-step PGN import: paste/upload → validate → save/analyze.
- **First focus:** the paste/upload panel; steps visually ordered; invalid games explained
  per-row; stats after validation.
- **Pass criteria:** the 3 steps obvious, table contained, no raw file-input chrome.

## 9. Coach (`/coach-preview`)

- **Purpose:** evidence-based local coach preview.
- **Layout:** coach insight cards with evidence chips, confidence, safety result, exports.
- **Pass criteria:** cards monochrome, evidence visible, export buttons styled.

## 10. Calibration (`/calibration`)

- **Purpose:** measure the player's style (8 tasks).
- **Layout:** progress rail left, task stage right; task stats chips; boards obey board rules.
- **Pass criteria:** task progress visible, board fully visible, controls styled.

## 11. About (`/about`, `/about-project`)

- **Purpose:** credits, licenses, project story.
- **Layout:** narrow readable column, anchored headings, real links (underlined only in body
  prose), GPL notices.
- **Pass criteria:** typography clean; no raw default-blue links.

## 12. Engine Diagnostics (`/stockfish-diagnostics`)

- **Purpose:** developer console for the local engine.
- **Layout:** action row (run checks, copy diagnostics) → phase timeline → raw messages in a
  contained mono-font console panel.
- **Pass criteria:** console contained (no page-wide pre overflow), phases readable.

---

## 3D Battlefield (mode of /play and Story encounters, when enabled)

- **Purpose:** optional cinematic Kurukshetra arena for the same chess game.
- **First focus:** the embedded 8×8 board — readable before any scenery.
- **Layout:** 2D/3D segmented toggle near the board; 3D canvas replaces the 2D board only;
  all surrounding cockpit UI unchanged; camera presets (default/top); WebGL-missing or
  reduced-motion → automatic 2D fallback with a quiet notice.
- **Pass criteria:** squares/pieces readable in screenshots; fallback renders the stable 2D
  board; no rules logic inside the 3D layer (chess.js/gameStore stay authoritative).
