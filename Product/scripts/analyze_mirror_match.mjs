// scripts/analyze_mirror_match.mjs
//
// M3 Part 3 — full-strength re-analysis of a stored Mirror match.
//
// For each Mirror move trace in metadata.mirror_moves, re-evaluates the
// fenBefore at fixed depth with UCI_LimitStrength OFF (full strength)
// using the native Stockfish CLI. Reports the per-move cp gap between
// full-strength engine top and what the Mirror actually played.
//
// This answers the question the in-browser trace cannot: "is the Mirror
// making human-like mistakes, or is it still playing near-top engine
// moves most of the time?" The wider the average gap, the more the
// Mirror is being pulled down toward human-like play (which is the
// product premise). A near-zero gap across moves means the reranker is
// not actually diverging from full-strength play, regardless of what
// the in-match trace shows against the weakened multipv-1.
//
// Usage:
//   node scripts/analyze_mirror_match.mjs <path-to-match.json>
//
// Optional env vars:
//   STOCKFISH_PATH   defaults to tools/stockfish/stockfish/stockfish-windows-x86-64-avx2.exe
//   ANALYSIS_DEPTH   defaults to 14
//
// Export a mirror_match from your browser DevTools console while the
// app is open on any route:
//
//   indexedDB.open('mirror-pwa').onsuccess = (e) => {
//     const db = e.target.result;
//     const tx = db.transaction('mirror_matches').objectStore('mirror_matches');
//     tx.getAll().onsuccess = (r) => {
//       const latest = r.target.result
//         .sort((a, b) => a.started_at.localeCompare(b.started_at))
//         .pop();
//       copy(JSON.stringify(latest, null, 2));
//       console.log('Copied match', latest?.id, 'to clipboard.');
//     };
//   };
//
// Paste into a file, then run this script against that file.

import { existsSync, readFileSync } from 'node:fs';
import { createTimedUciEngine, stockfishPathFromEnv } from './lib/uci-engine.mjs';

const STOCKFISH = stockfishPathFromEnv();
const ANALYSIS_DEPTH = Number(process.env.ANALYSIS_DEPTH ?? 14);

if (!existsSync(STOCKFISH)) {
  console.error(`[analyze_mirror_match] Stockfish binary not found at ${STOCKFISH}`);
  console.error('Set STOCKFISH_PATH or place the binary at the default location.');
  process.exit(1);
}

const matchPath = process.argv[2];
if (!matchPath) {
  console.error('Usage: node scripts/analyze_mirror_match.mjs <path-to-match.json>');
  console.error('See the file header for the browser-side export snippet.');
  process.exit(1);
}

if (!existsSync(matchPath)) {
  console.error(`[analyze_mirror_match] Match file not found: ${matchPath}`);
  process.exit(1);
}

const match = JSON.parse(readFileSync(matchPath, 'utf8'));
const traces = Array.isArray(match.metadata?.mirror_moves)
  ? match.metadata.mirror_moves
  : [];

if (traces.length === 0) {
  console.error('[analyze_mirror_match] No mirror_moves traces in this match record.');
  console.error('The match must have been played and saved after the M2 trace-logging landed.');
  process.exit(1);
}

console.log(`Match:           ${match.id}`);
console.log(`Result:          ${match.result ?? '?'}`);
console.log(`Mirror base:     ${match.metadata?.mirror_base ?? '?'}`);
console.log(`Traces:          ${traces.length}`);
console.log(`Analysis depth:  ${ANALYSIS_DEPTH}  (UCI_LimitStrength = false)`);
console.log();

function parseScore(line) {
  const mate = line.match(/score mate (-?\d+)/);
  if (mate) {
    const n = Number(mate[1]);
    return n > 0 ? 10_000 - Math.abs(n) : -10_000 + Math.abs(n);
  }
  const cp = line.match(/score cp (-?\d+)/);
  return cp ? Number(cp[1]) : null;
}

function lastInfoScore(lines) {
  let last = null;
  for (const line of lines) {
    if (!line.startsWith('info') || !line.includes(' score ')) continue;
    const score = parseScore(line);
    if (score !== null) last = score;
  }
  return last;
}

const io = createTimedUciEngine(STOCKFISH, { label: 'analyze_mirror_match', timeoutMs: 60_000 });
io.send('uci');
await io.readUntil('uciok');
io.send('setoption name UCI_LimitStrength value false');
io.send('setoption name MultiPV value 1');
io.send('isready');
await io.readUntil('readyok');

