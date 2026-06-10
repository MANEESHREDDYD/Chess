import puppeteer from 'puppeteer';
import { spawn } from 'child_process';
import { Chess } from 'chess.js';

const PORT = 5173;
const HOST = '127.0.0.1';
const URL = `http://${HOST}:${PORT}/play`;
const SERVER_TIMEOUT_MS = 30000;

async function run() {
  let server = null;
  let browser = null;

  try {
    if (await isServerReachable()) {
      console.log(`Using existing dev server at ${URL}`);
    } else {
      console.log('Starting dev server...');
      server = startDevServer();
      await waitForServerBoot(server);
    }

    console.log('Launching browser...');
    browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();

    page.on('console', (msg) => {
      console.log(`BROWSER: ${msg.text()}`);
    });

    page.on('pageerror', (err) => {
      console.error(`BROWSER ERROR: ${err.message}`);
    });

    await page.goto(URL, { waitUntil: 'networkidle0', timeout: 60000 });

    const boot = await page.evaluate(async () => {
      const engine = await import('/src/engine/stockfishBridge.ts');
      await engine.waitForEngine(10000);
      const move = await engine.getBestMove('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 10, 10000);
      const candidates = await engine.getCandidateMoves('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 3, 8, 10000);
      const evaluation = await engine.evaluatePosition('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 8);
      const diagnostics = engine.getStockfishDiagnostics();
      return { move, candidates, evaluation, diagnostics };
    });

    validateLegalMove(boot.move, 'Starting position best move');
    if (!Array.isArray(boot.candidates) || boot.candidates.length === 0) {
      throw new Error('Candidate search returned no moves.');
    }
    if (!boot.evaluation || (boot.evaluation.cp === null && boot.evaluation.mate === null)) {
      throw new Error('Evaluation search returned no score information.');
    }
    assertBootDiagnostics(boot.diagnostics, 'Initial dev-server boot');

    const blackFlow = await page.evaluate(async () => {
      const { useGameStore } = await import('/src/state/gameStore.ts');
      useGameStore.getState().startGame('black', 'Club');
      const deadline = Date.now() + 15000;

      while (Date.now() < deadline) {
        const state = useGameStore.getState();
        if (state.history.length === 1 && !state.engineThinking && !state.engineError) {
          return {
            history: state.history.slice(),
            status: state.status,
            playerColor: state.playerColor,
            enginePhase: state.enginePhase,
          };
        }

        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      const state = useGameStore.getState();
      throw new Error(`Black-side flow did not settle. status=${state.status} engineError=${state.engineError ?? 'none'}`);
    });

    if (blackFlow.playerColor !== 'black') {
      throw new Error('Black-side flow did not set the player color to black.');
    }
    validateLegalMove(blackFlow.history[0], 'Black-side first move');

    const repeated = await page.evaluate(async () => {
      const engine = await import('/src/engine/stockfishBridge.ts');
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const first = await engine.getBestMove(fen, 8, 10000);
      const second = await engine.getBestMove(fen, 8, 10000);
      return { first, second };
    });

    validateLegalMove(repeated.first, 'First repeated search move');
    validateLegalMove(repeated.second, 'Second repeated search move');

    const healthOne = await page.evaluate(async () => {
      const engine = await import('/src/engine/stockfishBridge.ts');
      return engine.runStockfishHealthCheck(10000);
    });

    validateLegalMove(healthOne.bestMove, 'Health check best move');
    assertBootDiagnostics(healthOne.diagnostics, 'Isolated health check one');

    const healthTwo = await page.evaluate(async () => {
      const engine = await import('/src/engine/stockfishBridge.ts');
      return engine.runStockfishHealthCheck(10000);
    });

    validateLegalMove(healthTwo.bestMove, 'Restarted health check best move');
    assertBootDiagnostics(healthTwo.diagnostics, 'Isolated health check two');

    console.log('Stockfish stability check passed.');
  } catch (error) {
    console.error('Stockfish stability check failed:', error);
    process.exitCode = 1;
  } finally {
    if (browser) {
      await browser.close().catch(() => undefined);
    }

    if (server) {
      server.kill();
    }
  }
}

function validateLegalMove(move, label) {
  if (!move) {
    throw new Error(`${label} was null.`);
  }

  const chess = new Chess();
  const result = /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move)
    ? chess.move({
        from: move.slice(0, 2),
        to: move.slice(2, 4),
        promotion: move.length === 5 ? move[4] : undefined,
      })
    : chess.move(move);
  if (!result) {
    throw new Error(`${label} was not legal: ${move}`);
  }
}

function assertBootDiagnostics(diagnostics, label) {
  if (!diagnostics?.bootFlags) {
    throw new Error(`${label} did not return Stockfish diagnostics.`);
  }

  const required = [
    ['worker_booted_seen', 'worker_booted'],
    ['stockfish_script_loaded_seen', 'stockfish_script_loaded'],
    ['uciok_seen', 'uciok_received'],
    ['readyok_seen', 'readyok_received'],
    ['first_bestmove_received', 'first_bestmove_received'],
  ];
  const missing = required.filter(([flag]) => !diagnostics.bootFlags[flag]).map(([, phase]) => phase);
  if (missing.length > 0) {
    throw new Error(`${label} missed required Stockfish phase(s): ${missing.join(', ')}`);
  }
}

function startDevServer() {
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const server = spawn(npmCommand, ['run', 'dev', '--', '--host', HOST, '--port', String(PORT)], {
    stdio: 'pipe',
    shell: false,
  });

  server.stdout.on('data', (chunk) => {
    process.stdout.write(String(chunk));
  });

  server.stderr.on('data', (chunk) => {
    process.stderr.write(String(chunk));
  });

  return server;
}

async function waitForServerBoot(server) {
  let exitError = null;
  server.on('exit', (code) => {
    exitError = new Error(`Dev server exited before it became ready (code ${code}).`);
  });

  const deadline = Date.now() + SERVER_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (exitError) throw exitError;
    if (await isServerReachable()) return;
    await delay(250);
  }

  throw new Error(`Timed out waiting for the Vite dev server at ${URL}.`);
}

async function isServerReachable() {
  try {
    const response = await fetch(URL, { method: 'GET' });
    return response.ok;
  } catch {
    return false;
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
