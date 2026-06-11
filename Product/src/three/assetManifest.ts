/**
 * Kurukshetra Battlefield asset registry.
 *
 * Every visual asset used by the 3D mode must be declared here and in
 * Product/assets/3d/asset-manifest.json before it ships.
 *
 * Current state: 100% project-authored procedural geometry and materials.
 * No binary models, textures, rigs, animations, or external requests ship.
 */

export type BattlefieldAsset = {
  name: string;
  kind: 'piece' | 'prop' | 'terrain' | 'effect';
  source: 'procedural';
  license: 'project (AGPL-3.0-or-later, generated in code)';
  aiGenerated: false;
  notes: string;
};

export const BATTLEFIELD_ASSETS: BattlefieldAsset[] = [
  { name: 'foot-archer pawn', kind: 'piece', source: 'procedural', license: 'project (AGPL-3.0-or-later, generated in code)', aiGenerated: false, notes: 'human warrior, leather armor, dhoti cloth, bow, arrow, quiver, headband' },
  { name: 'horse-archer knight', kind: 'piece', source: 'procedural', license: 'project (AGPL-3.0-or-later, generated in code)', aiGenerated: false, notes: 'horse body, legs, head, saddle, rider, bow/quiver silhouette' },
  { name: 'advisor-standard-bearer bishop', kind: 'piece', source: 'procedural', license: 'project (AGPL-3.0-or-later, generated in code)', aiGenerated: false, notes: 'tall warrior with shield, spear, standard/banner' },
  { name: 'war-chariot rook', kind: 'piece', source: 'procedural', license: 'project (AGPL-3.0-or-later, generated in code)', aiGenerated: false, notes: 'chariot hull, side panels, wheels, rail, rider, spear' },
  { name: 'war-elephant commander queen', kind: 'piece', source: 'procedural', license: 'project (AGPL-3.0-or-later, generated in code)', aiGenerated: false, notes: 'elephant body/head/trunk/tusks, caparison, howdah, rider, mace' },
  { name: 'royal commander king', kind: 'piece', source: 'procedural', license: 'project (AGPL-3.0-or-later, generated in code)', aiGenerated: false, notes: 'crowned armored commander, shield, sword, royal standard' },
  { name: 'battlefield board and ground', kind: 'terrain', source: 'procedural', license: 'project (AGPL-3.0-or-later, generated in code)', aiGenerated: false, notes: 'sand/clay board, bronze in-scene rail, sand terrain disc' },
  { name: 'distant fort and camp', kind: 'prop', source: 'procedural', license: 'project (AGPL-3.0-or-later, generated in code)', aiGenerated: false, notes: 'wall blocks, towers, tents, fogged boundary silhouettes' },
  { name: 'rocks and sparse dry trees', kind: 'prop', source: 'procedural', license: 'project (AGPL-3.0-or-later, generated in code)', aiGenerated: false, notes: 'deterministic off-board scenery' },
  { name: 'war banners and battle-line soldiers', kind: 'prop', source: 'procedural', license: 'project (AGPL-3.0-or-later, generated in code)', aiGenerated: false, notes: 'Pandava/Kaurava side banners and small spear-bearing off-board figures' },
  { name: 'off-board horse, elephant, and chariot entourage', kind: 'prop', source: 'procedural', license: 'project (AGPL-3.0-or-later, generated in code)', aiGenerated: false, notes: 'atmosphere only, never on playable squares' },
  { name: 'dust and non-gory capture impact', kind: 'effect', source: 'procedural', license: 'project (AGPL-3.0-or-later, generated in code)', aiGenerated: false, notes: 'ambient Points dust, impact ring, dust motes, spark flash, dissolve' },
];
