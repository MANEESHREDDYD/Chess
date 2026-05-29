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
  console.error('\n[setup-stockfish] ERROR: stockfish/src not found in node_modules.');
  console.error('[setup-stockfish] The chess engine will not load.');
  console.error('[setup-stockfish] Try: npm install stockfish --save-dev\n');
  process.exit(1);
}

const files = readdirSync(sfPath).filter((f) => /stockfish.*\.(js|wasm)$/.test(f));
const requiredFiles = ['stockfish-nnue-16-single.js', 'stockfish-nnue-16-single.wasm'];
const missingRequired = requiredFiles.filter((file) => !files.includes(file));

if (missingRequired.length > 0) {
  console.error(
    `[setup-stockfish] ERROR: missing required Stockfish file(s): ${missingRequired.join(', ')}`
  );
  process.exit(1);
}

console.log(`[setup-stockfish] OK - found ${files.length} stockfish file(s): ${files.join(', ')}`);
