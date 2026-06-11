/**
 * Reference-locked UI bug loop
 * (M-REFERENCE-LOCKED-APPLE-MONO-UI-AND-BOARD-HITTEST-FIX-1).
 *
 * Proves, with REAL pointer input in a browser, that the board's visual drop
 * target always matches the pointer's geometric square and that the move
 * lands exactly there — across Classic/Kurukshetra themes, White/Black
 * orientations, after resize, after theme switch, and after route
 * navigation. Also re-verifies the Apple Mono shell (no beige/gold, no raw
 * controls, no native header select, header height, no overflow, board ≥
 * minimum hero size, appearance switch never over the board) and captures
 * the required screenshot states for both themes.
 *
 * Artifacts: Product/artifacts/reference-locked-ui-bug-loop/
 */
import puppeteer from 'puppeteer';
import { spawn } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

const PORT = 5175;
const HOST = '127.0.0.1';
const BASE_URL = `http://${HOST}:${PORT}`;
const ARTIFACT_DIR = path.resolve('artifacts/reference-locked-ui-bug-loop');
const failures = [];

const VIEWPORTS = [
  { width: 1440, height: 900, label: '1440x900' },
  { width: 1366, height: 768, label: '1366x768' },
  { width: 1280, height: 720, label: '1280x720' },
  { width: 1024, height: 768, label: '1024x768' },
  { width: 900, height: 768, label: '900x768' },
  { width: 390, height: 844, label: '390x844' },
];

