# Visual Reality Audit

## Current State

MIRROR currently has a Mahabharata/Kurukshetra-inspired 2D theme, audio cues, board colors, and placeholder piece assets. The visual polish patch improves board framing, contrast, highlights, spacing, and promotion modal presentation, but it is not a realistic battlefield implementation.

## Current Issues

- Pieces are themed placeholders rather than realistic Mahabharata-era soldier models.
- The board is an improved 2D chessboard, not a physical Kurukshetra battlefield.
- Backgrounds do not yet provide sand, dust, rocks, cinematic lighting, or war-atmosphere motion.
- Movement and capture effects are lightweight UI feedback, not cinematic battle animation.
- Claims such as "realistic 3D battlefield" must be avoided until the 3D milestones ship.

## What Improved In This Milestone

- Board frame and contrast were improved.
- Piece images are constrained within square bounds.
- Last-move, selected-square, legal-move, capture, and check highlights are clearer.
- Promotion dialog uses a centered modal variant and clearer styling.
- Story landing now uses campaign act paths instead of a clue-first list.
- Shared design-system classes improve panels, buttons, badges, mode cards, and empty states.
- A later frontend production redesign added a shared app shell, grouped navigation, reusable UI primitives, rebuilt Play/Profile layouts, screenshot artifacts, and bounding-box QA. That milestone improves product presentation but still does not implement realistic 3D visuals.

## Visual Target

Future Kurukshetra visuals should include:

- realistic or high-quality stylized battlefield direction
- sand, dust, rocks, flags, and atmosphere
- cinematic but readable lighting
- soldier-like piece models with clear chess identity
- move animations
- non-gory capture effects
- check and checkmate effects
- 2D fallback
- mobile performance fallback
- reduced-motion fallback

## Copy Rules

- Current app copy should say "Kurukshetra-inspired theme" or "placeholder visual theme".
- Do not say "realistic 3D battlefield" until the real implementation exists.
- Do not imply copyrighted, paid, or externally licensed assets are bundled unless documented.

## 2026-06-11 — M-MIRROR-FULL-FRONTEND-3D-BATTLEFIELD-EXPECTATION-LOOP-1

- The app shell is now Apple Mono black/white/graphite; the beige/gold shell, parchment
  body wash, warm-ivory card tints, and gold primary buttons were removed and are guarded
  by tests (`src/test/monoSignal.test.tsx`) and the browser bug loop.
- A real 3D Kurukshetra Battlefield mode now exists (`src/three/`), and it is honestly a
  **procedural low-poly placeholder**: stylized soldiers/cavalry/advisors/chariots/
  commanders plus rocks/trees/banners/tents/elephant props generated in code. Zero binary
  assets, zero external requests (enforced by the performance check).
- The user's realistic target bar (AAA Mahabharata-era units) is documented in
  `3d-kurukshetra-visual-specification.md` and requires licensed/commissioned GLB models —
  UI copy must keep saying "stylized battlefield preview" until then.
