# Kurukshetra 3D — Reference-Based Expectation

Milestone: M-REFERENCE-LOCKED-APPLE-MONO-UI-AND-BOARD-HITTEST-FIX-1
Status: **reference analysis in progress — final asset integration is NOT approved.**
Companion: `3d-reference-lock-brief.md`, `design-references/README.md`.

The user provides references; the agent analyzes them here. No final asset work starts
until this analysis is approved by the user (next milestone:
M-3D-REFERENCE-ANALYSIS-AND-ASSET-BRIEF-1).

## Analysis of references provided so far (in-session imagery, 2026-06-11)

The user shared unit-board imagery: a hero archer (turnaround sheets + macro face/draw
shots), horse archers, camel archers, war-elephant archers (howdah tower units), minister's
chariot and king's war chariot (ornate gold, open-top, multi-horse team), and large
variant grids of armored/caparisoned elephants, horses, and camels in a desert setting
with fort-wall backdrops.

1. **Overall visual fidelity:** stylized-REALISTIC, AAA-like presentation (PBR leather,
   bronze, cloth; grounded studio/desert lighting). Clearly above mobile-game tier; below
   photoreal cinema. This is the working fidelity target.
2. **Camera:** unit renders are ground-level 3/4 views; for chess play this translates to
   a tilted strategy camera (~35–50°) with constrained orbit (already prototyped), plus
   close-in unit presentation angles for menus/intros.
3. **Terrain:** warm sand/dust ground, hazy desert air, distant fort walls / camp
   silhouettes as the horizon identity; rocks and sparse trees as accents — battlefield
   boundary readable.
4. **Pieces / units:** human warriors with leather cuirasses, dhoti, head wraps; mounts
   (horse/camel/elephant) with layered caparisons and plate armor variants; howdah towers
   on elephants; ornate ministerial/royal chariots; faction accents = deep blue vs maroon
   cloth (maps to Pandava/Kaurava sides).
5. **Weapons:** recurve longbows + back quivers (signature), spears, swords, maces/gada,
   round shields, chariot wheels as identity for rooks.
6. **Movement:** weighty, grounded — soldier march (pawn), horse leap (knight), heavy
   chariot roll (rook), advisor/standard-bearer glide (bishop), commanding presence
   (queen/king). Reference poses imply deliberate, readable animation, not arcade snap.
7. **Capture effects:** impact language (shield hit, dust burst, brief spark) consistent
   with the armored aesthetic; ALWAYS non-gory (project policy overrides any reference).
8. **Check/checkmate:** king-square pulse + camera emphasis + battlefield light focus.
9. **Sound:** optional, subtle (existing audio system), never intrusive.
10. **Fallback:** stable 2D board for weak devices / reduced motion (already shipped).

### Source caveat

The provided boards appear to be third-party/AI-assisted concept renders. They define the
**direction and quality bar only**. Production assets must be licensed or commissioned
rigged glTF/GLB models (manifest policy in `assets/3d/README.md`); the reference images are
not stored in the repo until the user confirms they may be.

## Open questions for the user (before the asset brief)

- Confirm the fidelity tier: stylized-realistic AAA-like (as analyzed) vs full cinematic?
- Camera default: tilted strategy view vs closer cinematic angle during normal play?
- May the reference images be committed under `design-references/`?
- Asset path preference: commission, licensed marketplace (with explicit approval), or
  in-house authored?