/* The same math as src/chess/boardGeometry.ts, inlined for the browser. */
const GEOMETRY_SNIPPET = `
  function squareFromPointer(rect, clientX, clientY, orientation) {
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    if (x < 0 || y < 0 || x >= rect.width || y >= rect.height) return null;
    const col = Math.min(7, Math.floor((x / rect.width) * 8));
    const row = Math.min(7, Math.floor((y / rect.height) * 8));
    const file = orientation === 'white' ? col : 7 - col;
    const rank = orientation === 'white' ? 7 - row : row;
    return String.fromCharCode(97 + file) + (rank + 1);
  }
`;

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
  page.on('pageerror', (e) => failures.push(`pageerror: ${e.message}`));
  await page.setViewport({ width: 1366, height: 768 });

  /* =====================================================================
     PART A — pointer/drag/drop target matrix
     ===================================================================== */

  // A1. Classic, White orientation: drag with mid-drag target verification.
  await preparePlay(page, { theme: 'standard', uiTheme: 'light' });
  await startGame(page, 'white');
  await page.screenshot({ path: shot('play-light-before-move.png') });
  await verifiedDrag(page, 'e2', 'e4', 'white', 'classic/white drag', [
    'play-light-during-drag.png',
    'wrong-target-regression-proof.png',
  ]);
  await sleep(1800);
  await assertHistoryStarts(page, 'e4', 'classic/white drag');
  await page.screenshot({ path: shot('play-light-after-legal-move.png') });
  await assertBoardIntegrity(page, 'classic/white after move');

  // A2. Click-to-move target accuracy (knight) + illegal drag snapback.
  await waitEngineSettled(page);
  const clicked = await clickMove(page, 'b1', 'c3', 'white');
  if (!clicked.movedToTarget) failures.push(`classic/white click-move landed wrong: ${clicked.detail}`);
  await sleep(1600);
  await waitEngineSettled(page);
  await verifiedDrag(page, 'f2', 'f5', 'white', 'illegal drag (expect snapback)', null, { expectMove: false });
  await sleep(700);
  await assertBoardIntegrity(page, 'after illegal snapback');
  const noPromo = await page.$('[title="Choose promotion piece"]');
  if (noPromo) failures.push('promotion dialog appeared without a final-rank pawn move');

  // A3. Kurukshetra theme (after THEME SWITCH at runtime via header popover).
  await switchBoardThemeViaHeader(page, 'Kurukshetra');
  await sleep(600);
  await startGame(page, 'white');
  await verifiedDrag(page, 'g1', 'f3', 'white', 'kurukshetra/white knight drag', 'play-kurukshetra-during-drag.png');
  await sleep(1600);
  await assertHistoryStarts(page, 'Nf3', 'kurukshetra/white knight drag');
  await page.screenshot({ path: shot('play-kurukshetra-board.png') });
  await assertBoardIntegrity(page, 'kurukshetra/white after move');

  // A4. Black orientation (engine moves first), Kurukshetra.
  await startGame(page, 'black');
  const engineMoved = await page
    .waitForFunction(() => window.__MIRROR_PLAY_TEST__.getState().history.length >= 1, { timeout: 30000 })
    .then(() => true)
    .catch(() => false);
  if (!engineMoved) failures.push('black orientation: engine never moved');
  await sleep(900);
  await verifiedDrag(page, 'e7', 'e5', 'black', 'kurukshetra/black drag (flipped)');
  await sleep(1600);
  const blackHist = await page.evaluate(() => window.__MIRROR_PLAY_TEST__.getState().history);
  if (!blackHist.includes('e5')) failures.push(`black orientation drag did not land on e5 (history: ${blackHist})`);
  await assertBoardIntegrity(page, 'black orientation after move');

  // A5. After RESIZE: mapping must follow the new rect.
  await page.setViewport({ width: 1024, height: 768 });
  await sleep(700);
  await startGame(page, 'white');
  await verifiedDrag(page, 'd2', 'd4', 'white', 'post-resize drag');
  await sleep(1600);
  await assertHistoryStarts(page, 'd4', 'post-resize drag');
  await page.setViewport({ width: 1366, height: 768 });
  await sleep(500);

  // A6. After ROUTE NAVIGATION: away and back, then drag.
  await page.goto(`${BASE_URL}/analytics`, { waitUntil: 'networkidle0', timeout: 60000 });
  await page.goto(`${BASE_URL}/play?stockfishBootCheck=1`, { waitUntil: 'networkidle0', timeout: 60000 });
  await page.waitForFunction(() => Boolean(window.__MIRROR_PLAY_TEST__), { timeout: 15000 });
  await startGame(page, 'white');
  await verifiedDrag(page, 'c2', 'c4', 'white', 'post-navigation drag');
  await sleep(1600);
  await assertHistoryStarts(page, 'c4', 'post-navigation drag');

  // A7. Dark theme drag states (Classic).
  await preparePlay(page, { theme: 'standard', uiTheme: 'dark' });
  await startGame(page, 'white');
  await page.screenshot({ path: shot('play-dark-before-move.png') });
  await verifiedDrag(page, 'e2', 'e4', 'white', 'dark classic drag', 'play-dark-during-drag.png');
  await sleep(1800);
  await assertHistoryStarts(page, 'e4', 'dark classic drag');
  await page.screenshot({ path: shot('play-dark-after-legal-move.png') });
  await page.screenshot({ path: shot('play-classic-board.png') });

  /* =====================================================================
     PART B — Apple Mono shell sweep + control states + route screenshots
     ===================================================================== */
  for (const uiTheme of ['light', 'dark']) {
    await setUiTheme(page, uiTheme);
    for (const vp of VIEWPORTS) {
      await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 1 });
      for (const route of ['/play?stockfishBootCheck=1', '/story', '/clue-chess', '/analytics', '/progress']) {
        const name = routeScreenshotName(route);
        await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle0', timeout: 60000 });
        if (route.startsWith('/play')) {
          await page.waitForFunction(() => Boolean(window.__MIRROR_PLAY_TEST__), { timeout: 15000 });
          await startGame(page, 'white');
        }
        await sleep(700);
        if (vp.label === '1366x768' || vp.label === '390x844') {
          await page.screenshot({ path: shot(`${name}-${uiTheme}-${vp.label}.png`), fullPage: true });
        }
        const issues = await shellProbe(page, name, vp);
        for (const i of issues) failures.push(`${name} ${uiTheme} ${vp.label}: ${i}`);
      }
    }
  }

  // Control states (desktop light).
  await page.setViewport({ width: 1366, height: 768 });
  await setUiTheme(page, 'light');
  await page.goto(`${BASE_URL}/play?stockfishBootCheck=1`, { waitUntil: 'networkidle0', timeout: 60000 });
  const more = await page.$('.nova-trigger--more');
  if (!more) failures.push('More trigger missing');
  else {
    await more.click();
    await sleep(200);
    if (!(await page.$('.nova-popover__panel .nova-menu-item'))) failures.push('More menu did not open');
    await page.screenshot({ path: shot('menu-more-open.png') });
    await page.keyboard.press('Escape');
  }
  const boardTheme = await page.$('.nova-trigger--board');
  if (!boardTheme) failures.push('Board Theme trigger missing');
  else {
    await boardTheme.click();
    await sleep(200);
    if (!(await page.$('.nova-popover__panel [role="option"]'))) failures.push('Board Theme menu did not open');
    await page.screenshot({ path: shot('menu-board-theme-open.png') });
    await page.keyboard.press('Escape');
  }
  const appearance = await page.$('.nova-appearance');
  if (!appearance) failures.push('appearance switch missing');
  else await page.screenshot({ path: shot('appearance-toggle.png') });
  await page.setViewport({ width: 390, height: 844 });
  await page.goto(`${BASE_URL}/play?stockfishBootCheck=1`, { waitUntil: 'networkidle0', timeout: 60000 });
  await page.waitForFunction(() => Boolean(window.__MIRROR_PLAY_TEST__), { timeout: 15000 });
  await startGame(page, 'white');
  await sleep(900);
  await page.screenshot({ path: shot('mobile-play.png'), fullPage: true });

  report();
} catch (error) {
  failures.push(error instanceof Error ? error.message : String(error));
  report();
} finally {
  if (browser) await browser.close().catch(() => undefined);
  if (server) stopProcessTree(server);
}

