/**
 * M-WORLD-CLASS-COLOR-UX-SYSTEM-1 — MIRROR Signal color/UX screenshot + QA check.
 *
 * Captures every primary route across the required viewport matrix in BOTH the
 * Signal Dark and Signal Light appearance themes, plus the open More menu, open
 * Board Theme menu and the bottom appearance toggle. Runs the Phase-12
 * automated checks (no native header select, menus open, Board Theme changes
 * state, theme root switches, no horizontal overflow, header does not cover
 * content, no raw default links/buttons in primary routes).
 *
 * Artifacts: Product/artifacts/world-class-color-ux/
 */
import puppeteer from 'puppeteer';
import { spawn } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

const PORT = 5175;
const HOST = '127.0.0.1';
const BASE_URL = `http://${HOST}:${PORT}`;
const ARTIFACT_DIR = path.resolve('artifacts/world-class-color-ux');
const SERVER_TIMEOUT_MS = 30000;

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
  { path: '/review/local_match/frontend-local', name: 'review' },
  { path: '/import-pgn', name: 'import-pgn' },
  { path: '/coach-preview', name: 'coach-preview' },
  { path: '/stockfish-diagnostics', name: 'stockfish-diagnostics' },
];

const THEMES = ['dark', 'light'];

async function run() {
  let server = null;
  let browser = null;
  const failures = [];

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
    await seedFixture(page);

    // ---- Full route x theme x viewport screenshot sweep ----
    for (const theme of THEMES) {
      await setTheme(page, theme);
      for (const viewport of VIEWPORTS) {
        await page.setViewport({ width: viewport.width, height: viewport.height, deviceScaleFactor: 1 });
        for (const route of ROUTES) {
          try {
            await captureRoute(page, route, viewport, theme, failures);
          } catch (error) {
            failures.push(`${route.name} ${theme} ${viewport.label}: ${msg(error)}`);
          }
        }
      }
    }

    // ---- Interaction checks + open-menu captures (desktop) ----
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    for (const theme of THEMES) {
      await setTheme(page, theme);
      await page.goto(`${BASE_URL}/play?stockfishBootCheck=1`, { waitUntil: 'networkidle0', timeout: 60000 });
      await runInteractionChecks(page, theme, failures);
    }

    if (failures.length > 0) {
      console.error(`\nCalm premium UI check found ${failures.length} issue(s):`);
      for (const f of failures) console.error(`- ${f}`);
      throw new Error(`${failures.length} calm-premium-ui check failure(s).`);
    }

    console.log('\nCalm premium UI check passed.');
    console.log(`Screenshots saved to ${ARTIFACT_DIR}`);
  } catch (error) {
    console.error('Calm premium UI check failed:', msg(error));
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close().catch(() => undefined);
    if (server) stopProcessTree(server);
  }
}

async function setTheme(page, theme) {
  await page.evaluate((t) => {
    localStorage.setItem('mirror-ui-theme', t);
  }, theme);
  await page.reload({ waitUntil: 'networkidle0', timeout: 60000 });
  const root = await page.evaluate(() => document.documentElement.dataset.uiTheme);
  if (root !== theme) throw new Error(`root data-ui-theme is "${root}", expected "${theme}"`);
}

