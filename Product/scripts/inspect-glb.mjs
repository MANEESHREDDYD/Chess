// Minimal GLB inspector: prints animation names, skin/joint counts, mesh/node counts.
import { readFile } from 'node:fs/promises';
import path from 'node:path';

function parseGlb(buffer) {
  const magic = buffer.readUInt32LE(0);
  if (magic !== 0x46546c67) throw new Error('not a GLB');
  const jsonLength = buffer.readUInt32LE(12);
  const jsonType = buffer.readUInt32LE(16);
  if (jsonType !== 0x4e4f534a) throw new Error('first chunk not JSON');
  return JSON.parse(buffer.subarray(20, 20 + jsonLength).toString('utf8'));
}

const files = process.argv.slice(2);
for (const file of files) {
  const buf = await readFile(path.resolve(file));
  const g = parseGlb(buf);
  const anims = (g.animations ?? []).map((a) => a.name);
  const skins = g.skins ?? [];
  const joints = skins.reduce((n, s) => n + (s.joints?.length ?? 0), 0);
  const skinned = (g.nodes ?? []).filter((n) => n.skin !== undefined).length;
  console.log(
    `${path.basename(file)} | ${(buf.length / 1024).toFixed(0)}KB | anims=[${anims.join(',')}] | skins=${skins.length} joints=${joints} skinnedNodes=${skinned} | meshes=${(g.meshes ?? []).length} nodes=${(g.nodes ?? []).length}`
  );
}
