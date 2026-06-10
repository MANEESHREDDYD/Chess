import puppeteer from 'puppeteer';
import { spawn } from 'child_process';

const PORT = 5173;
const HOST = '127.0.0.1';
const BASE_URL = `http://${HOST}:${PORT}`;
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
    await seedProductQualityFixture(page);

    await verifyRoute(page, '/play?stockfishBootCheck', ['Match']);
    await page.evaluate(() => window.__MIRROR_PLAY_TEST__?.startGame('white', 'Beginner'));
    const playText = await getBodyText(page);
    if (playText.includes('Engine unavailable')) {
      throw new Error('Play route showed blocking Engine unavailable before White made a move.');
    }

    await verifyRoute(page, '/mirror', ['Mirror', 'Mirror personality']);
    await verifyRoute(page, '/clue-chess?mode=adaptive&motif=pin', ['The right clue at the right difficulty', 'Adaptive Training']);
    await verifyRoute(page, '/analytics', ['Player intelligence dashboard', 'Recommended next actions']);
    await verifyRoute(page, '/review/local_match/quality-local', ['Review your game', 'Move timeline']);

    await page.goto(`${BASE_URL}/story`, { waitUntil: 'networkidle0', timeout: 60000 });
    const storyText = await getBodyText(page);
    if (!storyText.includes('Story Campaign') || !storyText.includes('Start Mission')) {
      throw new Error('Story landing did not render as a campaign mission surface.');
    }
    if (storyText.includes('Start Puzzle') || storyText.includes('Get Clue')) {
      throw new Error('Story landing still contains clue-first puzzle wording.');
    }

    const promotionResults = await page.evaluate(async () => {
      const promotion = await import('/src/chess/promotion.ts');
      return {
        knight: promotion.isLegalPromotionMove({
          fen: '4k3/8/8/8/8/8/8/RNBQKBNR w KQ - 0 1',
          sourceSquare: 'b1',
          targetSquare: 'b8',
          piece: 'wN',
        }),
        wrongRank: promotion.isLegalPromotionMove({
          fen: '4k3/8/P7/8/8/8/8/4K3 w - - 0 1',
          sourceSquare: 'a6',
          targetSquare: 'a7',
          piece: 'wP',
        }),
        whitePromotion: promotion.isLegalPromotionMove({
          fen: '4k3/P7/8/8/8/8/8/4K3 w - - 0 1',
          sourceSquare: 'a7',
          targetSquare: 'a8',
          piece: 'wP',
        }),
        blackPromotion: promotion.isLegalPromotionMove({
          fen: '4k3/8/8/8/8/8/p7/4K3 b - - 0 1',
          sourceSquare: 'a2',
          targetSquare: 'a1',
          piece: 'bP',
        }),
      };
    });
    if (
      promotionResults.knight ||
      promotionResults.wrongRank ||
      !promotionResults.whitePromotion ||
      !promotionResults.blackPromotion
    ) {
      throw new Error(`Promotion legality regression: ${JSON.stringify(promotionResults)}`);
    }

    await page.goto(`${BASE_URL}/story`, { waitUntil: 'networkidle0', timeout: 60000 });
    await page.evaluate(() => {
      const startButton = Array.from(document.querySelectorAll('button')).find((button) =>
        (button.textContent ?? '').includes('Start Mission')
      );
      if (startButton instanceof HTMLButtonElement) startButton.click();
    });
    await page.waitForSelector('.board-frame', { timeout: 10000 });
    const boardBounds = await page.evaluate(() => {
      const frame = document.querySelector('.board-frame');
      if (!frame) return { found: false, withinBounds: false, imageCount: 0 };
      const frameRect = frame.getBoundingClientRect();
      const images = Array.from(frame.querySelectorAll('img'));
      const withinBounds = images.every((img) => {
        const rect = img.getBoundingClientRect();
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          rect.left >= frameRect.left - 2 &&
          rect.right <= frameRect.right + 2 &&
          rect.top >= frameRect.top - 2 &&
          rect.bottom <= frameRect.bottom + 2
        );
      });
      return { found: true, withinBounds, imageCount: images.length };
    });
    if (!boardBounds.found) {
      throw new Error('Board frame did not render on Story route.');
    }
    if (boardBounds.imageCount > 0 && !boardBounds.withinBounds) {
      throw new Error(`Themed board piece images exceeded square/frame bounds: ${JSON.stringify(boardBounds)}`);
    }

    console.log('Product quality visual check passed.');
    console.log(`Promotion guard: ${JSON.stringify(promotionResults)}; board images: ${boardBounds.imageCount}.`);
  } catch (error) {
    console.error('Product quality visual check failed:', error);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close().catch(() => undefined);
    if (server) server.kill();
  }
}

