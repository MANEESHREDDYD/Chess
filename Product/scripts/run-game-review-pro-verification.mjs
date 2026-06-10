import puppeteer from 'puppeteer';
import { spawn } from 'child_process';

const PORT = 5173;
const HOST = '127.0.0.1';
const BASE_URL = `http://${HOST}:${PORT}`;
const URL = `${BASE_URL}/review/imported_game/ig-review-valid`;
const SERVER_TIMEOUT_MS = 30000;

async function run() {
  let server = null;
  let browser = null;

  try {
    if (await isServerReachable()) {
      console.log(`Using existing dev server at ${BASE_URL}`);
    } else {
      console.log('Starting dev server...');
      server = startDevServer();
      await waitForServerBoot(server);
    }

    browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();

    page.on('console', (msg) => {
      console.log(`BROWSER: ${msg.text()}`);
    });

    page.on('pageerror', (err) => {
      console.error(`BROWSER ERROR: ${err.message}`);
    });

    await page.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: 60000 });
    await page.evaluate(async () => {
      const dbModule = await import('/src/data/db.ts');
      await dbModule.deleteMirrorDb();
      const db = await dbModule.openMirrorDb();
      await db.put('players', {
        id: 'player-review-verifier',
        display_name: 'Review Verifier',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      await db.put('imported_games', {
        id: 'ig-review-valid',
        player_id: 'player-review-verifier',
        source: 'manual_pgn',
        imported_at: new Date().toISOString(),
        headers: { Event: 'Review verification', White: 'Review Verifier', Black: 'Opponent', Result: '*' },
        pgn_text: '1. e4 e5 2. Qh5 Nc6 *',
        normalized_pgn: '1. e4 e5 2. Qh5 Nc6 *',
        result: '*',
        white: 'Review Verifier',
        black: 'Opponent',
        user_color: 'white',
        move_count: 4,
        final_fen: 'r1bqkbnr/pppp1ppp/2n5/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR w KQkq - 2 3',
        legal_status: 'valid',
        validation_errors: [],
        analysis_status: 'not_analyzed',
        stylevector_applied: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      await db.put('imported_games', {
        id: 'ig-review-invalid',
        player_id: 'player-review-verifier',
        source: 'manual_pgn',
        imported_at: new Date().toISOString(),
        headers: { Event: 'Broken review verification' },
        pgn_text: '1. e4 e5 2. BadMove *',
        normalized_pgn: '',
        result: '*',
        user_color: 'white',
        move_count: 0,
        final_fen: 'start',
        legal_status: 'invalid',
        validation_errors: ['Invalid move in PGN body.'],
        analysis_status: 'not_analyzed',
        stylevector_applied: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      localStorage.setItem('mirror_active_player_id', 'player-review-verifier');
    });

    await page.goto(URL, { waitUntil: 'networkidle0', timeout: 60000 });
    const routeText = await page.$eval('body', (body) => body.textContent ?? '');
    if (!routeText.includes('Review your game') || !routeText.includes('Analyze game')) {
      throw new Error('/review route did not render the Game Review Pro analysis entry state.');
    }

    const results = await page.evaluate(async () => {
      const service = await import('/src/review/gameReviewService.ts');
      const classifier = await import('/src/review/moveClassifier.ts');

      const candidateProvider = (() => {
        let call = 0;
        const beforeScores = [
          { move: 'e2e4', cp: 20 },
          { move: 'e7e5', cp: 20 },
          { move: 'g1f3', cp: 220 },
          { move: 'b8c6', cp: 30 },
        ];
        const afterScores = [
          { move: 'e7e5', cp: -20 },
          { move: 'g1f3', cp: -20 },
          { move: 'b8c6', cp: 100 },
          { move: 'g1f3', cp: -10 },
        ];

        return async (_fen, multipv) => {
          const pairIndex = Math.floor(call / 2);
          const score = call % 2 === 0 ? beforeScores[pairIndex] ?? beforeScores[0] : afterScores[pairIndex] ?? afterScores[0];
          call += 1;
          return [
            { move: score.move, cp: score.cp, mate: null, multipv: 1, pv: [score.move] },
            ...(multipv > 1
              ? [{ move: 'a2a3', cp: score.cp - 40, mate: null, multipv: 2, pv: ['a2a3'] }]
              : []),
          ];
        };
      })();

      const review = await service.createGameReview({
        playerId: 'player-review-verifier',
        sourceType: 'imported_game',
        sourceId: 'ig-review-valid',
        depth: 1,
        maxMoves: 4,
        candidateProvider,
      });

      let invalidRejected = false;
      try {
        await service.createGameReview({
          playerId: 'player-review-verifier',
          sourceType: 'imported_game',
          sourceId: 'ig-review-invalid',
          depth: 1,
          maxMoves: 2,
          candidateProvider: async () => [],
        });
      } catch {
        invalidRejected = true;
      }

      const retryTarget = review.move_reviews.find((move) => move.best_move) ?? review.move_reviews[0];
      const retry = service.compareRetryMove(retryTarget, retryTarget.best_move ?? 'e2e4');
      const markdown = service.exportGameReviewMarkdown(review);
      const cpLoss = classifier.calculateCpLoss(220, -100);

      return {
        review: {
          moveCount: review.move_reviews.length,
          classifications: review.move_reviews.map((move) => move.classification),
          keyMoments: review.key_moments.length,
          personalizedNotes: review.personalized_summary.notes,
          insufficient: review.personalized_summary.insufficient_data,
          importedStatus: review.source_type,
        },
        invalidRejected,
        retry,
        markdownHasSecrets: /access_token|service_role|refresh_token|supabase/i.test(markdown),
        cpLoss,
      };
    });

    if (results.review.moveCount !== 4) {
      throw new Error(`Expected 4 reviewed moves, got ${results.review.moveCount}.`);
    }
    if (!results.review.classifications.some((label) => label !== 'unknown')) {
      throw new Error('Move classifications were not produced.');
    }
    if (results.cpLoss !== 320) {
      throw new Error(`CP-loss normalization fixture failed: expected 320, got ${results.cpLoss}.`);
    }
    if (results.review.keyMoments < 1) {
      throw new Error('Key moments were not detected.');
    }
    if (results.review.importedStatus !== 'imported_game') {
      throw new Error('Imported valid game was not reviewed as an imported source.');
    }
    if (!results.invalidRejected) {
      throw new Error('Invalid imported game was not rejected.');
    }
    if (results.retry.status !== 'correct') {
      throw new Error(`Retry mistake fixture did not accept best move: ${results.retry.status}.`);
    }
    if (
      results.review.personalizedNotes.length === 0 &&
      !results.review.insufficient.includes('stylevector_missing')
    ) {
      throw new Error('Personalized notes or explicit insufficient-data behavior were missing.');
    }
    if (results.markdownHasSecrets) {
      throw new Error('Markdown review export contained a secret/token marker.');
    }

    console.log('Game Review Pro verification passed.');
    console.log(`Reviewed moves: ${results.review.moveCount}; key moments: ${results.review.keyMoments}.`);
  } catch (error) {
    console.error('Game Review Pro verification failed:', error);
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

  throw new Error(`Timed out waiting for the Vite dev server at ${BASE_URL}.`);
}

async function isServerReachable() {
  try {
    const response = await fetch(BASE_URL, { method: 'GET' });
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
