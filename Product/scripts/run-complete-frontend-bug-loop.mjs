/**
 * Complete frontend bug-find loop (M-MIRROR-FULL-FRONTEND-3D-BATTLEFIELD-
 * EXPECTATION-LOOP-1, Phase 9).
 *
 * Boots the app, seeds a deterministic profile, sweeps every primary route in
 * BOTH themes across the full viewport matrix, exercises every header control
 * (More, Board Theme, Audio, Appearance, 2D/3D), drives the board, and fails
 * on the documented defect list: cropped board, escaped/duplicate pieces,
 * toggle-over-board, horizontal overflow, header covering content, raw
 * links/buttons/selects, beige/gold shell colors, missing page identities
 * (Story=campaign, Clue=training, Analytics=action, Profile=XP, Review=
 * timeline, Import=flow, Coach=cards, Diagnostics=contained), focus rings,
 * and reduced-motion behavior.
 *
 * Artifacts: Product/artifacts/complete-frontend-bug-loop/
 */
import puppeteer from 'puppeteer';
import { spawn } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

const PORT = 5175;
const HOST = '127.0.0.1';
const BASE_URL = `http://${HOST}:${PORT}`;
const ARTIFACT_DIR = path.resolve('artifacts/complete-frontend-bug-loop');

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
  { path: '/calibration', name: 'calibration' },
  { path: '/about', name: 'about' },
  { path: '/stockfish-diagnostics', name: 'stockfish-diagnostics' },
];

const PRIMARY = ['play', 'mirror', 'story', 'clue-chess', 'analytics', 'profile', 'review'];
const THEMES = ['dark', 'light'];

const failures = [];
let server = null;
let browser = null;

try {
  await rm(ARTIFACT_DIR, { recursive: true, force: true });
  await mkdir(ARTIFACT_DIR, { recursive: true });

  if (!(await isServerReachable())) {
    console.log('Starting dev server...');
    server = startDevServer();
    await waitForServer();
  }

  browser = await puppeteer.launch({ headless: 'new', args: ['--enable-unsafe-swiftshader'] });
  const page = await browser.newPage();
  page.on('pageerror', (err) => failures.push(`pageerror: ${err.message}`));

  await page.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: 60000 });
  await seedFixture(page);

  // ---- Route x theme x viewport sweep ----
  for (const theme of THEMES) {
    await setTheme(page, theme);
    for (const viewport of VIEWPORTS) {
      await page.setViewport({ width: viewport.width, height: viewport.height, deviceScaleFactor: 1 });
      for (const route of ROUTES) {
        try {
          await checkRoute(page, route, viewport, theme);
        } catch (error) {
          failures.push(`${route.name} ${theme} ${viewport.label}: ${msg(error)}`);
        }
      }
    }
  }

  // ---- Control interactions (desktop, both themes) ----
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  for (const theme of THEMES) {
    await setTheme(page, theme);
    await page.goto(`${BASE_URL}/play?stockfishBootCheck=1`, { waitUntil: 'networkidle0', timeout: 60000 });
    await interactionChecks(page, theme);
  }

  // ---- Reduced motion: 3D request must fall back to the 2D board ----
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.evaluate(() => localStorage.setItem('mirror-board-render-mode', '3d'));
  await page.goto(`${BASE_URL}/play?stockfishBootCheck=1`, { waitUntil: 'networkidle0', timeout: 60000 });
  await sleep(1500);
  const rm3d = await page.evaluate(() => ({
    canvas: Boolean(document.querySelector('[data-qa="battlefield-3d"] canvas')),
    notice: document.querySelector('.battlefield-fallback__notice')?.textContent ?? null,
  }));
  if (rm3d.canvas) failures.push('reduced-motion: 3D canvas still rendered (expected 2D fallback)');
  if (!rm3d.notice || !/reduced-motion/.test(rm3d.notice)) failures.push('reduced-motion: fallback notice missing');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'play-3d-reduced-motion-fallback.png') });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
  await page.evaluate(() => localStorage.setItem('mirror-board-render-mode', '2d'));

  report();
} catch (error) {
  failures.push(msg(error));
  report();
} finally {
  if (browser) await browser.close().catch(() => undefined);
  if (server) stopProcessTree(server);
}