async function captureRoute(page, route, viewport, theme, failures) {
  await page.goto(`${BASE_URL}${route.path}`, { waitUntil: 'networkidle0', timeout: 60000 });
  if (route.name === 'play') await preparePlay(page);
  await page.screenshot({
    fullPage: true,
    path: path.join(ARTIFACT_DIR, `${route.name}-${theme}-${viewport.label}.png`),
  });

  const probe = await page.evaluate(() => {
    const body = document.body;
    const header = document.querySelector('.nova-header')?.getBoundingClientRect();
    const main = document.querySelector('.nova-main')?.getBoundingClientRect();
    const nativeSelect = document.querySelector('.nova-header select');
    // Raw default links/buttons inside route content: an <a>/<button> with the
    // browser default blue + underline and no app class is a prototype smell.
    const mainEl = document.querySelector('.nova-main');
    let rawLink = false;
    let rawButton = false;
    if (mainEl) {
      for (const a of mainEl.querySelectorAll('a')) {
        const s = getComputedStyle(a);
        if (s.textDecorationLine.includes('underline') && (s.color === 'rgb(0, 0, 238)' || s.color === 'rgb(0, 0, 255)')) {
          rawLink = true;
          break;
        }
      }
      for (const b of mainEl.querySelectorAll('button')) {
        if (b.className && (b.className.includes('ui-button') || b.className.includes('nova-') || b.className.includes('appearance'))) continue;
        const s = getComputedStyle(b);
        // Unstyled native buttons fall back to the OS button-face background.
        if (s.backgroundColor === 'buttonface' || s.backgroundColor === 'rgb(239, 239, 239)') {
          rawButton = true;
          break;
        }
      }
    }
    return {
      scrollWidth: body.scrollWidth,
      viewportWidth: window.innerWidth,
      headerBottom: header?.bottom ?? 0,
      mainTop: main?.top ?? Number.MAX_SAFE_INTEGER,
      hasNativeHeaderSelect: !!nativeSelect,
      rawLink,
      rawButton,
    };
  });

  const primaryRoutes = ['play', 'mirror', 'story', 'clue-chess', 'analytics', 'profile', 'review'];
  if (probe.scrollWidth > probe.viewportWidth + 8) {
    failures.push(`${route.name} ${theme} ${viewport.label}: horizontal overflow (${probe.scrollWidth} > ${probe.viewportWidth})`);
  }
  if (probe.headerBottom > probe.mainTop + 2) {
    failures.push(`${route.name} ${theme} ${viewport.label}: header overlaps content`);
  }
  if (probe.hasNativeHeaderSelect) {
    failures.push(`${route.name} ${theme} ${viewport.label}: native <select> present in app header`);
  }
  if (primaryRoutes.includes(route.name) && probe.rawLink) {
    failures.push(`${route.name} ${theme} ${viewport.label}: raw default blue link in primary route`);
  }
  if (primaryRoutes.includes(route.name) && probe.rawButton) {
    failures.push(`${route.name} ${theme} ${viewport.label}: raw default browser button in primary route`);
  }
}

async function runInteractionChecks(page, theme, failures) {
  // No native select anywhere in the header shell.
  const nativeSelect = await page.$('.nova-header select');
  if (nativeSelect) failures.push(`header has native select (${theme})`);

  // More menu opens, then closes on Escape.
  const moreTrigger = await page.$('.nova-trigger--more');
  if (!moreTrigger) {
    failures.push(`More trigger missing (${theme})`);
  } else {
    await moreTrigger.click();
    await delay(160);
    const moreOpen = await page.$('.nova-popover__panel [role="menuitem"], .nova-menu-item');
    if (!moreOpen) failures.push(`More menu did not open (${theme})`);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, `menu-more-open-${theme}.png`) });
    await page.keyboard.press('Escape');
    await delay(160);
    const stillOpen = await page.$('.nova-popover__panel .nova-menu-item');
    if (stillOpen) failures.push(`More menu did not close on Escape (${theme})`);
  }

  // Board Theme opens and selection changes state (header value updates).
  const boardTrigger = await page.$('.nova-trigger--board');
  if (!boardTrigger) {
    failures.push(`Board Theme trigger missing (${theme})`);
  } else {
    await boardTrigger.click();
    await delay(160);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, `menu-board-theme-open-${theme}.png`) });
    const before = await readBoardThemeValue(page);
    const options = await page.$$('.nova-popover__panel [role="option"]');
    const target = await pickOtherOption(page, options, before);
    if (target) {
      await target.click();
      await delay(200);
      const after = await readBoardThemeValue(page);
      if (after === before) failures.push(`Board Theme value did not change after selection (${theme})`);
    } else {
      failures.push(`Board Theme had no alternate option (${theme})`);
    }
  }

  // Appearance toggle visible + present.
  const appearance = await page.$('.nova-appearance');
  if (!appearance) failures.push(`appearance toggle missing (${theme})`);
}

async function readBoardThemeValue(page) {
  return page.evaluate(() => document.querySelector('[data-board-theme-value]')?.textContent?.trim() ?? '');
}

async function pickOtherOption(page, options, currentLabel) {
  for (const option of options) {
    const label = await page.evaluate((el) => el.textContent ?? '', option);
    if (!label.includes(currentLabel) || currentLabel === '') {
      if (!label.includes(currentLabel)) return option;
    }
  }
  // fallback: return the last option (the non-default one)
  return options.length ? options[options.length - 1] : null;
}

