/**
 * Kurukshetra Battlefield asset registry.
 *
 * Every visual asset used by the 3D mode must be declared here and in
 * Product/assets/3d/asset-manifest.json before it ships.
 */

export type BattlefieldAsset = {
  name: string;
  kind: 'piece' | 'prop' | 'terrain' | 'effect';
  source: 'generated-image' | 'procedural' | 'licensed-derived';
  license:
    | 'project-generated for MIRROR'
    | 'project (AGPL-3.0-or-later, generated in code)'
    | 'AGPL3-derived CharMorph/MB-Lab humanoid rigs plus project-authored mounts/equipment';
  aiGenerated: boolean;
  notes: string;
};

export const BATTLEFIELD_ASSETS: BattlefieldAsset[] = [
  { name: 'archived foot-archer pawn reference PNG', kind: 'piece', source: 'generated-image', license: 'project-generated for MIRROR', aiGenerated: true, notes: 'transparent PNG in public/assets/3d/kurukshetra-realism-v1/pawn-foot-archer.png; retained as visual reference, not used as the playable unit mesh' },
  { name: 'archived horse-archer knight reference PNG', kind: 'piece', source: 'generated-image', license: 'project-generated for MIRROR', aiGenerated: true, notes: 'transparent PNG in public/assets/3d/kurukshetra-realism-v1/knight-horse-archer.png; retained as visual reference, not used as the playable unit mesh' },
  { name: 'archived advisor-standard bishop reference PNG', kind: 'piece', source: 'generated-image', license: 'project-generated for MIRROR', aiGenerated: true, notes: 'transparent PNG in public/assets/3d/kurukshetra-realism-v1/bishop-advisor-standard.png; retained as visual reference, not used as the playable unit mesh' },
  { name: 'archived war-chariot rook reference PNG', kind: 'piece', source: 'generated-image', license: 'project-generated for MIRROR', aiGenerated: true, notes: 'transparent PNG in public/assets/3d/kurukshetra-realism-v1/rook-war-chariot.png; retained as visual reference, not used as the playable unit mesh' },
  { name: 'archived war-elephant queen reference PNG', kind: 'piece', source: 'generated-image', license: 'project-generated for MIRROR', aiGenerated: true, notes: 'transparent PNG in public/assets/3d/kurukshetra-realism-v1/queen-war-elephant.png; retained as visual reference, not used as the playable unit mesh' },
  { name: 'archived royal-commander king reference PNG', kind: 'piece', source: 'generated-image', license: 'project-generated for MIRROR', aiGenerated: true, notes: 'transparent PNG in public/assets/3d/kurukshetra-realism-v1/king-royal-commander.png; retained as visual reference, not used as the playable unit mesh' },
  { name: 'realistic Kurukshetra board texture', kind: 'terrain', source: 'generated-image', license: 'project-generated for MIRROR', aiGenerated: true, notes: 'top-down board PNG in public/assets/3d/kurukshetra-realism-v1/realistic-board-texture.png' },
  { name: 'playable volumetric mesh chess army', kind: 'piece', source: 'procedural', license: 'project (AGPL-3.0-or-later, generated in code)', aiGenerated: false, notes: 'soldiers, horse archers, advisor-standard bearers, chariots, war elephants, royal commanders, bows, shields, swords, wheels, tusks, howdahs, and contact shadows in Product/src/three/BattlefieldPiece.tsx' },
  { name: 'production GLB army pack with CharMorph human rigs', kind: 'piece', source: 'licensed-derived', license: 'AGPL3-derived CharMorph/MB-Lab humanoid rigs plus project-authored mounts/equipment', aiGenerated: false, notes: '12 GLB files in public/assets/3d/kurukshetra-production-v1. Six standalone humanoids are 159-joint CharMorph/MB-Lab mb_male-derived skinned bodies with fitted lower-body cloth and hair generated with Product/scripts/generate-kurukshetra-charmorph-humanoid-glbs.py. Mounted files are generated with Product/scripts/generate-kurukshetra-charmorph-mounted-glbs.py and include CharMorph skinned riders/drivers on project-authored procedural horse, elephant, chariot, tack, wheel, and howdah shells. Loose weapon overlays are withheld until constrained hand-held weapon assets exist.' },
  { name: 'battlefield board and ground', kind: 'terrain', source: 'procedural', license: 'project (AGPL-3.0-or-later, generated in code)', aiGenerated: false, notes: 'sand/clay board, bronze in-scene rail, sand terrain disc' },
  { name: 'distant fort and camp', kind: 'prop', source: 'procedural', license: 'project (AGPL-3.0-or-later, generated in code)', aiGenerated: false, notes: 'wall blocks, towers, tents, fogged boundary silhouettes' },
  { name: 'rocks and sparse dry trees', kind: 'prop', source: 'procedural', license: 'project (AGPL-3.0-or-later, generated in code)', aiGenerated: false, notes: 'deterministic off-board scenery' },
  { name: 'war banners and battle-line soldiers', kind: 'prop', source: 'procedural', license: 'project (AGPL-3.0-or-later, generated in code)', aiGenerated: false, notes: 'Pandava/Kaurava side banners and small spear-bearing off-board figures' },
  { name: 'off-board horse, elephant, and chariot entourage', kind: 'prop', source: 'procedural', license: 'project (AGPL-3.0-or-later, generated in code)', aiGenerated: false, notes: 'disabled from the live scene after close-camera review exposed toy-like and floating artifacts; keep only as archived prototype geometry until replaced by approved realistic assets' },
  { name: 'dust and non-gory capture impact', kind: 'effect', source: 'procedural', license: 'project (AGPL-3.0-or-later, generated in code)', aiGenerated: false, notes: 'ambient Points dust, impact ring, dust motes, spark flash, dissolve' },
];