/* ------------------------------------------------------------------------- */

async function checkRoute(page, route, viewport, theme) {
  await page.goto(`${BASE_URL}${route.path}`, { waitUntil: 'networkidle0', timeout: 60000 });
  if (route.name === 'play') {
    await page
      .waitForFunction(() => Boolean(window.__MIRROR_PLAY_TEST__), { timeout: 10000 })
      .catch(() => undefined);
    await sleep(900);
  }

  await page.screenshot({
    fullPage: true,
    path: path.join(ARTIFACT_DIR, `${route.name}-${theme}-${viewport.label}.png`),
  });

  const probe = await page.evaluate((routeName) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const out = { issues: [] };

    // Layout basics
    if (document.body.scrollWidth > vw + 8) out.issues.push(`horizontal overflow (${document.body.scrollWidth} > ${vw})`);
    const header = document.querySelector('.nova-header')?.getBoundingClientRect();
    const main = document.querySelector('.nova-main')?.getBoundingClientRect();
    if (header && main && header.bottom > main.top + 2) out.issues.push('header covers content');
    if (header && header.height > 76) out.issues.push(`header too tall (${Math.round(header.height)}px)`);
    if (document.querySelector('.nova-header select')) out.issues.push('native select in header');

    // Shell must be monochrome (no beige/gold wash)
    const isWarm = (c) => {
      const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (!m) return false;
      const [r, g, b] = [+m[1], +m[2], +m[3]];
      return r > b + 16 && g > b - 6 && r > 120;
    };
    for (const sel of ['body', '.nova-header', '.nova-nav', '.nova-main']) {
      const el = document.querySelector(sel);
      if (el && isWarm(getComputedStyle(el).backgroundColor)) out.issues.push(`beige/warm shell background on ${sel}`);
    }
    for (const btn of document.querySelectorAll('.ui-button--primary, .nova-btn--primary')) {
      if (isWarm(getComputedStyle(btn).backgroundColor)) {
        out.issues.push('gold/warm primary button');
        break;
      }
    }

    // Raw links / default buttons inside route content
    const mainEl = document.querySelector('.nova-main');
    if (mainEl) {
      for (const a of mainEl.querySelectorAll('a')) {
        const s = getComputedStyle(a);
        if (s.textDecorationLine.includes('underline') && (s.color === 'rgb(0, 0, 238)' || s.color === 'rgb(0, 0, 255)')) {
          out.issues.push('raw default blue link');
          break;
        }
      }
      for (const b of mainEl.querySelectorAll('button')) {
        if (b.className && /ui-button|nova-|appearance|battlefield|toggle/.test(b.className)) continue;
        const s = getComputedStyle(b);
        if (s.backgroundColor === 'buttonface' || s.backgroundColor === 'rgb(239, 239, 239)') {
          out.issues.push('raw default browser button');
          break;
        }
      }
    }

    // Board assertions (board routes only)
    const frame = document.querySelector('.board-frame')?.getBoundingClientRect();
    if (frame) {
      if (frame.width < 200) out.issues.push(`board too small (${Math.round(frame.width)}px)`);
      if (frame.left < -2 || frame.right > vw + 2) out.issues.push('board horizontally cropped');
      if (header && frame.top < header.bottom - 2) out.issues.push('board under header');
      let escaped = 0;
      for (const p of document.querySelectorAll('[data-piece]')) {
        const b = p.getBoundingClientRect();
        if (b.width === 0) continue;
        if (b.right < frame.left - 2 || b.left > frame.right + 2 || b.bottom < frame.top - 2 || b.top > frame.bottom + 2) escaped += 1;
      }
      if (escaped > 0) out.issues.push(`${escaped} piece(s) outside board frame`);
      const toggleEl = document.querySelector('.nova-appearance');
      const toggleRect = toggleEl?.getBoundingClientRect();
      if (toggleRect && intersects(toggleRect, frame)) {
        out.issues.push(
          `appearance toggle overlaps board (dodge=${toggleEl.dataset.dodge ?? 'default'} ` +
            `toggle=${Math.round(toggleRect.x)},${Math.round(toggleRect.y)},${Math.round(toggleRect.width)} ` +
            `board=${Math.round(frame.x)},${Math.round(frame.y)},${Math.round(frame.width)}x${Math.round(frame.height)})`
        );
      }
      // Board fully visible above the fold on the reference desktop viewport
      if (routeName === 'play' && vw === 1366 && vh === 768 && frame.bottom > vh + 2) {
        out.issues.push(`board cropped below fold (bottom ${Math.round(frame.bottom)})`);
      }
      const card = document.querySelector('.play-board-card')?.getBoundingClientRect();
      if (routeName === 'play' && card && frame.width < card.width * 0.5) {
        out.issues.push('huge empty board stage (board << its card)');
      }
    } else if (routeName === 'play') {
      const canvas = document.querySelector('[data-qa="battlefield-3d"] canvas');
      if (!canvas) out.issues.push('no board rendered on /play');
    }

    // Page identity checks
    const text = mainEl?.textContent ?? '';
    if (routeName === 'story' && !/Act\s+(I|II|III|1|2|3)|campaign/i.test(text)) out.issues.push('story does not read campaign-first');
    if (routeName === 'story' && /clue/i.test(text.slice(0, 600))) out.issues.push('story leads with clue wording');
    if (routeName === 'clue-chess' && !/adaptive|training|streak|boss/i.test(text)) out.issues.push('clue does not read training-first');
    if (routeName === 'analytics' && !/recommend|next action|train/i.test(text)) out.issues.push('analytics missing recommended action');
    if (routeName === 'profile' && !/XP|level|progress/i.test(text)) out.issues.push('profile missing XP/progress');
    if (routeName === 'review' && !/timeline|move|moment/i.test(text)) out.issues.push('review timeline not visible');
    if (routeName === 'import-pgn' && !(document.querySelector('textarea') || document.querySelector('input[type="file"]'))) {
      out.issues.push('import flow input missing');
    }
    if (routeName === 'coach-preview' && !/coach|evidence/i.test(text)) out.issues.push('coach cards missing');
    if (routeName === 'stockfish-diagnostics') {
      for (const pre of mainEl?.querySelectorAll('pre') ?? []) {
        const r = pre.getBoundingClientRect();
        if (r.width > vw + 8) out.issues.push('diagnostics console overflows');
      }
    }

    function intersects(a, b) {
      return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
    }
    return out;
  }, route.name);

  let issues = probe.issues;
  if (issues.some((i) => i.includes('appearance toggle overlaps board'))) {
    // The dodge re-evaluates on board mount + a 300ms tick; only a STEADY
    // overlap is a defect. Re-probe once after a grace period.
    await sleep(450);
    const recheck = await page.evaluate(() => {
      const frame = document.querySelector('.board-frame')?.getBoundingClientRect();
      const toggleEl = document.querySelector('.nova-appearance');
      const t = toggleEl?.getBoundingClientRect();
      if (!frame || !t) return null;
      const hit = !(t.right < frame.left || t.left > frame.right || t.bottom < frame.top || t.top > frame.bottom);
      return hit
        ? `appearance toggle overlaps board steadily (dodge=${toggleEl.dataset.dodge ?? 'default'})`
        : null;
    });
    issues = issues.filter((i) => !i.includes('appearance toggle overlaps board'));
    if (recheck) issues.push(recheck);
  }
  for (const issue of issues) {
    failures.push(`${route.name} ${theme} ${viewport.label}: ${issue}`);
  }
}