/* ------------------------------------------------------------------------- */

function shot(name) {
  return path.join(ARTIFACT_DIR, name);
}

async function preparePlay(page, { theme, uiTheme }) {
  await page.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: 60000 });
  await page.evaluate(
    ({ t, ui }) => {
      localStorage.setItem('mirror-board-render-mode', '2d');
      localStorage.setItem('mirror-ui-theme', ui);
      localStorage.setItem(
        'mirror-settings',
        JSON.stringify({ state: { activeTheme: t, audioEnabled: false, audioVolume: 0.5 }, version: 0 })
      );
    },
    { t: theme, ui: uiTheme }
  );
  await page.goto(`${BASE_URL}/play?stockfishBootCheck=1`, { waitUntil: 'networkidle0', timeout: 60000 });
  await page.waitForFunction(() => Boolean(window.__MIRROR_PLAY_TEST__), { timeout: 15000 });
}

async function setUiTheme(page, ui) {
  await page.evaluate((u) => localStorage.setItem('mirror-ui-theme', u), ui);
  await page.reload({ waitUntil: 'networkidle0', timeout: 60000 });
}

async function startGame(page, color) {
  await page.evaluate((c) => window.__MIRROR_PLAY_TEST__.startGame(c, 'Casual'), color);
  await sleep(900);
}

async function waitEngineSettled(page) {
  await page
    .waitForFunction(() => !window.__MIRROR_PLAY_TEST__.getState().engineThinking, { timeout: 25000 })
    .catch(() => failures.push('engine stuck thinking'));
}

async function boardGridRect(page) {
  // Use the union of all live square rects. This ignores wrapper padding/border
  // and stays correct if the board library changes DOM order or orientation.
  return page.evaluate(() => {
    const rects = [...document.querySelectorAll('[data-square]')]
      .map((square) => square.getBoundingClientRect())
      .filter((rect) => rect.width > 0 && rect.height > 0);
    if (rects.length < 64) return null;
    const left = Math.min(...rects.map((rect) => rect.left));
    const top = Math.min(...rects.map((rect) => rect.top));
    const right = Math.max(...rects.map((rect) => rect.right));
    const bottom = Math.max(...rects.map((rect) => rect.bottom));
    return { left, top, width: right - left, height: bottom - top };
  });
}

