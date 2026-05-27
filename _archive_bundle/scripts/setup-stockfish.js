// scripts/setup-stockfish.js
// Postinstall sanity check: confirm stockfish files are reachable.
// The vite-plugin-static-copy handles serving them in dev/build.
// This script just verifies the node_modules source exists so we fail loudly
// at install time rather than at "Why is my chess board not moving?" time.

import { existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sfPath = join(__dirname, '..', 'node_modules', 'stockfish', 'src');

if (!existsSync(sfPath)) {
  console.warn('\n[setup-stockfish] WARNING: stockfish/src not found in node_modules.');
  console.warn('[setup-stockfish] The chess engine will not load.');
  console.warn('[setup-stockfish] Try: npm install stockfish --save-dev\n');
  process.exit(0); // do not fail install — let dev figure it out
}

const files = readdirSync(sfPath).filter((f) => /stockfish.*\.(js|wasm)$/.test(f));

if (files.length === 0) {
  console.warn('[setup-stockfish] WARNING: no stockfish.js or stockfish.wasm in src/');
  process.exit(0);
}

console.log(`[setup-stockfish] OK — found ${files.length} stockfish file(s): ${files.join(', ')}`);