async function interactionChecks(page, theme) {
  // Focus ring on nav — real keyboard Tab so :focus-visible applies.
  await page.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : null));
  let navFocus = 'never-reached';
  for (let i = 0; i < 12; i += 1) {
    await page.keyboard.press('Tab');
    const state = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || !el.classList?.contains('nova-nav__link')) return null;
      const s = getComputedStyle(el);
      return s.boxShadow !== 'none' || s.outlineStyle !== 'none' ? 'ok' : 'invisible';
    });
    if (state) {
      navFocus = state;
      break;
    }
  }
  if (navFocus !== 'ok') failures.push(`nav focus ring ${navFocus} (${theme})`);

  // More menu: open, screenshot, link present, Escape closes
  const more = await page.$('.nova-trigger--more');
  if (!more) failures.push(`More trigger missing (${theme})`);
  else {
    await more.click();
    await sleep(180);
    const item = await page.$('.nova-popover__panel .nova-menu-item');
    if (!item) failures.push(`More menu did not open (${theme})`);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, `menu-more-open-${theme}.png`) });
    const importHref = await page.evaluate(() =>
      document.querySelector('.nova-popover__panel [href="/import-pgn"]') ? true : false
    );
    if (!importHref) failures.push(`More menu missing Import link (${theme})`);
    await page.keyboard.press('Escape');
    await sleep(150);
    if (await page.$('.nova-popover__panel .nova-menu-item')) failures.push(`More did not close on Escape (${theme})`);
  }

  // Board theme: open, change, board updates
  const boardTrigger = await page.$('.nova-trigger--board');
  if (!boardTrigger) failures.push(`Board Theme trigger missing (${theme})`);
  else {
    await boardTrigger.click();
    await sleep(180);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, `menu-board-theme-open-${theme}.png`) });
    const before = await page.evaluate(
      () => document.querySelector('[data-square="a1"]') && getComputedStyle(document.querySelector('[data-square="a1"]')).backgroundColor
    );
    const options = await page.$$('.nova-popover__panel [role="option"]');
    if (options.length < 2) failures.push(`Board Theme options missing (${theme})`);
    else {
      await options[1].click();
      await sleep(700);
      const after = await page.evaluate(
        () => document.querySelector('[data-square="a1"]') && getComputedStyle(document.querySelector('[data-square="a1"]')).backgroundColor
      );
      if (before && after && before === after) failures.push(`Board Theme selection did not change the board (${theme})`);
      // restore classic
      await (await page.$('.nova-trigger--board'))?.click();
      await sleep(150);
      const opts2 = await page.$$('.nova-popover__panel [role="option"]');
      if (opts2[0]) await opts2[0].click();
      await sleep(300);
    }
  }

  // Audio toggle: popover exposes the switch
  const audio = await page.$('.nova-trigger--audio') ?? (await page.$$('.nova-commands .nova-trigger'))[1];
  if (audio) {
    await audio.click();
    await sleep(180);
    const slider = await page.$('.nova-audio-panel, [role="slider"], input[type="range"]');
    if (!slider) failures.push(`Audio popover did not open (${theme})`);
    await page.keyboard.press('Escape');
  }

  // Appearance toggle: single icon button switches the root theme
  const beforeTheme = await page.evaluate(() => document.documentElement.dataset.uiTheme);
  const appearance = await page.$('.nova-appearance');
  if (!appearance) failures.push(`appearance switch missing (${theme})`);
  else {
    const count = await page.evaluate(() => document.querySelectorAll('.nova-appearance, .nova-appearance button').length);
    if (count > 1) failures.push(`appearance switch is not a single button (${theme})`);
    await appearance.click();
    await sleep(300);
    const afterTheme = await page.evaluate(() => document.documentElement.dataset.uiTheme);
    if (afterTheme === beforeTheme) failures.push(`appearance switch did not change theme (${theme})`);
    await appearance.click(); // restore
    await sleep(200);
  }

  // 2D/3D toggle present + 3D mounts (WebGL available in this browser)
  const modeToggle = await page.$('[data-qa="board-mode-toggle"]');
  if (!modeToggle) failures.push(`2D/3D toggle missing (${theme})`);
  else {
    const btn3d = (await page.$$('[data-qa="board-mode-toggle"] button'))[1];
    await btn3d.click();
    const canvas = await page
      .waitForSelector('[data-qa="battlefield-3d"] canvas', { timeout: 20000 })
      .catch(() => null);
    const fallback = await page.$('[data-qa="battlefield-fallback"]');
    if (!canvas && !fallback) failures.push(`3D mode mounted neither canvas nor fallback (${theme})`);
    if (canvas) {
      await sleep(2200);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, `play-3d-${theme}.png`) });
    }
    const btn2d = (await page.$$('[data-qa="board-mode-toggle"] button'))[0];
    await btn2d.click();
    await sleep(400);
  }
}