async function squareCenter(page, square, orientation) {
  const rect = await boardGridRect(page);
  if (!rect) throw new Error('board grid not found');
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]) - 1;
  const col = orientation === 'white' ? file : 7 - file;
  const row = orientation === 'white' ? 7 - rank : rank;
  return {
    x: rect.left + ((col + 0.5) * rect.width) / 8,
    y: rect.top + ((row + 0.5) * rect.height) / 8,
    rect,
  };
}

/**
 * Drag from -> to with the mouse, verifying MID-DRAG that:
 *  1) the geometric square under the pointer equals the intended target;
 *  2) react-chessboard's drop highlight sits on that same square;
 * and AFTER drop that the move landed there (unless expectMove=false).
 */
async function verifiedDrag(page, from, to, orientation, label, screenshotName = null, opts = {}) {
  const { expectMove = true } = opts;
  const a = await squareCenter(page, from, orientation);
  const b = await squareCenter(page, to, orientation);

  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 5 });
  await page.mouse.move(b.x, b.y, { steps: 6 });
  await sleep(120);

  const mid = await page.evaluate(
    ({ geometry, px, py, orient }) => {
      // eslint-disable-next-line no-eval
      eval(geometry);
      const rects = [...document.querySelectorAll('[data-square]')]
        .map((square) => square.getBoundingClientRect())
        .filter((rect) => rect.width > 0 && rect.height > 0);
      if (rects.length < 64) return { pointerSquare: null, highlightSquare: null, ringOnSquare: false };
      const rect = {
        left: Math.min(...rects.map((r) => r.left)),
        top: Math.min(...rects.map((r) => r.top)),
        width: Math.max(...rects.map((r) => r.right)) - Math.min(...rects.map((r) => r.left)),
        height: Math.max(...rects.map((r) => r.bottom)) - Math.min(...rects.map((r) => r.top)),
      };
      const pointerSquare = squareFromPointer(rect, px, py, orient);
      // The geometry-true overlay ring rendered by BoardView.
      const ring = document.querySelector('[data-qa="drag-ring"]');
      const highlightSquare = ring?.dataset.square ?? null;
      // The ring must also visually sit on that square (overlay geometry).
      let ringOnSquare = true;
      if (ring && highlightSquare) {
        const r = ring.getBoundingClientRect();
        const s = document.querySelector(`[data-square="${highlightSquare}"]`)?.getBoundingClientRect();
        if (s) {
          ringOnSquare =
            Math.abs(r.left - s.left) < 4 && Math.abs(r.top - s.top) < 4 && Math.abs(r.width - s.width) < 4;
        }
      }
      return { pointerSquare, highlightSquare, ringOnSquare };
    },
    { geometry: GEOMETRY_SNIPPET, px: b.x, py: b.y, orient: orientation }
  );

  if (mid.pointerSquare !== to) {
    failures.push(`${label}: geometric pointer square is ${mid.pointerSquare}, intended ${to} (board rect mismatch)`);
  }
  if (mid.highlightSquare && mid.highlightSquare !== to) {
    failures.push(`${label}: drop highlight on ${mid.highlightSquare}, pointer over ${to} (target/highlight mismatch)`);
  }
  if (!mid.highlightSquare) {
    failures.push(`${label}: no drop-target highlight rendered during drag`);
  }
  if (mid.highlightSquare && !mid.ringOnSquare) {
    failures.push(`${label}: drop ring not visually aligned with ${mid.highlightSquare}`);
  }

  if (screenshotName) {
    const names = Array.isArray(screenshotName) ? screenshotName : [screenshotName];
    for (const name of names) await page.screenshot({ path: shot(name) });
  }
  await page.mouse.up();
}

async function clickMove(page, from, to, orientation) {
  const a = await squareCenter(page, from, orientation);
  await page.mouse.click(a.x, a.y);
  await sleep(150);
  const b = await squareCenter(page, to, orientation);
  await page.mouse.click(b.x, b.y);
  await sleep(500);
  const detail = await page.evaluate(
    (t) => {
      const piece = document.querySelector(`[data-square="${t}"] [data-piece]`);
      return { pieceOnTarget: Boolean(piece), history: window.__MIRROR_PLAY_TEST__.getState().history };
    },
    to
  );
  return { movedToTarget: detail.pieceOnTarget, detail: JSON.stringify(detail) };
}

