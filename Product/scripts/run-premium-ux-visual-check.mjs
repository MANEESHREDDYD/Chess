import puppeteer from 'puppeteer';
import { spawn } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const PORT = 5173;
const HOST = '127.0.0.1';
const BASE_URL = `http://${HOST}:${PORT}`;
const ARTIFACT_DIR = path.resolve('artifacts/premium-ux-v2');
const SERVER_TIMEOUT_MS = 30000;
const THEMES = [
  { id: 'dark', label: 'Obsidian Command' },
  { id: 'light', label: 'Ivory Battlefield' },
];

const VIEWPORTS = [
  { width: 1440, height: 900, label: '1440x900' },
  { width: 1366, height: 768, label: '1366x768' },
  { width: 1280, height: 720, label: '1280x720' },
  { width: 1024, height: 768, label: '1024x768' },
  { width: 900, height: 768, label: '900x768' },
  { width: 768, height: 1024, label: '768x1024' },
  { width: 390, height: 844, label: '390x844' },
];

const ROUTES = [
  { path: '/play?stockfishBootCheck=1', name: 'play' },
  { path: '/mirror', name: 'mirror' },
  { path: '/story', name: 'story' },
  { path: '/clue-chess?mode=adaptive&motif=pin', name: 'clue-chess' },
  { path: '/analytics', name: 'analytics' },
  { path: '/progress', name: 'profile' },
  { path: '/review/local_match/premium-local', name: 'review' },
  { path: '/import-pgn', name: 'import-pgn' },
  { path: '/coach-preview', name: 'coach-preview' },
  { path: '/stockfish-diagnostics', name: 'stockfish-diagnostics' },
];

