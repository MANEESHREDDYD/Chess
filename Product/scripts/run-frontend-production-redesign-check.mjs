import puppeteer from 'puppeteer';
import { spawn } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

const PORT = 5173;
const HOST = '127.0.0.1';
const BASE_URL = `http://${HOST}:${PORT}`;
const ARTIFACT_DIR = path.resolve('artifacts/frontend-redesign');
const SERVER_TIMEOUT_MS = 30000;

const VIEWPORTS = [
  { width: 1440, height: 900, label: '1440x900' },
  { width: 1366, height: 768, label: '1366x768' },
  { width: 1280, height: 720, label: '1280x720' },
  { width: 1024, height: 768, label: '1024x768' },
  { width: 900, height: 768, label: '900x768' },
  { width: 390, height: 844, label: '390x844' },
];

const ROUTES = [
  { path: '/play?stockfishBootCheck=1', name: 'play' },
  { path: '/progress', name: 'profile' },
  { path: '/mirror', name: 'mirror' },
  { path: '/story', name: 'story' },
  { path: '/clue-chess?mode=adaptive&motif=pin', name: 'clue-chess' },
  { path: '/analytics', name: 'analytics' },
  { path: '/review/local_match/frontend-local', name: 'review' },
  { path: '/import-pgn', name: 'import-pgn' },
];

