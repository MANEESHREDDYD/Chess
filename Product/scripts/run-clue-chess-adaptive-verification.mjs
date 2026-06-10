import puppeteer from 'puppeteer';
import { spawn } from 'child_process';

const PORT = 5173;
const HOST = '127.0.0.1';
const BASE_URL = `http://${HOST}:${PORT}`;
const URL = `${BASE_URL}/clue-chess?mode=adaptive&motif=pin&review=true`;
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
    page.on('console', (msg) => console.log(`BROWSER: ${msg.text()}`));
    page.on('pageerror', (err) => console.error(`BROWSER ERROR: ${err.message}`));

    await page.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: 60000 });
    await page.evaluate(async () => {
      const dbModule = await import('/src/data/db.ts');
      await dbModule.deleteMirrorDb();
      const db = await dbModule.openMirrorDb();
      const playerId = 'clue-verifier';
      localStorage.setItem('mirror_active_player_id', playerId);
      await db.put('players', {
        id: playerId,
        display_name: 'Clue Verifier',
        created_at: '2026-06-10T00:00:00.000Z',
        updated_at: '2026-06-10T00:00:00.000Z',
        current_style_vector_id: 'sv-clue-verifier',
        calibration_status: 'complete',
      });
      await db.put('style_vectors', {
        id: 'sv-clue-verifier',
        player_id: playerId,
        source: 'calibration',
        computed_at: '2026-06-10T00:00:00.000Z',
        vector: {
          opening_white_top3: ['e4'],
          opening_black_top3: ['e5'],
          avg_move_time_ms: 9000,
          time_pressure_blunder_rate: 0.2,
          exchange_willingness: 0.5,
          preferred_minor: 'knight',
          motif_blindness: { fork: 0.2, pin: 0.9, skewer: 0.2, removing_the_defender: 0.2 },
          endgame_strength: 0.5,
          swindle_preference: 'principled',
          detected_elo: 1200,
          elo_band: 'initiate',
          schema_version: 1,
        },
      });
      await db.put('clue_attempts', {
        id: 'clue-verifier-pin-fail',
        player_id: playerId,
        puzzle_id: 'seed-pin-1',
        source: 'seed',
        fen: 'fixture',
        solution_moves: ['e3e7'],
        attempted_moves: ['e3e6'],
        motif: 'pin',
        difficulty: 'beginner',
        hints_used: 1,
        solved: false,
        started_at: '2026-06-10T00:00:00.000Z',
        created_at: '2026-06-10T00:00:00.000Z',
      });
      await db.put('puzzle_reviews', {
        id: `${playerId}:seed-pin-1`,
        player_id: playerId,
        puzzle_id: 'seed-pin-1',
        motif: 'pin',
        difficulty: 'beginner',
        next_due_at: '2020-01-01T00:00:00.000Z',
        interval_days: 1,
        ease: 2,
        attempts: 2,
        lapses: 1,
        solved_streak: 0,
        last_result: 'failed',
        updated_at: '2026-06-10T00:00:00.000Z',
      });
    });

    await page.goto(URL, { waitUntil: 'networkidle0', timeout: 60000 });
    const routeText = await page.$eval('body', (body) => body.textContent ?? '');
    for (const text of [
      'The right clue at the right difficulty',
      'Adaptive Training',
      'Review Mode',
      'Streak Mode',
      'Boss Puzzle',
      'Kids Mode',
      'Show next clue',
    ]) {
      if (!routeText.includes(text)) {
        throw new Error(`/clue-chess route missing required text: ${text}`);
      }
    }

    const results = await page.evaluate(async () => {
      const engine = await import('/src/clue/adaptiveClueEngine.ts');
      const memory = await import('/src/clue/clueMemory.ts');
      const puzzles = await import('/src/data/cluePuzzles.ts');
      const dbModule = await import('/src/data/db.ts');
      const analytics = await import('/src/analytics/dashboardService.ts');

      const context = await engine.buildAdaptiveClueContext('clue-verifier', {
        requestedMotif: 'pin',
        analyticsWeakMotif: 'pin',
      });
      const reviewSelection = engine.selectAdaptiveCluePuzzle(context, 'review');
      const adaptiveSelection = engine.selectAdaptiveCluePuzzle(context, 'adaptive', { requestedMotif: 'pin' });
      const levels = engine.getClueLevels();
      const levelTexts = levels.map((level) => engine.generateClueVariants(adaptiveSelection.puzzle, level, 'adaptive')[0]?.text ?? '');

      const variants = engine.generateClueVariants(adaptiveSelection.puzzle, 1, 'adaptive');
      await memory.recordClueVariantShown({
        playerId: 'clue-verifier',
        puzzleId: adaptiveSelection.puzzle.id,
        clueLevel: 1,
        variantId: variants[0].id,
        mode: 'adaptive',
        attemptContext: 'verification',
      });
      const seen = await memory.getSeenClueVariantIds('clue-verifier', adaptiveSelection.puzzle.id, 1);
      const noRepeat = memory.selectUnseenClueVariant(variants, seen, false);

      const streakWon = engine.updateStreakState({ count: 0, best: 0, lives: 3 }, true);
      const streakLost = engine.updateStreakState(streakWon, false);
      const boss = engine.buildBossPuzzleSequence(context, 'pin');
      const kidsText = engine.generateClueVariants(adaptiveSelection.puzzle, 3, 'kids')[0]?.text ?? '';

      const db = await dbModule.openMirrorDb();
      await db.put('game_reviews', makeReview('clue-verifier'));
      const snapshot = await analytics.buildAnalyticsDashboardSnapshot('clue-verifier');
      const clueAction = snapshot.recommended_actions.find((action) => action.type === 'open_clue_chess' || action.type === 'review_puzzles');

      return {
        route: {
          reviewPuzzle: reviewSelection.puzzle.id,
          dueReview: reviewSelection.due_review,
          adaptiveStartLevel: adaptiveSelection.start_level,
        },
        levels,
        levelTexts,
        noRepeatDifferent: noRepeat ? noRepeat.id !== variants[0].id : variants.length === 1,
        reviewRepeatAllowed: memory.selectUnseenClueVariant(variants, variants.map((variant) => variant.id), true)?.id === variants[0].id,
        streak: { won: streakWon.count, lost: streakLost.count, lives: streakLost.lives },
        bossCount: boss.puzzle_ids.length,
        kidsText,
        analyticsRoute: clueAction?.route ?? '',
      };

      function makeReview(playerId) {
        return {
          id: 'review-clue-verifier',
          player_id: playerId,
          source_type: 'local_match',
          source_id: 'local-clue-verifier',
          created_at: '2026-06-10T00:00:00.000Z',
          engine_name: 'Stockfish',
          total_moves: 1,
          phase_summary: {
            opening: { phase: 'opening', moves: 0, average_cp_loss: 0, blunder_count: 0, mistake_count: 0, inaccuracy_count: 0, summary: '' },
            middlegame: { phase: 'middlegame', moves: 1, average_cp_loss: 200, blunder_count: 1, mistake_count: 0, inaccuracy_count: 0, summary: '' },
            endgame: { phase: 'endgame', moves: 0, average_cp_loss: 0, blunder_count: 0, mistake_count: 0, inaccuracy_count: 0, summary: '' },
            weakest_phase: 'middlegame',
            summary: 'fixture',
          },
          key_moments: [],
          move_reviews: [
            {
              ply: 1,
              move_number: 1,
              san: 'Re6',
              fen_before: 'fixture',
              side: 'white',
              cp_loss: 200,
              classification: 'mistake',
              phase: 'middlegame',
              motif_tags: ['pin'],
              is_turning_point: true,
              retry_available: true,
              explanation: 'fixture',
              evidence: ['fixture'],
            },
          ],
          personalized_summary: { headline: 'pin', notes: [], evidence: [], insufficient_data: [] },
          recommended_actions: [],
        };
      }
    });

    if (results.route.reviewPuzzle !== 'seed-pin-1' || !results.route.dueReview) {
      throw new Error(`Review mode did not prioritize due review: ${JSON.stringify(results.route)}`);
    }
    if (JSON.stringify(results.levels) !== JSON.stringify([1, 2, 3, 4, 5]) || results.levelTexts.some((text) => !text)) {
      throw new Error(`Clue levels 1-5 did not generate: ${JSON.stringify(results.levels)}`);
    }
    if (!results.noRepeatDifferent || !results.reviewRepeatAllowed) {
      throw new Error('No-repeat or review-repeat clue behavior failed.');
    }
    if (results.streak.won !== 1 || results.streak.lost !== 0 || results.streak.lives !== 2) {
      throw new Error(`Streak mode increment/reset failed: ${JSON.stringify(results.streak)}`);
    }
    if (results.bossCount < 3 || results.bossCount > 5) {
      throw new Error(`Boss mode sequence length invalid: ${results.bossCount}`);
    }
    if (!results.kidsText.includes('Try this:')) {
      throw new Error(`Kids mode did not use simplified wording: ${results.kidsText}`);
    }
    if (!results.analyticsRoute.startsWith('/clue-chess?')) {
      throw new Error(`Analytics action did not route to Clue Chess: ${results.analyticsRoute}`);
    }

    console.log('Adaptive Clue Chess verification passed.');
    console.log(`Review puzzle: ${results.route.reviewPuzzle}; boss count: ${results.bossCount}; analytics route: ${results.analyticsRoute}`);
  } catch (error) {
    console.error('Adaptive Clue Chess verification failed:', error);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close().catch(() => undefined);
    if (server) server.kill();
  }
}

function startDevServer() {
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const server = spawn(npmCommand, ['run', 'dev', '--', '--host', HOST, '--port', String(PORT)], {
    stdio: 'pipe',
    shell: false,
  });
  server.stdout.on('data', (chunk) => process.stdout.write(String(chunk)));
  server.stderr.on('data', (chunk) => process.stderr.write(String(chunk)));
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
  throw new Error(`Timed out waiting for Vite dev server at ${BASE_URL}.`);
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
