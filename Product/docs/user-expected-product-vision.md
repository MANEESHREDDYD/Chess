# MIRROR — User-Expected Product Vision

Milestone: M-MIRROR-FULL-FRONTEND-3D-BATTLEFIELD-EXPECTATION-LOOP-1
Date: 2026-06-11

This document captures, in plain language, exactly what the user expects MIRROR to look
like, feel like, and do. Every milestone that touches the frontend or the battlefield mode
must be checked against this document before tagging.

## 1. Overall product feeling

MIRROR should feel like a **premium Apple-style AI chess operating system** with an
optional **cinematic Kurukshetra battlefield experience**. Calm, fast, trustworthy,
comfortable for hours-long sessions. It should feel like a finished product from
Apple/Google/Meta/NVIDIA quality tiers — never like a styled prototype.

## 2. Apple-style black/white/graphite frontend expectation

- Light theme: white and soft gray pages (#F5F5F7), black text, clean depth — like apple.com.
- Dark theme: true black/graphite pages, silver text, soft glass cards. The agent owns the
  exact dark palette as long as it stays black/graphite-first and premium.
- 85% of every screen is black/white/gray. ~10% is soft surface depth. ~5% is functional accent.
- Blue is the one primary action color. Green = success only. Amber = warning only.
  Red = danger only. Bronze/gold = rare Story/Kurukshetra reward accent only.
- Never beige, never gold-heavy, never brown-heavy, never parchment as a page background.

## 3. Premium typography expectation

- System font stack everywhere (SF Pro/Segoe UI Variable class). No shipped Apple fonts.
- One refined serif voice allowed ONLY in Story mission titles.
- No serif buttons, nav, body, or controls. Crisp sizes/weights, generous line-height for body.

## 4. Button expectation

- One button system: blue primary (white text, ~44px, 12–14px radius), monochrome secondary,
  quiet ghost, red danger, green success, tiny bronze Story accent.
- Hover/focus/disabled states always visible. Never default browser buttons, never raw links
  as actions, never random colors.

## 5. Navigation expectation

- A single compact command bar (~64px): brand left, Play/Mirror/Story/Clue/Analytics/Profile
  center as quiet text tabs with a blue active state, Board Theme + Audio + More right.
- More and Board Theme are custom popovers (keyboard accessible, Escape/outside-click close).
  No native selects in the header. Mobile gets a bottom nav.

## 6. Board expectation

- The board is the hero of /play: large, centered, fully visible, never cropped, never hidden
  under the header, never overlapped by panels or toggles.
- Squares readable, pieces sized to their squares, no pieces rendered outside the board.
- Classic theme is tournament-neutral (gray/cream). Warm sand/clay colors are allowed only
  inside Kurukshetra board squares — never on the app shell.
- Interaction layer is functional: blue selection/last-move/legal-move hints, red check only.

## 7. 3D battlefield expectation

Kurukshetra Battlefield Mode should eventually feel like a real battlefield chess arena:
sand and dust, rocks and sparse trees, flags and banners, distant camps, cinematic sunlight,
chariots/horses/elephants/soldiers as readable piece identities, smooth move animations and
non-gory capture effects — all while the 8×8 grid stays instantly readable and chess.js
remains the only rules authority. Performance: 55–60 FPS desktop, graceful 2D fallback on
weak devices, reduced-motion respected, local assets only.

**Honesty rule:** if the current 3D is procedural low-poly placeholder art, the product and
docs must say so. No "realistic battlefield" claims until screenshots actually look like one.

## 8. Soldier / piece expectation

- Pawn = foot soldier (shield/spear), Knight = horse cavalry, Bishop = advisor/standard
  bearer, Rook = chariot/war tower, Queen = commander, King = royal commander with standard.
- Pandava/white = ivory/silver/steel with subtle blue cloth. Kaurava/black = graphite/dark
  metal with subtle maroon cloth. Silhouettes must read as chess roles at a glance.
- Cultural treatment is respectful; no religious parody, no sacred iconography as decoration.

## 9. Movement expectation

- Short, purposeful animations (180–250ms board moves): pawns glide, knights take a small
  leap arc, chariots roll heavily, advisors glide diagonally, queen moves with presence,
  king moves slow and weighty. Nothing slows the chess down.

## 10. Capture / kill effect expectation

- Non-gory, always: dust burst, brief flash, shield impact, captured piece dissolves to dust.
- No blood, no dismemberment, no gore. Kids mode reduces intensity further.

## 11. Story mode expectation

- A campaign, not a puzzle list: Acts I–III, mission cards with briefing/objective/reward,
  locked/current/completed states, the next mission visually highlighted.
- Tiny gold accents only; serif only in mission titles; never a parchment page;
  never clue-first wording — Story must not feel like Clue Chess.

## 12. Clue mode expectation

- A calm training studio: mode cards (Adaptive/Review/Streak/Boss/Kids), clean board during
  training, progressive clue levels, final reveal separated, evidence tags explaining why a
  clue was chosen. Blue selection, green progress.

## 13. Analytics expectation

- Actionable intelligence, not chart walls: top insights first, one clear next action,
  readable metric cards, every chart paired with a recommendation.

## 14. Profile expectation

- Player identity: level, XP progress, streak, achievements, next actions, backup card —
  polished and immediately scannable.

## 15. Bug-fix loop expectation

- Every visual claim is proven by fresh screenshots taken in a real browser, both themes,
  desktop and mobile viewports, with open-menu states. Automated assertions catch board
  crop/overflow, escaped pieces, toggle overlap, raw controls, and beige/gold leakage.
- Fix → re-screenshot → re-check. No tag until the loop is clean.

## 16. What must not happen again

- Tiny board in a huge empty canvas.
- Board cropped below the fold or hidden under the header.
- Pieces rendered/floating outside the board.
- Broken drag behavior or stuck drag ghosts.
- Appearance toggle covering the board or controls (it is a single icon-only switch,
  bottom-right, showing the theme you can switch TO).
- Broken More menu or Board Theme menu.
- Raw blue links, default browser buttons, native header selects.
- Beige/gold-heavy shell, parchment washes, serif UI chrome.
- Low-quality 3D presented as final realism.
- Story that reads like a Clue variant.
- Any UI claim without screenshot proof.
