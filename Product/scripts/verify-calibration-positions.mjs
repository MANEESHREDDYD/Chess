import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { Chess } from 'chess.js';

const POSITIONS_PATH = 'src/data/calibrationPositions.json';
const DEFAULT_STOCKFISH_PATH = join(
  'tools',
  'stockfish',
  'stockfish',
  'stockfish-windows-x86-64-avx2.exe'
);

const positions = JSON.parse(readFileSync(POSITIONS_PATH, 'utf8'));
const stockfishPath = process.env.STOCKFISH_PATH || DEFAULT_STOCKFISH_PATH;

if (!existsSync(stockfishPath)) {
  console.error(
    `[verify-calibration-positions] Stockfish CLI not found at ${stockfishPath}. ` +
      'Install Stockfish for Windows or set STOCKFISH_PATH.'
  );
  process.exit(1);
}

const engine = spawn(stockfishPath, [], { stdio: ['pipe', 'pipe', 'pipe'] });
engine.stdout.setEncoding('utf8');

let buffer = '';
let pending = null;

engine.stdout.on('data', (chunk) => {
  buffer += chunk;
  const lines = buffer.split(/\r?\n/);
  buffer = lines.pop() ?? '';

  for (const line of lines) {
    if (!pending) continue;
    pending.lines.push(line.trim());
    if (line.includes(pending.token)) {
      const current = pending;
      pending = null;
      current.resolve(current.lines);
    }
  }
});

function send(command) {
  engine.stdin.write(`${command}\n`);
}

function readUntil(token) {
  return new Promise((resolve) => {
    pending = { token, resolve, lines: [] };
  });
}

function scoreValue(line) {
  const cp = line.match(/score cp (-?\d+)/);
  if (cp) return { kind: 'cp', cp: Number(cp[1]) };

  const mate = line.match(/score mate (-?\d+)/);
  if (mate) {
    const mateDistance = Number(mate[1]);
    return { kind: 'mate', mate: mateDistance };
  }

  return { kind: 'none' };
}

function pvMove(line) {
  return line.match(/ pv ([a-h][1-8][a-h][1-8][qrbn]?)/)?.[1] ?? null;
}

async function analyze(fen, depth, multipv = 1) {
  send('ucinewgame');
  send(`setoption name MultiPV value ${multipv}`);
  send(`position fen ${fen}`);
  send(`go depth ${depth}`);
  const output = await readUntil('bestmove');
  const latest = new Map();

  for (const line of output) {
    if (!line.includes(' multipv ') || !line.includes(' pv ')) continue;
    const multipvIndex = Number(line.match(/multipv (\d+)/)?.[1]);
    const scoreObj = scoreValue(line);
    const move = pvMove(line);
    if (multipvIndex && scoreObj.kind !== 'none' && move) {
      // normalize numeric for sorting if needed
      const numeric = scoreObj.kind === 'cp' ? scoreObj.cp : scoreObj.mate > 0 ? 100000 - Math.abs(scoreObj.mate) : -100000 + Math.abs(scoreObj.mate);
      latest.set(multipvIndex, { move, score: scoreObj, numeric });
    }
  }

  return [...latest.entries()].sort((a, b) => a[0] - b[0]).map(([, value]) => value);
}

function fenAfterMove(fen, move) {
  const game = new Chess(fen);
  const result = game.move({
    from: move.slice(0, 2),
    to: move.slice(2, 4),
    promotion: move[4],
  });
  if (!result) throw new Error(`Invalid move ${move} from ${fen}`);
  return game.fen();
}

async function evalMoveFromOriginalSide(fen, move, depth) {
  const afterMove = fenAfterMove(fen, move);
  const result = await analyze(afterMove, depth, 1);
  if (result.length === 0) throw new Error(`No Stockfish eval for ${move} from ${fen}`);
  const s = result[0].score;
  // convert score object to numeric cp-like value for comparison
  if (s.kind === 'cp') return -s.cp;
  if (s.kind === 'mate') return s.mate > 0 ? -(100000 - Math.abs(s.mate)) : -(-100000 + Math.abs(s.mate));
  return 0;
}

function tacticalPositions() {
  return positions.tasks
    .filter((task) => task.kind === 'tactical_sight' || task.kind === 'tactical_race')
    .flatMap((task) => task.positions);
}

function exchangePositions() {
  return positions.tasks.find((task) => task.kind === 'exchange_willingness')?.positions ?? [];
}

async function verifyTactics() {
  const depth = positions.stockfish_verification.depth;
  const minGap = positions.stockfish_verification.tactical_min_cp_gap;

  for (const position of tacticalPositions()) {
    const lines = await analyze(position.fen, depth, 3);
    if (lines.length < 2) throw new Error(`${position.id}: expected at least 2 MultiPV lines`);
    const best = lines[0];
    const second = lines[1];
    if (best.move !== position.expected_best_move) {
      throw new Error(`${position.id}: expected ${position.expected_best_move}, got ${best.move}`);
    }

    // both CP scores -> enforce cp gap
    if (best.score.kind === 'cp' && second.score.kind === 'cp') {
      const gap = best.score.cp - second.score.cp;
      if (gap < minGap) throw new Error(`${position.id}: expected cp gap >= ${minGap}, got ${gap}`);
      console.log(`[tactical] ${position.id}: ${best.move}, cp gap ${gap}`);
    } else if (best.score.kind === 'mate' && second.score.kind === 'cp') {
      console.log(`[tactical] ${position.id}: ${best.move}, mate vs cp (best forces mate, second cp ${second.score.cp})`);
    } else if (best.score.kind === 'cp' && second.score.kind === 'mate') {
      // unlikely: second is mate but best is cp — treat as pass but log
      console.log(`[tactical] ${position.id}: ${best.move}, cp vs mate (best cp ${best.score.cp}, second mate ${second.score.mate})`);
    } else if (best.score.kind === 'mate' && second.score.kind === 'mate') {
      console.log(`[tactical] ${position.id}: ${best.move}, mate vs mate (best mate ${best.score.mate}, second mate ${second.score.mate})`);
    } else {
      console.log(`[tactical] ${position.id}: ${best.move}, unexpected score types`);
    }
  }
}

async function verifyExchanges() {
  const depth = positions.stockfish_verification.depth;
  const maxDiff = positions.stockfish_verification.exchange_max_cp_difference;

  for (const position of exchangePositions()) {
    const acceptCp = await evalMoveFromOriginalSide(position.fen, position.accept, depth);
    const declineCp = await evalMoveFromOriginalSide(position.fen, position.decline, depth);
    const diff = Math.abs(acceptCp - declineCp);

    if (diff > maxDiff) {
      throw new Error(`${position.id}: expected accept/decline diff <= ${maxDiff}, got ${diff}`);
    }

    console.log(`[exchange] ${position.id}: accept ${acceptCp}, decline ${declineCp}, diff ${diff}`);
  }
}

try {
  send('uci');
  await readUntil('uciok');
  await verifyTactics();
  await verifyExchanges();
  console.log('[verify-calibration-positions] PASS');
  send('quit');
} catch (error) {
  send('quit');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