async function seedProductQualityFixture(page) {
  const playerId = 'quality-visual-player';
  const reviewRecord = makeReview(playerId);
  await page.evaluate(async ({ playerId: seededPlayerId, reviewRecord: seededReview }) => {
    const dbModule = await import('/src/data/db.ts');
    await dbModule.deleteMirrorDb();
    const db = await dbModule.openMirrorDb();
    const playerId = seededPlayerId;
    localStorage.setItem('mirror_active_player_id', playerId);
    localStorage.setItem(
      'mirror-settings',
      JSON.stringify({
        state: { activeTheme: 'mahabharata', audioEnabled: false, audioVolume: 0.5 },
        version: 0,
      })
    );

    await db.put('players', {
      id: playerId,
      display_name: 'Quality Visual Player',
      created_at: '2026-06-10T00:00:00.000Z',
      updated_at: '2026-06-10T00:00:00.000Z',
      current_style_vector_id: 'sv-quality-visual',
      calibration_status: 'complete',
    });
    await db.put('style_vectors', {
      id: 'sv-quality-visual',
      player_id: playerId,
      source: 'calibration',
      computed_at: '2026-06-10T00:00:00.000Z',
      vector: {
        opening_white_top3: ['e4'],
        opening_black_top3: ['e5'],
        avg_move_time_ms: 9000,
        time_pressure_blunder_rate: 0.2,
        exchange_willingness: 0.55,
        preferred_minor: 'knight',
        motif_blindness: { fork: 0.2, pin: 0.8, skewer: 0.3, removing_the_defender: 0.3 },
        endgame_strength: 0.55,
        swindle_preference: 'principled',
        detected_elo: 1200,
        elo_band: 'initiate',
        schema_version: 1,
      },
    });
    await db.put('local_matches', {
      id: 'quality-local',
      player_id: playerId,
      mode: 'computer',
      side: 'white',
      actual_side: 'white',
      difficulty: 'Beginner',
      result: 'white_win',
      result_label: 'white_win',
      pgn: '1. e4 e5 1-0',
      move_count: 2,
      created_at: '2026-06-10T00:00:00.000Z',
      completed_at: '2026-06-10T00:05:00.000Z',
    });
    await db.put('game_reviews', seededReview);
  }, { playerId, reviewRecord });
}

function makeReview(playerId) {
  const moveReviews = [
    {
      ply: 1,
      move_number: 1,
      san: 'e4',
      fen_before: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      fen_after: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
      side: 'white',
      cp_loss: 8,
      classification: 'best',
      phase: 'opening',
      motif_tags: ['opening'],
      is_turning_point: false,
      retry_available: true,
      explanation: 'Fixture review move.',
      evidence: ['Normalized CP loss: 8.'],
      best_move: 'e2e4',
    },
  ];
  return {
    id: 'quality-review',
    player_id: playerId,
    source_type: 'local_match',
    source_id: 'quality-local',
    created_at: '2026-06-10T00:10:00.000Z',
    engine_name: 'Stockfish',
    total_moves: 1,
    reviewed_side: 'both',
    accuracy_white: 96,
    accuracy_black: 0,
    average_cp_loss_white: 8,
    average_cp_loss_black: 0,
    result: 'white_win',
    phase_summary: {
      opening: {
        phase: 'opening',
        moves: 1,
        average_cp_loss: 8,
        blunder_count: 0,
        mistake_count: 0,
        inaccuracy_count: 0,
        summary: 'Opening reviewed.',
      },
      middlegame: {
        phase: 'middlegame',
        moves: 0,
        average_cp_loss: 0,
        blunder_count: 0,
        mistake_count: 0,
        inaccuracy_count: 0,
        summary: 'No middlegame moves.',
      },
      endgame: {
        phase: 'endgame',
        moves: 0,
        average_cp_loss: 0,
        blunder_count: 0,
        mistake_count: 0,
        inaccuracy_count: 0,
        summary: 'No endgame moves.',
      },
      weakest_phase: 'opening',
      summary: 'Fixture opening review.',
    },
    key_moments: [],
    move_reviews: moveReviews,
    personalized_summary: {
      headline: 'Fixture review ready.',
      notes: ['StyleVector fixture evidence is present.'],
      evidence: ['fixture'],
      insufficient_data: [],
    },
    recommended_actions: [],
  };
}

async function verifyRoute(page, path, requiredText) {
  await page.goto(`${BASE_URL}${path}`, { waitUntil: 'networkidle0', timeout: 60000 });
  const text = await getBodyText(page);
  for (const entry of requiredText) {
    if (!text.includes(entry)) {
      throw new Error(`${path} missing required text: ${entry}`);
    }
  }
}

async function getBodyText(page) {
  return page.$eval('body', (body) => body.textContent ?? '');
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
