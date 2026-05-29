import { existsSync } from 'node:fs';
import { Chess } from 'chess.js';
import { createTimedUciEngine, stockfishPathFromEnv } from './lib/uci-engine.mjs';

const STOCKFISH = stockfishPathFromEnv();
if (!existsSync(STOCKFISH)) {
  console.error('Stockfish not found at', STOCKFISH);
  process.exit(1);
}

async function analyzeFen(engineComm, fen, depth = 14, multipv = 3) {
  engineComm.send('ucinewgame');
  engineComm.send(`setoption name MultiPV value ${multipv}`);
  engineComm.send(`position fen ${fen}`);
  engineComm.send(`go depth ${depth}`);
  const out = await engineComm.readUntil('bestmove');
  const lines = [];
  for (const line of out) {
    if (!line.includes(' multipv ') || !line.includes(' pv ')) continue;
    const mp = Number(line.match(/multipv (\d+)/)?.[1]);
    const cpMatch = line.match(/score cp (-?\d+)/);
    const mateMatch = line.match(/score mate (-?\d+)/);
    const score = cpMatch ? Number(cpMatch[1]) : mateMatch ? (mateMatch[1] > 0 ? 100000 - Math.abs(Number(mateMatch[1])) : -100000 + Math.abs(Number(mateMatch[1]))) : null;
    const move = line.match(/ pv ([a-h][1-8][a-h][1-8][qrbn]?)/)?.[1] ?? null;
    if (mp && score !== null && move) lines.push({ mp, move, score, raw: line });
  }
  return lines.sort((a,b)=>a.mp-b.mp).map(l=>({move:l.move,score:l.score,raw:l.raw}));
}

function isCaptureFen(fen, move) {
  const game = new Chess(fen);
  const result = game.move({ from: move.slice(0,2), to: move.slice(2,4), promotion: move[4] });
  if (!result) return false;
  return Boolean(result.captured);
}

async function findCandidates({trials=200, plyDepthMin=12, plyDepthMax=40} = {}) {
  const comm = createTimedUciEngine(STOCKFISH, { label: 'find_task5_candidates', timeoutMs: 60_000 });
  comm.send('uci');
  await comm.readUntil('uciok');

  const results = [];
  for (let t=0;t<trials && results.length<5;t++) {
    const game = new Chess();
    const plies = Math.floor(Math.random() * (plyDepthMax-plyDepthMin+1)) + plyDepthMin;
    for (let i=0;i<plies;i++) {
      const moves = game.moves({ verbose: true });
      if (moves.length===0) break;
      const m = moves[Math.floor(Math.random()*moves.length)];
      game.move(m.san);
    }
    const fen = game.fen();
    try {
      const lines = await analyzeFen(comm, fen, 14, 3);
      if (lines.length<2) continue;
      const best = lines[0];
      const second = lines[1];
      const gap = best.score - second.score;
      // prefer quiet best move (non-capture) and gap >= 150
      if (!isCaptureFen(fen, best.move) && gap >= 150) {
        results.push({ fen, best: best.move, best_score: best.score, second: second.move, second_score: second.score, gap, raw_best: best.raw, raw_second: second.raw });
        console.log('Candidate found', results.length, 'gap', gap, 'fen', fen);
      }
    } catch (e) {
      // ignore
    }
  }

  comm.quit();
  return results;
}

(async()=>{
  const candidates = await findCandidates({trials:400});
  console.log('TOTAL CANDIDATES', candidates.length);
  for (const c of candidates) console.log(JSON.stringify(c, null, 2));
})();