async function analyze(fen, depth, searchmoves) {
  io.send('ucinewgame');
  io.send(`position fen ${fen}`);
  const cmd = searchmoves
    ? `go depth ${depth} searchmoves ${searchmoves}`
    : `go depth ${depth}`;
  io.send(cmd);
  const lines = await io.readUntil('bestmove');
  const bestmoveLine = lines.find((l) => l.startsWith('bestmove'));
  const bestmove = bestmoveLine?.split(/\s+/)?.[1] ?? null;
  return { score: lastInfoScore(lines), bestmove };
}

const rows = [];

for (let i = 0; i < traces.length; i += 1) {
  const trace = traces[i];
  const fen = trace.fenBefore;
  const played = trace.move;

  if (!fen || !played) {
    process.stdout.write(`  move ${i + 1}/${traces.length}: SKIPPED (missing fen or move)\n`);
    continue;
  }

  const top = await analyze(fen, ANALYSIS_DEPTH, null);
  const playedEval = await analyze(fen, ANALYSIS_DEPTH, played);
  const topScore = top.score ?? 0;
  const playedScore = playedEval.score ?? 0;
  const gap = topScore - playedScore;

  rows.push({
    moveNumber: trace.moveNumber ?? i + 1,
    san: trace.san ?? played,
    played,
    topUci: top.bestmove,
    topCp: topScore,
    playedCp: playedScore,
    signedDeltaCp: gap,
    absoluteGapCp: Math.abs(gap),
    isOutlier: Math.abs(gap) > 1000,
    overrodeWeakMultiPv1: Boolean(trace.overrodeStockfish),
    styleDimension: trace.styleDimension ?? null,
  });

  process.stdout.write(
    `  move ${i + 1}/${traces.length}: ${trace.san ?? played}  gap=${gap}cp\n`
  );
}

io.quit();

const signedDeltas = rows.map((r) => r.signedDeltaCp).filter(Number.isFinite);
const absoluteGaps = rows.map((r) => r.absoluteGapCp).filter(Number.isFinite);

const totalSigned = signedDeltas.reduce((a, b) => a + b, 0);
const totalAbsolute = absoluteGaps.reduce((a, b) => a + b, 0);

const avgSigned = signedDeltas.length > 0 ? Math.round(totalSigned / signedDeltas.length) : 0;
const avgAbsolute = absoluteGaps.length > 0 ? Math.round(totalAbsolute / absoluteGaps.length) : 0;

const sortedAbsolute = [...absoluteGaps].sort((a, b) => a - b);
const medianAbsolute = sortedAbsolute.length > 0 ? sortedAbsolute[Math.floor(sortedAbsolute.length / 2)] : 0;

const outliers = rows.filter((r) => r.isOutlier).length;
const overrides = rows.filter((r) => r.overrodeWeakMultiPv1).length;

console.log();
console.log('=== Full-strength re-analysis ===');
console.log(`analyzed_move_count:         ${rows.length}`);
console.log(`signed_cp_delta_avg:         ${avgSigned}  (Negative means played move evaluated better than unconstrained search)`);
console.log(`absolute_cp_gap_avg:         ${avgAbsolute}  (Magnitude of deviation from top engine move)`);
console.log(`median_absolute_cp_gap:      ${medianAbsolute}`);
console.log(`outlier_count (>1000cp):     ${outliers}`);
console.log(`Reranker override of weak-multipv-1: ${overrides} / ${rows.length}`);
console.log();
console.log('Per-move detail (positive gap = Mirror played worse than full-strength engine):');
console.table(
  rows.map((r) => ({
    moveNo: r.moveNumber,
    san: r.san,
    topUci: r.topUci,
    topCp: r.topCp,
    playedCp: r.playedCp,
    signedDelta: r.signedDeltaCp,
    absGap: r.absoluteGapCp,
    reranker: r.overrodeWeakMultiPv1 ? r.styleDimension ?? 'override' : '-',
  }))
);

console.log();
console.log('Interpretation guide (avg cp gap vs full-strength):');
console.log('  ~  0-30 cp : Mirror is playing near-perfect — reranker not creating human-like drop');
console.log('  ~ 30-80 cp : adept / master band territory — within engine noise');
console.log('  ~ 80-200 cp: initiate territory — meaningful human-like deviation');
console.log('  ~ 200+ cp  : apprentice territory — visibly weaker than full-strength engine');
console.log();
console.log('Compare avg gap to the player band that produced the match.');
