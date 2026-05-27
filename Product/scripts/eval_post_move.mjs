import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { Chess } from 'chess.js';

const STOCKFISH = process.env.STOCKFISH_PATH || 'tools/stockfish/stockfish/stockfish-windows-x86-64-avx2.exe';
if (!existsSync(STOCKFISH)) { console.error('Stockfish not found at', STOCKFISH); process.exit(1); }

function spawnEngine() { const e = spawn(STOCKFISH, [], { stdio: ['pipe','pipe','pipe'] }); e.stdout.setEncoding('utf8'); return e; }
function comm(engine) {
  let buf=''; let pending=null;
  engine.stdout.on('data', (c)=>{ buf+=c; const lines=buf.split(/\r?\n/); buf=lines.pop()||''; for(const line of lines){ if(!pending) continue; pending.lines.push(line.trim()); if(line.includes(pending.token)){ const cur=pending; pending=null; cur.resolve(cur.lines); } } });
  return { send(cmd){ engine.stdin.write(cmd+'\n'); }, readUntil(token){ return new Promise((resolve)=>{ pending={token,resolve,lines:[]}; }); } };
}

async function analyze(fen, depth=14, multipv=3){ const e=spawnEngine(); const c=comm(e); c.send('uci'); await c.readUntil('uciok'); c.send('ucinewgame'); c.send(`setoption name MultiPV value ${multipv}`); c.send(`position fen ${fen}`); c.send(`go depth ${depth}`); const out = await c.readUntil('bestmove'); e.stdin.write('quit\n'); const res=[]; for(const line of out){ if(!line.includes(' multipv ')||!line.includes(' pv ')) continue; const mp=Number(line.match(/multipv (\d+)/)?.[1]); const cp=line.match(/score cp (-?\d+)/); const mate=line.match(/score mate (-?\d+)/); const score=cp?Number(cp[1]):mate?(mate[1]>0?100000-Math.abs(Number(mate[1])):-100000+Math.abs(Number(mate[1]))):null; const move=line.match(/ pv ([a-h][1-8][a-h][1-8][qrbn]?)/)?.[1]??null; if(mp&&score!==null&&move) res.push({mp,move,score,raw:line}); }
  return res.sort((a,b)=>a.mp-b.mp).map(r=>({move:r.move,score:r.score,raw:r.raw})); }

function fenAfter(fen, move){ const g=new Chess(fen); const r=g.move({ from: move.slice(0,2), to: move.slice(2,4), promotion: move[4] }); if(!r) throw new Error('invalid move'); return g.fen(); }

(async()=>{
  const [fen, move] = process.argv.slice(2);
  if(!fen||!move){ console.error('Usage: node scripts/eval_post_move.mjs <fen> <move>'); process.exit(1); }
  const after = fenAfter(fen, move);
  console.log('After move FEN:', after);
  const lines = await analyze(after, 14, 3);
  console.log('Top lines after move:', JSON.stringify(lines.slice(0,3), null, 2));
})();