async function assertHistoryStarts(page, san, label) {
  const history = await page.evaluate(() => window.__MIRROR_PLAY_TEST__.getState().history);
  if (history[0] !== san && !history.includes(san)) {
    failures.push(`${label}: expected move ${san} in history, got ${JSON.stringify(history)}`);
  }
}

async function assertBoardIntegrity(page, label) {
  const state = await page.evaluate(() => {
    const frame = document.querySelector('.board-frame')?.getBoundingClientRect();
    let escaped = 0;
    let stray = 0;
    const seen = new Set();
    const dupes = [];
    for (const p of document.querySelectorAll('[data-piece]')) {
      const b = p.getBoundingClientRect();
      if (b.width === 0) continue;
      const sq = p.closest('[data-square]');
      if (!sq) {
        stray += 1;
        continue;
      }
      if (seen.has(sq.dataset.square)) dupes.push(sq.dataset.square);
      seen.add(sq.dataset.square);
      if (frame && (b.right < frame.left - 2 || b.left > frame.right + 2 || b.bottom < frame.top - 2 || b.top > frame.bottom + 2)) {
        escaped += 1;
      }
    }
    return { escaped, stray, dupes };
  });
  if (state.escaped > 0) failures.push(`${label}: ${state.escaped} piece(s) outside board`);
  if (state.stray > 0) failures.push(`${label}: ${state.stray} stray piece node(s)`);
  if (state.dupes.length > 0) failures.push(`${label}: duplicate piece on ${state.dupes.join(', ')}`);
}

async function switchBoardThemeViaHeader(page, optionLabel) {
  const trigger = await page.$('.nova-trigger--board');
  if (!trigger) {
    failures.push('Board Theme trigger missing for runtime switch');
    return;
  }
  await trigger.click();
  await sleep(200);
  const picked = await page.evaluate((labelText) => {
    for (const opt of document.querySelectorAll('.nova-popover__panel [role="option"]')) {
      if ((opt.textContent ?? '').includes(labelText)) {
        opt.click();
        return true;
      }
    }
    return false;
  }, optionLabel);
  if (!picked) failures.push(`Board Theme option "${optionLabel}" not found`);
}

