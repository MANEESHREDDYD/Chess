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

    const results = await page.evaluate(async () => {
      const engine = await import('/src/engine/stockfishBridge.ts');
      const mirror = await import('/src/engine/mirrorOpponent.ts');
      const personalities = await import('/src/mirror/mirrorPersonality.ts');

      const vector = {
        opening_white_top3: ['e4'],
        opening_black_top3: ['e5'],
        avg_move_time_ms: 8500,
        time_pressure_blunder_rate: 0.42,
        exchange_willingness: 0.88,
        preferred_minor: 'knight',
        motif_blindness: {
          fork: 0.72,
          pin: 0.24,
          skewer: 0.38,
          removing_the_defender: 0.44,
        },
        endgame_strength: 0.56,
        swindle_preference: 'principled',
        detected_elo: 1500,
        elo_band: 'initiate',
        schema_version: 1,
      };

      const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const blackFen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
      const fixtureFen = '4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1';
      const fixtureCandidates = [
        { move: 'e4e5', cp: 60, mate: null, multipv: 1, pv: ['e4e5'] },
        { move: 'e4d5', cp: 0, mate: null, multipv: 2, pv: ['e4d5'] },
      ];

      const health = await engine.runStockfishHealthCheck(10000);

      const opponent = mirror.createMirrorOpponent(vector, { personalityMode: 'current_self' });
      const white = await opponent.getMoveWithTrace(startFen, {
        depth: 8,
        timeoutMs: 15000,
        personalityMode: 'current_self',
        seed: 'verification-white',
      });
      const black = await opponent.getMoveWithTrace(blackFen, {
        depth: 8,
        timeoutMs: 15000,
        personalityMode: 'aggressive_self',
        seed: 'verification-black',
      });
      opponent.dispose?.();

      const perMode = personalities.MIRROR_PERSONALITY_MODES.map((mode) => {
        const ranked = mirror.rankMirrorCandidates(
          fixtureFen,
          fixtureCandidates,
          vector,
          mode,
          undefined,
          `verification-${mode}`
        );
        const trace = mirror.buildMirrorDecisionTrace(ranked);
        return {
          mode,
          selected: ranked[0]?.move ?? null,
          selectedCpLoss: ranked[0]?.cpLossFromBest ?? null,
          candidateMoves: ranked.map((candidate) => candidate.move),
          explanation: mirror.describeMirrorDecision(trace, 1),
        };
      });

      const deterministicA = mirror.rankMirrorCandidates(
        fixtureFen,
        fixtureCandidates,
        vector,
        'current_self',
        undefined,
        'same-input'
      );
      const deterministicB = mirror.rankMirrorCandidates(
        fixtureFen,
        fixtureCandidates,
        vector,
        'current_self',
        undefined,
        'same-input'
      );

      const improved = perMode.find((entry) => entry.mode === 'improved_self');
      const blunderProne = perMode.find((entry) => entry.mode === 'blunder_prone_self');

      return {
        health,
        white,
        black,
        perMode,
        deterministic: {
          first: deterministicA.map((entry) => entry.move),
          second: deterministicB.map((entry) => entry.move),
        },
        cpLossComparison: {
          improved: improved?.selectedCpLoss ?? null,
          blunderProne: blunderProne?.selectedCpLoss ?? null,
        },
      };
    });

    if (!results.health?.ok) {
      throw new Error(`Stockfish health failed: ${results.health?.error?.message ?? 'unknown'}`);
    }
    validateLegalMove(new Chess(), results.health.bestMove, 'Stockfish health best move');

    validateLegalMove(new Chess(), results.white.move, 'Mirror as White move');
    const blackGame = new Chess();
    blackGame.move({ from: 'e2', to: 'e4' });
    validateLegalMove(blackGame, results.black.move, 'Mirror as Black move');

    const fixtureFen = '4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1';
    const fixtureCandidates = new Set(['e4e5', 'e4d5']);
    for (const entry of results.perMode) {
      if (!entry.selected) {
        throw new Error(`${entry.mode} did not select a move.`);
      }
      if (!fixtureCandidates.has(entry.selected)) {
        throw new Error(`${entry.mode} selected ${entry.selected}, which was outside the candidate list.`);
      }
      validateLegalMove(new Chess(fixtureFen), entry.selected, `${entry.mode} selected move`);
      if (!entry.explanation || entry.explanation.length < 20) {
        throw new Error(`${entry.mode} did not generate a useful explanation.`);
      }
    }

    if (JSON.stringify(results.deterministic.first) !== JSON.stringify(results.deterministic.second)) {
      throw new Error('Mirror personality reranking is not deterministic for identical input.');
    }

    const improvedCp = results.cpLossComparison.improved;
    const blunderCp = results.cpLossComparison.blunderProne;
    if (typeof improvedCp !== 'number' || typeof blunderCp !== 'number' || improvedCp > blunderCp) {
      throw new Error(
        `Improved self CP loss (${improvedCp}) was not equal-or-better than blunder-prone (${blunderCp}).`
      );
    }

    console.log('Mirror personality verification passed.');
    console.log(`Modes checked: ${results.perMode.map((entry) => entry.mode).join(', ')}`);
  } catch (error) {
    console.error('Mirror personality verification failed:', error);
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

function validateLegalMove(game, move, label) {
  if (!move) {
    throw new Error(`${label} was null.`);
  }

  const result = /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move)
    ? game.move({
        from: move.slice(0, 2),
        to: move.slice(2, 4),
        promotion: move.length === 5 ? move[4] : undefined,
      })
    : game.move(move);
  if (!result) {
    throw new Error(`${label} was not legal: ${move}`);
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
