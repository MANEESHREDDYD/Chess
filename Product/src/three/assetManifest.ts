/**
 * Kurukshetra Battlefield — asset registry.
 *
 * EVERY visual asset used by the 3D mode must be declared here AND in
 * Product/assets/3d/asset-manifest.json before it ships. The current set is
 * 100% procedural (generated from three.js primitives in code), so the mode
 * adds zero binary assets, zero external requests, and zero licensing risk.
 *
 * Honesty rule: while this manifest contains only `procedural` entries, the
 * battlefield is a documented low-poly placeholder — never describe it as a
 * realistic battlefield in UI copy or docs.
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
  { name: 'foot-soldier (pawn)', kind: 'piece', source: 'procedural', license: 'project (AGPL-3.0-or-later, generated in code)', aiGenerated: false, notes: 'capsule body, head, round shield' },
  { name: 'horse-cavalry (knight)', kind: 'piece', source: 'procedural', license: 'project (AGPL-3.0-or-later, generated in code)', aiGenerated: false, notes: 'arched neck + muzzle silhouette' },
  { name: 'advisor-standard-bearer (bishop)', kind: 'piece', source: 'procedural', license: 'project (AGPL-3.0-or-later, generated in code)', aiGenerated: false, notes: 'robed cone + staff + pennant' },
  { name: 'war-chariot (rook)', kind: 'piece', source: 'procedural', license: 'project (AGPL-3.0-or-later, generated in code)', aiGenerated: false, notes: 'hull, four wheels, tower' },
  { name: 'commander (queen)', kind: 'piece', source: 'procedural', license: 'project (AGPL-3.0-or-later, generated in code)', aiGenerated: false, notes: 'tall robe, mantle, crown ring' },
  { name: 'royal-commander (king)', kind: 'piece', source: 'procedural', license: 'project (AGPL-3.0-or-later, generated in code)', aiGenerated: false, notes: 'tallest figure, crown, standard flag' },
  { name: 'battlefield-ground', kind: 'terrain', source: 'procedural', license: 'project (AGPL-3.0-or-later, generated in code)', aiGenerated: false, notes: 'sand plane + clay board squares' },
  { name: 'rocks', kind: 'prop', source: 'procedural', license: 'project (AGPL-3.0-or-later, generated in code)', aiGenerated: false, notes: 'low-poly icosahedrons near board corners' },
  { name: 'trees', kind: 'prop', source: 'procedural', license: 'project (AGPL-3.0-or-later, generated in code)', aiGenerated: false, notes: 'sparse cone canopies on trunks' },
  { name: 'war-banners', kind: 'prop', source: 'procedural', license: 'project (AGPL-3.0-or-later, generated in code)', aiGenerated: false, notes: 'poles + Pandava blue / Kaurava maroon cloth' },
  { name: 'camp-silhouettes', kind: 'prop', source: 'procedural', license: 'project (AGPL-3.0-or-later, generated in code)', aiGenerated: false, notes: 'distant tents in fog' },
  { name: 'war-elephant + horse props', kind: 'prop', source: 'procedural', license: 'project (AGPL-3.0-or-later, generated in code)', aiGenerated: false, notes: 'edge props only, never on the board' },
  { name: 'dust-particles', kind: 'effect', source: 'procedural', license: 'project (AGPL-3.0-or-later, generated in code)', aiGenerated: false, notes: 'ambient drift + capture burst' },
];