async function run() {
  let server = null;
  let browser = null;

  try {
    await rm(ARTIFACT_DIR, { recursive: true, force: true });
    await mkdir(ARTIFACT_DIR, { recursive: true });

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
    await seedFrontendFixture(page);

    const failures = [];
    for (const viewport of VIEWPORTS) {
      await page.setViewport({ width: viewport.width, height: viewport.height, deviceScaleFactor: 1 });
      for (const route of ROUTES) {
        try {
          await verifyRouteAtViewport(page, route, viewport);
        } catch (error) {
          failures.push(`${route.name} ${viewport.label}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }

    if (failures.length > 0) {
      throw new Error(`Frontend production redesign check failed:\n${failures.map((entry) => `- ${entry}`).join('\n')}`);
    }

    console.log('Frontend production redesign check passed.');
    console.log(`Screenshots saved to ${ARTIFACT_DIR}`);
  } catch (error) {
    console.error('Frontend production redesign check failed:', error);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close().catch(() => undefined);
    if (server) stopProcessTree(server);
  }
}

async function verifyRouteAtViewport(page, route, viewport) {
  await page.goto(`${BASE_URL}${route.path}`, { waitUntil: 'networkidle0', timeout: 60000 });
  if (route.name === 'play') {
    await preparePlayGameOverState(page);
  }
  await page.screenshot({
    fullPage: true,
    path: path.join(ARTIFACT_DIR, `${route.name}-${viewport.label}.png`),
  });

  const common = await page.evaluate(() => {
    const body = document.body;
    const header = document.querySelector('.app-header-v2')?.getBoundingClientRect();
    const main = document.querySelector('.app-main-v2')?.getBoundingClientRect();
    return {
      scrollWidth: body.scrollWidth,
      viewportWidth: window.innerWidth,
      headerBottom: header?.bottom ?? 0,
      mainTop: main?.top ?? 0,
      text: body.textContent ?? '',
    };
  });

  if (common.scrollWidth > common.viewportWidth + 8) {
    throw new Error(`body horizontal overflow: scrollWidth=${common.scrollWidth}, viewport=${common.viewportWidth}`);
  }
  if (common.headerBottom > common.mainTop + 2) {
    throw new Error(`header overlaps page content: headerBottom=${common.headerBottom}, mainTop=${common.mainTop}`);
  }

  if (route.name === 'play') await verifyPlay(page, viewport);
  if (route.name === 'profile') await verifyProfile(page, common.text);
  if (route.name === 'story') verifyStory(common.text);
  if (route.name === 'clue-chess') await expectVisible(page, '.clue-chess-page__modes', 'Clue Chess mode selector');
  if (route.name === 'analytics') {
    if (!common.text.includes('Recommended next actions')) throw new Error('Analytics recommended actions were not visible.');
  }
  if (route.name === 'import-pgn') await verifyImport(page);
}

async function verifyPlay(page, viewport) {
  await expectVisible(page, '[data-qa="play-controls"]', 'play controls');
  await expectVisible(page, '[data-qa="play-board"] .board-frame', 'play board');
  await expectVisible(page, '[data-qa="play-history"]', 'play history panel');

  const layout = await page.evaluate(() => {
    const controls = rect('[data-qa="play-controls"]');
    const board = rect('[data-qa="play-board"] .board-frame');
    const history = rect('[data-qa="play-history"]');
    const tableCard = rect('.play-history-card');
    const tableScroller = rect('.play-history-card .ui-table-card__scroller');
    const reviewButtons = Array.from(document.querySelectorAll('.play-review-card button, .play-review-card a.ui-button'))
      .map((element) => {
        const r = element.getBoundingClientRect();
        return {
          text: element.textContent?.trim() ?? '',
          width: r.width,
          height: r.height,
        };
      });
    const statusStrip = rect('[data-qa="play-status-strip"]');
    return {
      controls,
      board,
      history,
      tableCard,
      tableScroller,
      reviewButtons,
      statusStrip,
      overlaps: {
        boardControls: overlaps(board, controls),
        boardHistory: overlaps(board, history),
        controlsHistory: overlaps(controls, history),
      },
      bodyText: document.body.textContent ?? '',
    };

    function rect(selector) {
      const element = document.querySelector(selector);
      if (!element) return null;
      const r = element.getBoundingClientRect();
      return {
        left: r.left,
        right: r.right,
        top: r.top,
        bottom: r.bottom,
        width: r.width,
        height: r.height,
      };
    }

    function overlaps(a, b) {
      if (!a || !b) return true;
      return !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
    }
  });

  if (layout.overlaps.boardControls) throw new Error('board overlaps controls panel.');
  if (layout.overlaps.boardHistory) throw new Error('board overlaps history/review panel.');
  if (layout.overlaps.controlsHistory) throw new Error('controls panel overlaps history/review panel.');

  if (viewport.width >= 900) {
    const narrowButtons = layout.reviewButtons.filter((button) => button.width < 120);
    if (narrowButtons.length > 0) {
      throw new Error(`review actions collapsed below 120px: ${JSON.stringify(narrowButtons)}`);
    }
  }

  if (layout.tableCard && layout.tableScroller) {
    if (layout.tableScroller.left < layout.tableCard.left - 1 || layout.tableScroller.right > layout.tableCard.right + 1) {
      throw new Error('table scroller exceeds match history card bounds.');
    }
  }

  if (layout.bodyText.includes('Engine unavailable')) {
    throw new Error('Play route showed blocking Engine unavailable in frontend QA state.');
  }
  if (layout.bodyText.includes('Classic') && layout.bodyText.includes('Kurukshetra') && !layout.statusStrip) {
    throw new Error('theme status could not be located for consistency check.');
  }
}

async function verifyProfile(page, text) {
  if (text.includes('Back Home')) throw new Error('/profile still contains raw Back Home text.');
  if (!/\d+\s*\/\s*\d+\s*XP/.test(text)) throw new Error('/profile XP text did not match "number / number XP".');
  const badBackupLink = await page.evaluate(() => {
    const link = Array.from(document.querySelectorAll('a')).find((entry) =>
      (entry.textContent ?? '').toLowerCase().includes('backup your progress')
    );
    if (!link) return false;
    const style = window.getComputedStyle(link);
    return style.textDecorationLine.includes('underline') || style.color === 'rgb(0, 0, 238)';
  });
  if (badBackupLink) throw new Error('/profile still has a raw default backup link.');
}

function verifyStory(text) {
  if (!text.includes('Mission') && !text.includes('Start Mission')) {
    throw new Error('Story route did not contain mission-oriented language.');
  }
  if (text.includes('Start Puzzle')) {
    throw new Error('Story landing still uses Start Puzzle wording.');
  }
}

async function verifyImport(page) {
  await expectVisible(page, '.import-pgn__label textarea', 'PGN textarea');
  const overflow = await page.evaluate(() => {
    const textarea = document.querySelector('.import-pgn__label textarea');
    if (!textarea) return true;
    const r = textarea.getBoundingClientRect();
    return r.left < -1 || r.right > window.innerWidth + 1;
  });
  if (overflow) throw new Error('PGN textarea overflows the page.');
}

async function preparePlayGameOverState(page) {
  await page.waitForSelector('.play-layout', { timeout: 10000 });
  await page.waitForFunction(() => !!window.__MIRROR_PLAY_TEST__, { timeout: 10000 });
  await page.evaluate(() => window.__MIRROR_PLAY_TEST__.forceGameOverForLayout('frontend-local'));
  await delay(300);
}

async function expectVisible(page, selector, label) {
  await page.waitForSelector(selector, { timeout: 10000 });
  const visible = await page.$eval(selector, (element) => {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
  });
  if (!visible) throw new Error(`${label} is not visible.`);
}

async function seedFrontendFixture(page) {
  const playerId = 'frontend-redesign-player';
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
      display_name: 'Frontend Redesign Player',
      created_at: '2026-06-10T00:00:00.000Z',
      updated_at: '2026-06-10T00:00:00.000Z',
      current_style_vector_id: 'sv-frontend-redesign',
      calibration_status: 'complete',
    });
    await db.put('style_vectors', {
      id: 'sv-frontend-redesign',
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
        motif_blindness: { fork: 0.25, pin: 0.82, skewer: 0.3, removing_the_defender: 0.35 },
        endgame_strength: 0.55,
        swindle_preference: 'principled',
        detected_elo: 1200,
        elo_band: 'initiate',
        schema_version: 1,
      },
    });
    await db.put('local_matches', {
      id: 'frontend-local',
      player_id: playerId,
      mode: 'computer',
      side: 'white',
      actual_side: 'white',
      difficulty: 'Club',
      result: 'draw',
      result_label: 'draw',
      pgn: '1. e4 e5 2. Nf3 Nc6 1/2-1/2',
      move_count: 4,
      created_at: '2026-06-10T00:00:00.000Z',
      completed_at: '2026-06-10T00:08:00.000Z',
    });
    await db.put('mirror_matches', {
      id: 'frontend-mirror',
      player_id: playerId,
      started_at: '2026-06-10T00:00:00.000Z',
      completed_at: '2026-06-10T00:05:00.000Z',
      pgn: '1. e4 e5 *',
      result: 'Draw',
      metadata: {
        personality_mode: 'current_self',
        feedback_tags: ['felt_like_me'],
      },
    });
    await db.put('game_reviews', seededReview);
    await db.put('clue_attempts', {
      id: 'frontend-clue-attempt',
      player_id: playerId,
      puzzle_id: 'seed-pin-1',
      motif: 'pin',
      solved: false,
      attempts: 2,
      used_clues: 2,
      created_at: '2026-06-10T00:00:00.000Z',
    });
    await db.put('puzzle_reviews', {
      id: `${playerId}:seed-pin-1`,
      player_id: playerId,
      puzzle_id: 'seed-pin-1',
      motif: 'pin',
      due_at: '2026-06-09T00:00:00.000Z',
      interval_days: 1,
      ease: 2.2,
      repetitions: 1,
      lapses: 1,
      last_result: 'failed',
      updated_at: '2026-06-10T00:00:00.000Z',
    });
    await db.put('story_progress', {
      id: `${playerId}_ch1_apprentice_arrives`,
      player_id: playerId,
      chapter_id: 'ch1_apprentice_arrives',
      status: 'completed',
      completed_at: '2026-06-10T00:00:00.000Z',
      updated_at: '2026-06-10T00:00:00.000Z',
    });
    await db.put('achievements', {
      id: 'frontend-achievement',
      player_id: playerId,
      achievement_id: 'first_review',
      title: 'First Review',
      description: 'Completed a local review.',
      earned_at: '2026-06-10T00:00:00.000Z',
    });
    const playerStore = await import('/src/state/playerStore.ts');
    await playerStore.usePlayerStore.getState().setActivePlayer(playerId);
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
      motif_tags: ['pin'],
      is_turning_point: false,
      retry_available: true,
      explanation: 'Fixture review move.',
      evidence: ['Normalized CP loss: 8.'],
      best_move: 'e2e4',
    },
  ];
  return {
    id: 'frontend-review',
    player_id: playerId,
    source_type: 'local_match',
    source_id: 'frontend-local',
    created_at: '2026-06-10T00:10:00.000Z',
    engine_name: 'Stockfish',
    total_moves: 1,
    reviewed_side: 'both',
    accuracy_white: 96,
    accuracy_black: 0,
    average_cp_loss_white: 8,
    average_cp_loss_black: 0,
    result: 'draw',
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
    recommended_actions: [
      {
        id: 'train-pin',
        title: 'Train pins',
        description: 'Review the pin motif from this game.',
        route: '/clue-chess?mode=adaptive&motif=pin',
        evidence: ['pin motif in review fixture'],
      },
    ],
  };
}

function startDevServer() {
  // Invoke Vite's JS entry via the current Node binary: spawning npm.cmd with
  // shell:false throws EINVAL on modern Node/Windows.
  const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', HOST, '--port', String(PORT)], {
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

function stopProcessTree(child) {
  if (!child?.pid) return;
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore', shell: false });
    return;
  }
  child.kill();
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
