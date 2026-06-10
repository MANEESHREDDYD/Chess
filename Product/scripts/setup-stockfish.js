// scripts/setup-stockfish.js
// Postinstall sanity check: confirm Stockfish files are reachable and keep
// exact browser asset paths available under public/stockfish.

import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sfPath = join(__dirname, '..', 'node_modules', 'stockfish', 'src');
const publicStockfishPath = join(__dirname, '..', 'public', 'stockfish');

if (!existsSync(sfPath)) {
  console.error('\n[setup-stockfish] ERROR: stockfish/src not found in node_modules.');
  console.error('[setup-stockfish] The chess engine will not load.');
  console.error('[setup-stockfish] Try: npm install stockfish --save-dev\n');
  process.exit(1);
}

const files = readdirSync(sfPath).filter((f) => /stockfish.*\.(js|wasm)$/.test(f));
const requiredFiles = [
  'stockfish-nnue-16-single.js',
  'stockfish-nnue-16-single.wasm',
  'stockfish-nnue-16-no-simd.js',
  'stockfish-nnue-16-no-simd.wasm',
];
const missingRequired = requiredFiles.filter((file) => !files.includes(file));

if (missingRequired.length > 0) {
  console.error(
    `[setup-stockfish] ERROR: missing required Stockfish file(s): ${missingRequired.join(', ')}`
  );
  process.exit(1);
}

mkdirSync(publicStockfishPath, { recursive: true });
for (const file of requiredFiles) {
  copyFileSync(join(sfPath, file), join(publicStockfishPath, file));
}

console.log(
  `[setup-stockfish] OK - copied ${requiredFiles.length} browser asset(s) to public/stockfish. Found ${files.length} stockfish file(s): ${files.join(', ')}`
);