async function run() {
  let server = null;
  let browser = null;
  const screenshotIndex = [];

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
    page.on('pageerror', (err) => console.error(`BROWSER ERROR: ${err.message}`));

    await page.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: 60000 });
    await seedPremiumFixture(page);

    const failures = [];
    for (const theme of THEMES) {
      await setUiTheme(page, theme.id);
      for (const viewport of VIEWPORTS) {
        await page.setViewport({ width: viewport.width, height: viewport.height, deviceScaleFactor: 1 });
        for (const route of ROUTES) {
          try {
            const fileName = `${route.name}-${theme.id}-${viewport.label}.png`;
            await verifyRoute(page, route, viewport, fileName, theme.id);
            screenshotIndex.push(fileName);
          } catch (error) {
            failures.push(`${route.name} ${theme.id} ${viewport.label}: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      }
    }

    await writeFile(path.join(ARTIFACT_DIR, 'screenshots.json'), JSON.stringify({
      generated_at: new Date().toISOString(),
      viewports: VIEWPORTS.map((viewport) => viewport.label),
      ui_themes: THEMES,
      routes: ROUTES.map((route) => route.path),
      screenshots: screenshotIndex,
    }, null, 2));

    if (failures.length > 0) {
      throw new Error(`Premium UX visual system check failed:\n${failures.map((entry) => `- ${entry}`).join('\n')}`);
    }

    console.log('Premium UX visual system check passed.');
    console.log(`Screenshots saved to ${ARTIFACT_DIR}`);
  } catch (error) {
    console.error('Premium UX visual system check failed:', error);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close().catch(() => undefined);
    if (server) stopProcessTree(server);
  }
}

async function verifyRoute(page, route, viewport, fileName, uiTheme) {
  await page.goto(`${BASE_URL}${route.path}`, { waitUntil: 'networkidle0', timeout: 60000 });
  if (route.name === 'play') await preparePlayGameOverState(page);

  const screenshotPath = path.join(ARTIFACT_DIR, fileName);
  await page.screenshot({ fullPage: true, path: screenshotPath });

  const common = await page.evaluate(() => {
    const body = document.body;
    const header = rect('.app-header-v2');
    const main = rect('.app-main-v2');
    const nav = rect('.app-nav-v2__primary');
    const boardThemeControl = rect('.app-board-theme__button');
    const audio = rect('.app-toolbar__icon');
    const appearance = rect('.appearance-toggle');
    const hero = rect('.ui-route-hero, .analytics-dashboard__hero, .game-review__header, .page-header');
    const nativeHeaderSelectVisible = Array.from(document.querySelectorAll('.app-header-v2 select')).some((select) => {
      const r = select.getBoundingClientRect();
      const style = getComputedStyle(select);
      return r.width > 4 && r.height > 4 && style.opacity !== '0' && style.visibility !== 'hidden' && style.display !== 'none';
    });
    const rawBlueLinks = Array.from(document.querySelectorAll('main a')).filter((link) => {
      const style = getComputedStyle(link);
      return style.color === 'rgb(0, 0, 238)' || style.textDecorationLine.includes('underline');
    }).map((link) => link.textContent?.trim()).filter(Boolean);
    const unstyledButtons = Array.from(document.querySelectorAll('main button')).filter((button) => {
      const style = getComputedStyle(button);
      const className = button.className?.toString() ?? '';
      const radius = parseFloat(style.borderRadius || '0');
      const bg = style.backgroundColor;
      const hasPremiumClass = /\b(ui-button|btn|ui-mode-tile|game-review__moment|game-review__move)\b/.test(className);
      const hasStyledBackground = style.backgroundImage !== 'none' || (bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent');
      const hasVisibleBorder = style.borderStyle !== 'none' && parseFloat(style.borderWidth || '0') > 0;
      return !hasPremiumClass && (radius < 4 || (!hasStyledBackground && !hasVisibleBorder));
    }).map((button) => button.textContent?.trim()).filter(Boolean);
    return {
      scrollWidth: body.scrollWidth,
      viewportWidth: innerWidth,
      header,
      main,
      nav,
      boardThemeControl,
      audio,
      appearance,
      appearanceOverlapsImportant: appearance
        ? Array.from(document.querySelectorAll('[data-qa="play-controls"], .clue-chess-page__controls'))
            .some((element) => overlapsRect(appearance, element.getBoundingClientRect()))
        : true,
      nativeHeaderSelectVisible,
      hero,
      text: body.textContent ?? '',
      rawBlueLinks,
      unstyledButtons,
      heroContrast: hero ? contrastForElement('.ui-route-hero h1, .analytics-dashboard__hero h1, .game-review__header h1, .page-header h1') : 21,
      shellTheme: document.querySelector('.app-shell-v2')?.getAttribute('data-ui-theme') ?? '',
    };

    function rect(selector) {
      const element = document.querySelector(selector);
      if (!element) return null;
      const r = element.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
    }

    function overlapsRect(a, b) {
      return !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
    }

    function contrastForElement(selector) {
      const element = document.querySelector(selector);
      if (!element) return 21;
      const style = getComputedStyle(element);
      const fg = parseColor(style.color);
      const bg = sampleBg(element);
      if (!fg || !bg) return 21;
      const l1 = luminance(fg);
      const l2 = luminance(bg);
      const lighter = Math.max(l1, l2);
      const darker = Math.min(l1, l2);
      return (lighter + 0.05) / (darker + 0.05);
    }

    function sampleBg(element) {
      let node = element;
      while (node && node instanceof Element) {
        const color = getComputedStyle(node).backgroundColor;
        const parsed = parseColor(color);
        if (parsed && parsed.a > 0.4) return parsed;
        node = node.parentElement;
      }
      return { r: 7, g: 10, b: 18, a: 1 };
    }

    function parseColor(color) {
      const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([.\d]+))?\)/);
      if (!match) return null;
      return {
        r: Number(match[1]),
        g: Number(match[2]),
        b: Number(match[3]),
        a: match[4] ? Number(match[4]) : 1,
      };
    }

    function luminance({ r, g, b }) {
      const channels = [r, g, b].map((value) => {
        const c = value / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    }
  });

  if (common.scrollWidth > common.viewportWidth + 8) {
    throw new Error(`body horizontal overflow: scrollWidth=${common.scrollWidth}, viewport=${common.viewportWidth}`);
  }
  if (!common.header || !common.main) throw new Error('App shell header/main missing.');
  if (common.header.bottom > common.main.top + 2) {
    throw new Error(`header overlaps route content: headerBottom=${common.header.bottom}, mainTop=${common.main.top}`);
  }
  if (!common.nav || common.nav.width < 120) throw new Error('Primary nav is not visible or collapsed unsafely.');
  if (common.shellTheme !== uiTheme) throw new Error(`Expected ${uiTheme} app theme, found ${common.shellTheme || 'none'}.`);
  if (!common.boardThemeControl || common.boardThemeControl.width < 120 || common.boardThemeControl.height < 34) {
    throw new Error('Board theme control is missing or visually broken.');
  }
  if (common.nativeHeaderSelectVisible) throw new Error('Native header select is visibly exposed.');
  if (!common.audio || common.audio.width < 70 || common.audio.height < 30) throw new Error('Audio control is missing or visually broken.');
  if (!common.appearance || common.appearance.width < 72 || common.appearance.height < 34) {
    throw new Error('Bottom-right appearance toggle is missing or visually broken.');
  }
  if (common.appearanceOverlapsImportant) {
    throw new Error('Bottom-right appearance toggle overlaps a board/control/history region.');
  }
  if (common.hero && common.heroContrast < 4.5) {
    throw new Error(`Hero title contrast too low: ${common.heroContrast.toFixed(2)}.`);
  }
  if (common.rawBlueLinks.length > 0 && !route.name.includes('diagnostics')) {
    throw new Error(`Raw/default-looking links found: ${common.rawBlueLinks.slice(0, 3).join(', ')}`);
  }
  if (common.unstyledButtons.length > 0 && !route.name.includes('diagnostics')) {
    throw new Error(`Unstyled/default-looking buttons found: ${common.unstyledButtons.slice(0, 3).join(', ')}`);
  }

  if (route.name === 'play') await verifyPlay(page, viewport);
  if (route.name === 'clue-chess') await verifyClue(page);
  if (route.name === 'story') await verifyStory(page, common.text);
  if (route.name === 'profile') await verifyProfile(page, common.text);
  if (route.name === 'analytics' && !common.text.includes('Recommended next actions')) {
    throw new Error('Analytics recommended actions were not visible.');
  }
  if (route.name === 'import-pgn') await expectVisible(page, '.import-pgn__label textarea', 'PGN textarea');
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
      .map((element) => element.getBoundingClientRect().width);
    return {
      overlaps: {
        boardControls: overlaps(board, controls),
        boardHistory: overlaps(board, history),
        controlsHistory: overlaps(controls, history),
      },
      tableCard,
      tableScroller,
      reviewButtons,
    };

    function rect(selector) {
      const element = document.querySelector(selector);
      if (!element) return null;
      const r = element.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
    }

    function overlaps(a, b) {
      if (!a || !b) return true;
      return !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
    }
  });

  if (layout.overlaps.boardControls) throw new Error('board overlaps controls panel.');
  if (layout.overlaps.boardHistory) throw new Error('board overlaps history/review panel.');
  if (layout.overlaps.controlsHistory) throw new Error('controls panel overlaps history/review panel.');
  if (viewport.width >= 900 && layout.reviewButtons.some((width) => width < 120)) {
    throw new Error('review action collapsed below 120px.');
  }
  if (layout.tableCard && layout.tableScroller) {
    if (layout.tableScroller.left < layout.tableCard.left - 1 || layout.tableScroller.right > layout.tableCard.right + 1) {
      throw new Error('table scroller exceeds match history card bounds.');
    }
  }
}

async function setUiTheme(page, theme) {
  await page.evaluate((nextTheme) => {
    localStorage.setItem('mirror-ui-theme', nextTheme);
    document.documentElement.dataset.mirrorUiTheme = nextTheme;
  }, theme);
}

async function verifyClue(page) {
  await expectVisible(page, '.clue-chess-page__modes .ui-mode-tile', 'Clue mode tiles');
  await expectVisible(page, '.clue-chess-page__board .board-frame', 'Clue board');
  const result = await page.evaluate(() => ({
    tileCount: document.querySelectorAll('.clue-chess-page__modes .ui-mode-tile').length,
    heroText: document.querySelector('.ui-route-hero')?.textContent ?? '',
  }));
  if (result.tileCount < 5) throw new Error(`Expected 5 Clue mode tiles, found ${result.tileCount}.`);
  if (!result.heroText.includes('Train the pattern before the move')) {
    throw new Error('Clue Chess hero did not use premium training command-center language.');
  }
}

async function verifyStory(page, text) {
  await expectVisible(page, '.story-act', 'Story act cards');
  await expectVisible(page, '.story-mission', 'Story mission cards');
  if (!text.includes('Kurukshetra Campaign')) throw new Error('Story hero title missing.');
  if (text.includes('Start Puzzle')) throw new Error('Story landing still uses Start Puzzle wording.');
}

async function verifyProfile(page, text) {
  await expectVisible(page, '.profile-hero', 'Profile hero');
  await expectVisible(page, '.ui-progress-bar, .profile-xp__track', 'Profile XP progress bar');
  if (!/\d+\s*\/\s*\d+\s*XP/.test(text)) throw new Error('/profile XP text did not match "number / number XP".');
}

async function preparePlayGameOverState(page) {
  await page.waitForSelector('.play-layout', { timeout: 10000 });
  await page.waitForFunction(() => !!window.__MIRROR_PLAY_TEST__, { timeout: 10000 });
  await page.evaluate(() => window.__MIRROR_PLAY_TEST__.forceGameOverForLayout('premium-local'));
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

async function seedPremiumFixture(page) {
  const playerId = 'premium-ux-player';
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
      display_name: 'Premium UX Player',
      created_at: '2026-06-10T00:00:00.000Z',
      updated_at: '2026-06-10T00:00:00.000Z',
      current_style_vector_id: 'sv-premium',
      calibration_status: 'complete',
    });
    await db.put('style_vectors', {
      id: 'sv-premium',
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
      id: 'premium-local',
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
      id: 'premium-mirror',
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
      id: 'premium-clue-attempt',
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
      id: 'premium-achievement',
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
    id: 'premium-review',
    player_id: playerId,
    source_type: 'local_match',
    source_id: 'premium-local',
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
      opening: { phase: 'opening', moves: 1, average_cp_loss: 8, blunder_count: 0, mistake_count: 0, inaccuracy_count: 0, summary: 'Opening reviewed.' },
      middlegame: { phase: 'middlegame', moves: 0, average_cp_loss: 0, blunder_count: 0, mistake_count: 0, inaccuracy_count: 0, summary: 'No middlegame moves.' },
      endgame: { phase: 'endgame', moves: 0, average_cp_loss: 0, blunder_count: 0, mistake_count: 0, inaccuracy_count: 0, summary: 'No endgame moves.' },
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
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(child.pid), '/f', '/t']);
  } else {
    child.kill('SIGTERM');
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

await run();