async function preparePlay(page) {
  try {
    await page.waitForSelector('.play-layout', { timeout: 8000 });
    await page.waitForFunction(() => !!window.__MIRROR_PLAY_TEST__, { timeout: 8000 });
    await page.evaluate(() => window.__MIRROR_PLAY_TEST__.forceGameOverForLayout('frontend-local'));
    await delay(250);
  } catch {
    /* play harness not ready in this state — board still captured */
  }
}

async function seedFixture(page) {
  const playerId = 'calm-premium-player';
  await page.evaluate(async ({ playerId: seededId }) => {
    const dbModule = await import('/src/data/db.ts');
    await dbModule.deleteMirrorDb();
    const db = await dbModule.openMirrorDb();
    localStorage.setItem('mirror_active_player_id', seededId);
    localStorage.setItem(
      'mirror-settings',
      JSON.stringify({ state: { activeTheme: 'standard', audioEnabled: false, audioVolume: 0.5 }, version: 0 })
    );
    await db.put('players', {
      id: seededId,
      display_name: 'Calm Premium Player',
      created_at: '2026-06-10T00:00:00.000Z',
      updated_at: '2026-06-10T00:00:00.000Z',
      current_style_vector_id: 'sv-calm',
      calibration_status: 'complete',
    });
    await db.put('style_vectors', {
      id: 'sv-calm',
      player_id: seededId,
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
      player_id: seededId,
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
    await db.put('story_progress', {
      id: `${seededId}_ch1_apprentice_arrives`,
      player_id: seededId,
      chapter_id: 'ch1_apprentice_arrives',
      status: 'completed',
      completed_at: '2026-06-10T00:00:00.000Z',
      updated_at: '2026-06-10T00:00:00.000Z',
    });
    await db.put('achievements', {
      id: 'calm-achievement',
      player_id: seededId,
      achievement_id: 'first_review',
      title: 'First Review',
      description: 'Completed a local review.',
      earned_at: '2026-06-10T00:00:00.000Z',
    });
    await db.put('game_reviews', {
      id: 'frontend-review',
      player_id: seededId,
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
        opening: { phase: 'opening', moves: 1, average_cp_loss: 8, blunder_count: 0, mistake_count: 0, inaccuracy_count: 0, summary: 'Opening reviewed.' },
        middlegame: { phase: 'middlegame', moves: 0, average_cp_loss: 0, blunder_count: 0, mistake_count: 0, inaccuracy_count: 0, summary: 'No middlegame moves.' },
        endgame: { phase: 'endgame', moves: 0, average_cp_loss: 0, blunder_count: 0, mistake_count: 0, inaccuracy_count: 0, summary: 'No endgame moves.' },
        weakest_phase: 'opening',
        summary: 'Fixture opening review.',
      },
      key_moments: [],
      move_reviews: [
        {
          ply: 1, move_number: 1, san: 'e4',
          fen_before: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
          fen_after: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
          side: 'white', cp_loss: 8, classification: 'best', phase: 'opening',
          motif_tags: ['pin'], is_turning_point: false, retry_available: true,
          explanation: 'Fixture review move.', evidence: ['Normalized CP loss: 8.'], best_move: 'e2e4',
        },
      ],
      personalized_summary: { headline: 'Fixture review ready.', notes: ['StyleVector fixture evidence is present.'], evidence: ['fixture'], insufficient_data: [] },
      recommended_actions: [
        { id: 'train-pin', title: 'Train pins', description: 'Review the pin motif from this game.', route: '/clue-chess?mode=adaptive&motif=pin', evidence: ['pin motif in review fixture'] },
      ],
    });
    const playerStore = await import('/src/state/playerStore.ts');
    await playerStore.usePlayerStore.getState().setActivePlayer(seededId);
  }, { playerId });
}

function startDevServer() {
  // Invoke Vite's JS entry through the current Node binary. Spawning npm.cmd
  // with shell:false throws EINVAL on modern Node/Windows, so we avoid it.
  const viteBin = path.resolve('node_modules/vite/bin/vite.js');
  const server = spawn(process.execPath, [viteBin, '--host', HOST, '--port', String(PORT)], { stdio: 'pipe', shell: false });
  server.stdout.on('data', (chunk) => process.stdout.write(String(chunk)));
  server.stderr.on('data', (chunk) => process.stderr.write(String(chunk)));
  return server;
}

async function waitForServerBoot(server) {
  let exitError = null;
  server.on('exit', (code) => { exitError = new Error(`Dev server exited before ready (code ${code}).`); });
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

function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function msg(error) { return error instanceof Error ? error.message : String(error); }

run().catch((error) => { console.error(error); process.exit(1); });
