import { existsSync } from 'node:fs';
import { createTimedUciEngine, stockfishPathFromEnv } from './lib/uci-engine.mjs';

const STOCKFISH = stockfishPathFromEnv();
if (!existsSync(STOCKFISH)) { console.error('Stockfish not found at', STOCKFISH); process.exit(2); }

async function bestmoveForFen(skill, fen, depth=6) {
  const c = createTimedUciEngine(STOCKFISH, { label: 'smoke-skill-check', timeoutMs: 60_000 });
  c.send('uci'); await c.readUntil('uciok');
  c.send('ucinewgame');
  c.send(`setoption name Skill Level value ${skill}`);
  c.send(`position fen ${fen}`);
  c.send(`go depth ${depth}`);
  const out = await c.readUntil('bestmove');
  c.quit();
  for (const line of out.reverse()) {
    if (line.startsWith('bestmove')) return line.split(' ')[1];
  }
  return null;
}

const sampleFens = [
  // reuse a representative set from calibration positions
  '2r5/pR5p/5p1k/4p3/4R3/B4nPP/PP3P2/1K6 b - - 0 27',
  'r2qkbnr/ppp2ppp/2np4/4p3/2B1P1b1/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 2 5',
  '1nb3n1/rpqkp2r/7p/3pb1pP/pP2Np2/3PPPP1/P1P1B1R1/R1KQ2N1 w - - 1 21',
  'r1bq2n1/1ppk3r/2n2p1b/p2P4/PPPp1N2/N3B1P1/7P/2KR1B1R w - - 2 17',
  'rnb1k1nr/pp6/2p4p/3p1P2/3p1p1q/BP3B2/2PNP1KP/R2Q2NR b kq - 0 14'
];

(async()=>{
  const results = [];
  for (const fen of sampleFens) {
    const m0 = await bestmoveForFen(0, fen, 6);
    const m20 = await bestmoveForFen(20, fen, 6);
    console.log(`[smoke] fen ${fen} -> skill0:${m0} skill20:${m20}`);
    results.push({ fen, m0, m20 });
  }
  const diffs = results.filter(r=>r.m0!==r.m20).length;
  console.log(`[smoke] different bestmoves on ${diffs}/${results.length} positions`);
  if (diffs >= 3) {
    console.log('[smoke] PASS');
    process.exit(0);
  }
  console.error('[smoke] FAIL: Skill Level appears ignored (identical bestmoves)');
  process.exit(3);
})();
