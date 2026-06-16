# 3D Kurukshetra Reference Expectation

Milestone: M-REFERENCE-LOCKED-APPLE-MONO-UI-AND-BOARD-HITTEST-FIX-1
Updated by: M-3D-REFERENCE-ANALYSIS-AND-ASSET-BRIEF-1
Status: User references reviewed. Licensed CharMorph human-rig replacement passes are implemented for the standalone humanoid slots plus mounted riders and chariot drivers. Final full-battlefield realism is still not approved because animal/vehicle shells, chariots, weapon constraints, and cinematic combat animation remain below the reference target.

The user will provide references. Initial in-chat references were provided on 2026-06-11 and are analyzed here as direction only. The images are not stored in the repo unless the user confirms they may be stored.

Do not claim final GLB/model/texture/rig/animation completion for soldiers, horses, elephants, chariots, weapons, rocks, trees, terrain, dust, or effects until production assets are approved, licensed, implemented, and visually verified. The current implementation may use declared compatible assets: humanoids and mounted riders are CharMorph/MB-Lab AGPL3-derived real-human rigs with project-authored equipment, while animal and vehicle shells remain procedural placeholders.

## Reference Analysis Template

1. Overall visual fidelity:
   - realistic
   - stylized realistic
   - cinematic
   - mobile-game quality
   - AAA-like target

2. Camera:
   - isometric
   - tilted board
   - orbit
   - fixed strategy-camera

3. Terrain:
   - sand
   - dust
   - rocks
   - trees
   - battlefield boundary

4. Pieces:
   - soldiers
   - horses
   - elephants
   - chariots
   - commanders
   - weapon-bearing units

5. Weapons:
   - bow
   - arrow
   - spear
   - sword
   - gada/mace
   - shield
   - chariot wheels

6. Movement:
   - pawn soldier march
   - knight horse leap
   - rook chariot heavy movement
   - bishop advisor/staff diagonal movement
   - queen commander move
   - king commander move

7. Capture effects:
   - dust burst
   - shield impact
   - spark flash
   - fade/dissolve
   - no blood
   - no gore

8. Check/checkmate:
   - king pulse
   - camera emphasis
   - battlefield light focus

9. Sound:
   - optional
   - subtle
   - not annoying

10. Fallback:
   - 2D board for slow devices
   - reduced motion

## Initial In-Chat Reference Direction

- Fidelity: stylized realistic and AAA-like, not low-poly. Materials should read as leather, bronze/metal, fabric, wood, animal tack, dust, and weathered battlefield surfaces.
- Camera: unit sheets show ground-level three-quarter and profile presentation. Gameplay should translate that into a readable tilted strategy camera, with closer cinematic emphasis reserved for presentation/capture moments.
- Terrain: dusty sand battlefield, distant fort/camp identity, rocks, sparse trees, haze, and clear board boundaries.
- Soldiers: muscular archer/warrior silhouettes, dhoti-style cloth, leather armor, headbands/turbans, quivers, and faction-readable cloth accents.
- Mounts: horse, camel, and elephant units with armor, caparisons, tack, howdahs, and readable silhouettes.
- Chariots: minister/king chariots should be ornate, open-top, wheel-forward, and heavier than human units.
- Weapons: recurve bows and quivers are a strong signature; also use spear, sword, mace/gada, shield, and chariot wheels.
- Movement: grounded, weighty, and readable. No arcade snapping. Pawn march, knight horse leap, rook chariot roll, bishop advisor/staff diagonal, queen/king commander movement.
- Capture: non-gory dust, shield, spark, and dissolve/retreat language only.
- Color: warm battlefield colors belong inside the battlefield/board, not the global UI shell. The shell remains Apple mono.

## Licensing Caveat

The references define direction and quality bar only. Production assets must be licensed, commissioned, or authored with clear usage rights. No copyrighted or unlicensed models, textures, rigs, or animations may ship.

## 2026-06-16 Implementation Update

- The old standalone procedural mannequin humans were rejected as not realistic.
- Six standalone humanoid GLBs were replaced with CharMorph/MB-Lab `mb_male`
  real-human meshes using 159-joint skinned rigs.
- Horse archer, chariot, and elephant commander GLBs now include CharMorph
  159-joint skinned riders/drivers with `rider_idle`, `rider_move`,
  `rider_attack`, and `rider_hit` clips.
- The replacement improves body proportions, body topology, texture basis, and
  limb animation potential for pawn/bishop/king human pieces and mounted riders.
- The horse, elephant, chariot, animal tack, vehicle shell, and vehicle motion
  references are not satisfied yet.
- Final 3D still requires approved realistic animal/vehicle assets and authored
  combat animation.