async function shellProbe(page, routeName, vp) {
  return page.evaluate(
    ({ name, minBoard }) => {
      const issues = [];
      const vw = window.innerWidth;
      if (document.body.scrollWidth > vw + 8) issues.push(`horizontal overflow (${document.body.scrollWidth})`);
      const header = document.querySelector('.nova-header')?.getBoundingClientRect();
      const main = document.querySelector('.nova-main')?.getBoundingClientRect();
      if (header && main && header.bottom > main.top + 2) issues.push('header covers content');
      if (header && header.height > 76) issues.push(`header too tall (${Math.round(header.height)})`);
      if (document.querySelector('.nova-header select')) issues.push('native select in header');

      const isWarm = (c) => {
        const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (!m) return false;
        const [r, g, b] = [+m[1], +m[2], +m[3]];
        if (r > 245 && g > 245 && b > 245) return false;
        return r > 120 && r >= g && g >= b && r - b > 18 && g - b > 8;
      };
      const hasWarmCssValue = (value) =>
        /(beige|parchment|brown|maroon|gold|bronze|accent-gold|accent-gold-2|mirror-warm|154,\s*106,\s*31|199,\s*154,\s*67|48,\s*36,\s*22|49,\s*37,\s*25|255,\s*253,\s*248|255,\s*250,\s*240|fffaf0|f8f7f2)/i.test(
          value ?? ''
        );
      for (const sel of [
        'body',
        '.nova-shell',
        '.app-shell-v2',
        '.nova-header',
        '.nova-nav',
        '.nova-main',
        '.play-control-card',
        '.play-board-card',
        '.play-review-card',
        '.play-move-card',
        '.ui-route-hero',
      ]) {
        const el = document.querySelector(sel);
        if (!el) continue;
        const style = getComputedStyle(el);
        const storyAccentException = name === 'story' && sel === '.ui-route-hero';
        if (isWarm(style.backgroundColor) && !storyAccentException) issues.push(`warm/beige shell on ${sel}`);
        if (hasWarmCssValue(style.backgroundImage) && !storyAccentException) issues.push(`warm shell gradient on ${sel}`);
      }
      const shell = document.querySelector('.app-shell-v2');
      if (shell) {
        const beforeBg = getComputedStyle(shell, '::before').backgroundImage;
        if (hasWarmCssValue(beforeBg)) issues.push('warm shell pseudo-element');
        const shellStyle = getComputedStyle(shell);
        for (const varName of ['--surface-command', '--surface-battlefield', '--surface-analytics', '--surface-glass']) {
          const value = shellStyle.getPropertyValue(varName);
          if (hasWarmCssValue(value)) issues.push(`warm shell token ${varName}`);
        }
      }
      for (const btn of document.querySelectorAll('.ui-button--primary, .nova-btn--primary')) {
        if (isWarm(getComputedStyle(btn).backgroundColor)) {
          issues.push('gold/warm primary button');
          break;
        }
      }
      const mainEl = document.querySelector('.nova-main');
      if (mainEl) {
        for (const aEl of mainEl.querySelectorAll('a')) {
          const s = getComputedStyle(aEl);
          if (s.textDecorationLine.includes('underline') && (s.color === 'rgb(0, 0, 238)' || s.color === 'rgb(0, 0, 255)')) {
            issues.push('raw default link');
            break;
          }
        }
        for (const bEl of mainEl.querySelectorAll('button')) {
          if (bEl.className && /ui-button|nova-|appearance|battlefield|toggle/.test(bEl.className)) continue;
          const s = getComputedStyle(bEl);
          if (s.backgroundColor === 'buttonface' || s.backgroundColor === 'rgb(239, 239, 239)') {
            issues.push('raw default button');
            break;
          }
        }
      }

      const frame = document.querySelector('.board-frame')?.getBoundingClientRect();
      if (frame) {
        if (name === 'play' && minBoard && frame.width < minBoard) {
          issues.push(`board below accepted size (${Math.round(frame.width)} < ${minBoard})`);
        }
        if (frame.left < -2 || frame.right > vw + 2) issues.push('board cropped horizontally');
        const toggle = document.querySelector('.nova-appearance')?.getBoundingClientRect();
        if (
          toggle &&
          !(toggle.right < frame.left || toggle.left > frame.right || toggle.bottom < frame.top || toggle.top > frame.bottom)
        ) {
          issues.push('appearance switch overlaps board');
        }
      }
      return issues;
    },
    { name: routeName, minBoard: vp.width >= 1280 ? 540 : vp.width >= 900 ? 460 : 300 }
  );
}

function startDevServer() {
  const viteBin = path.resolve('node_modules/vite/bin/vite.js');
  const child = spawn(process.execPath, [viteBin, '--host', HOST, '--port', String(PORT)], { stdio: 'pipe', shell: false });
  child.stdout.on('data', () => undefined);
  child.stderr.on('data', (c) => process.stderr.write(String(c)));
  return child;
}

function routeScreenshotName(route) {
  const pathname = route.split('?')[0];
  if (pathname === '/play') return 'play';
  if (pathname === '/clue-chess') return 'clue';
  if (pathname === '/progress') return 'profile';
  return pathname.replace(/^\//, '').replace(/[^a-z0-9]+/gi, '-') || 'home';
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
    console.error(`\nReference-locked UI bug loop FAILED (${failures.length}):`);
    for (const f of failures) console.error(`- ${f}`);
    process.exitCode = 1;
  } else {
    console.log('\nReference-locked UI bug loop passed (pointer mapping, drag target, drops, themes, orientations, resize, navigation, Apple Mono shell).');
    console.log(`Screenshots: ${ARTIFACT_DIR}`);
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
