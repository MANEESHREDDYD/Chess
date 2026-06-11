/**
 * Kurukshetra Battlefield asset registry.
 *
 * Every visual asset used by the 3D mode must be declared here and in
 * Product/assets/3d/asset-manifest.json before it ships.
 */

export type BattlefieldAsset = {
  name: string;
  kind: 'piece' | 'prop' | 'terrain' | 'effect';
  source: 'generated-image' | 'procedural';
  license: 'project-generated for MIRROR' | 'project (AGPL-3.0-or-later, generated in code)';
  aiGenerated: boolean;
  notes: string;
};

export const BATTLEFIELD_ASSETS: BattlefieldAsset[] = [
  { name: 'realistic foot-archer pawn billboard', kind: 'piece', source: 'generated-image', license: 'project-generated for MIRROR', aiGenerated: true, notes: 'transparent PNG in public/assets/3d/kurukshetra-realism-v1/pawn-foot-archer.png' },
  { name: 'realistic horse-archer knight billboard', kind: 'piece', source: 'generated-image', license: 'project-generated for MIRROR', aiGenerated: true, notes: 'transparent PNG in public/assets/3d/kurukshetra-realism-v1/knight-horse-archer.png' },
  { name: 'realistic advisor-standard bishop billboard', kind: 'piece', source: 'generated-image', license: 'project-generated for MIRROR', aiGenerated: true, notes: 'transparent PNG in public/assets/3d/kurukshetra-realism-v1/bishop-advisor-standard.png' },
  { name: 'realistic war-chariot rook billboard', kind: 'piece', source: 'generated-image', license: 'project-generated for MIRROR', aiGenerated: true, notes: 'transparent PNG in public/assets/3d/kurukshetra-realism-v1/rook-war-chariot.png' },
  { name: 'realistic war-elephant queen billboard', kind: 'piece', source: 'generated-image', license: 'project-generated for MIRROR', aiGenerated: true, notes: 'transparent PNG in public/assets/3d/kurukshetra-realism-v1/queen-war-elephant.png' },
  { name: 'realistic royal-commander king billboard', kind: 'piece', source: 'generated-image', license: 'project-generated for MIRROR', aiGenerated: true, notes: 'transparent PNG in public/assets/3d/kurukshetra-realism-v1/king-royal-commander.png' },
  { name: 'realistic Kurukshetra board texture', kind: 'terrain', source: 'generated-image', license: 'project-generated for MIRROR', aiGenerated: true, notes: 'top-down board PNG in public/assets/3d/kurukshetra-realism-v1/realistic-board-texture.png' },
  { name: 'battlefield board and ground', kind: 'terrain', source: 'procedural', license: 'project (AGPL-3.0-or-later, generated in code)', aiGenerated: false, notes: 'sand/clay board, bronze in-scene rail, sand terrain disc' },
  { name: 'distant fort and camp', kind: 'prop', source: 'procedural', license: 'project (AGPL-3.0-or-later, generated in code)', aiGenerated: false, notes: 'wall blocks, towers, tents, fogged boundary silhouettes' },
  { name: 'rocks and sparse dry trees', kind: 'prop', source: 'procedural', license: 'project (AGPL-3.0-or-later, generated in code)', aiGenerated: false, notes: 'deterministic off-board scenery' },
  { name: 'war banners and battle-line soldiers', kind: 'prop', source: 'procedural', license: 'project (AGPL-3.0-or-later, generated in code)', aiGenerated: false, notes: 'Pandava/Kaurava side banners and small spear-bearing off-board figures' },
  { name: 'off-board horse, elephant, and chariot entourage', kind: 'prop', source: 'procedural', license: 'project (AGPL-3.0-or-later, generated in code)', aiGenerated: false, notes: 'atmosphere only, never on playable squares' },
  { name: 'dust and non-gory capture impact', kind: 'effect', source: 'procedural', license: 'project (AGPL-3.0-or-later, generated in code)', aiGenerated: false, notes: 'ambient Points dust, impact ring, dust motes, spark flash, dissolve' },
];