/* ------------------------------------------------------------------------- */

async function setTheme(page, theme) {
  await page.evaluate((t) => localStorage.setItem('mirror-ui-theme', t), theme);
  await page.reload({ waitUntil: 'networkidle0', timeout: 60000 });
  const root = await page.evaluate(() => document.documentElement.dataset.uiTheme);
  if (root !== theme) throw new Error(`root theme is "${root}", expected "${theme}"`);
}

async function seedFixture(page) {
  const playerId = 'bug-loop-player';
  await page.evaluate(async ({ playerId: seededId }) => {
    const dbModule = await import('/src/data/db.ts');
    await dbModule.deleteMirrorDb();
    const db = await dbModule.openMirrorDb();
    localStorage.setItem('mirror_active_player_id', seededId);
    localStorage.setItem('mirror-board-render-mode', '2d');
    localStorage.setItem(
      'mirror-settings',
      JSON.stringify({ state: { activeTheme: 'standard', audioEnabled: false, audioVolume: 0.5 }, version: 0 })
    );
    await db.put('players', {
      id: seededId,
      display_name: 'Bug Loop Player',
      created_at: '2026-06-11T00:00:00.000Z',
      updated_at: '2026-06-11T00:00:00.000Z',
      current_style_vector_id: 'sv-loop',
      calibration_status: 'complete',
    });
    await db.put('style_vectors', {
      id: 'sv-loop',
      player_id: seededId,
      source: 'calibration',
      computed_at: '2026-06-11T00:00:00.000Z',
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
      created_at: '2026-06-11T00:00:00.000Z',
      completed_at: '2026-06-11T00:08:00.000Z',
    });
    await db.put('story_progress', {
      id: `${seededId}_ch1_apprentice_arrives`,
      player_id: seededId,
      chapter_id: 'ch1_apprentice_arrives',
      status: 'completed',
      completed_at: '2026-06-11T00:00:00.000Z',
      updated_at: '2026-06-11T00:00:00.000Z',
    });
    await db.put('achievements', {
      id: 'loop-achievement',
      player_id: seededId,
      achievement_id: 'first_review',
      title: 'First Review',
      description: 'Completed a local review.',
      earned_at: '2026-06-11T00:00:00.000Z',
    });
    await db.put('game_reviews', {
      id: 'frontend-review',
      player_id: seededId,
      source_type: 'local_match',
      source_id: 'frontend-local',
      created_at: '2026-06-11T00:10:00.000Z',
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
  const viteBin = path.resolve('node_modules/vite/bin/vite.js');
  const child = spawn(process.execPath, [viteBin, '--host', HOST, '--port', String(PORT)], { stdio: 'pipe', shell: false });
  child.stdout.on('data', () => undefined);
  child.stderr.on('data', (c) => process.stderr.write(String(c)));
  return child;
}

async function waitForServer() {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (await isServerReachable()) return;
    await sleep(250);
  }
  throw new Error('dev server did not boot');
}

async function isServerReachable() {
  try {
    return (await fetch(BASE_URL)).ok;
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

function report() {
  if (failures.length > 0) {
    console.error(`\nComplete frontend bug loop found ${failures.length} issue(s):`);
    for (const f of failures) console.error(`- ${f}`);
    process.exitCode = 1;
  } else {
    console.log('\nComplete frontend bug loop passed.');
    console.log(`Screenshots saved to ${ARTIFACT_DIR}`);
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function msg(error) {
  return error instanceof Error ? error.message : String(error);
}
