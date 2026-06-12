/**
 * Board interaction stability check (M-MIRROR-FULL-FRONTEND-3D-BATTLEFIELD-
 * EXPECTATION-LOOP-1).
 *
 * Drives the REAL 2D board in a browser and asserts the interaction layer is
 * stable: click-to-move works, drag-and-drop works, every piece stays inside
 * the board frame after moves/animations settle, no duplicate or floating
 * pieces, selection state clears after a move, and the 3D mode (when WebGL is
 * available) selects and moves through the same legal pipeline.
 */
import puppeteer from 'puppeteer';
import { spawn } from 'node:child_process';
import path from 'node:path';

const PORT = 5175;
const HOST = '127.0.0.1';
const BASE_URL = `http://${HOST}:${PORT}`;
const failures = [];

let server = null;
let browser = null;

try {
  if (!(await isServerReachable())) {
    server = startDevServer();
    await waitForServer();
  }
  browser = await puppeteer.launch({ headless: 'new', args: ['--enable-unsafe-swiftshader'] });
  const page = await browser.newPage();
  page.on('pageerror', (e) => failures.push(`pageerror: ${e.message}`));
  await page.setViewport({ width: 1366, height: 768 });

  // ---- 2D board ----
  await page.goto(`${BASE_URL}/play?stockfishBootCheck=1`, { waitUntil: 'networkidle0', timeout: 60000 });
  await page.waitForFunction(() => Boolean(window.__MIRROR_PLAY_TEST__), { timeout: 15000 });
  await page.evaluate(() => {
    localStorage.setItem('mirror-board-render-mode', '2d');
    window.__MIRROR_PLAY_TEST__.startGame('white', 'Casual');
  });
  await sleep(1200);

  const boardReady = await page.waitForSelector('[data-square="e2"]', { timeout: 10000 }).catch(() => null);
  if (!boardReady) {
    failures.push('2D board squares did not render');
  } else {
    // Click-to-move: e2 -> e4.
    await clickSquare(page, 'e2');
    await sleep(150);
    await clickSquare(page, 'e4');
    await sleep(600);
    const engineRepliedAfterClick = await page
      .waitForFunction(
        () => {
          const state = window.__MIRROR_PLAY_TEST__.getState();
          return !state.engineThinking && state.history.length >= 2;
        },
        { timeout: 30000 }
      )
      .then(() => true)
      .catch(() => false);
    const afterClickMove = await boardState(page);
    if (!afterClickMove.historyStartsE4) failures.push(`click-to-move failed (history: ${afterClickMove.history})`);
    if (!engineRepliedAfterClick) {
      failures.push(`engine did not reply before drag phase (history: ${afterClickMove.history})`);
    }
    if (afterClickMove.pieceCount !== 32) failures.push(`piece count after opening moves is ${afterClickMove.pieceCount}, expected 32`);
    if (afterClickMove.escaped > 0) failures.push(`${afterClickMove.escaped} piece(s) rendered outside the board frame`);
    if (afterClickMove.duplicates.length > 0) failures.push(`duplicate piece on square(s): ${afterClickMove.duplicates.join(', ')}`);

    // Drag-and-drop: d2 -> d4 (mouse press, move, release).
    const dragOk = await dragMove(page, 'd2', 'd4');
    await sleep(2500);
    const afterDrag = await boardState(page);
    if (!dragOk || afterDrag.history.length < 3) {
      failures.push(`drag-and-drop move did not register (history: ${afterDrag.history})`);
    }
    if (afterDrag.escaped > 0) failures.push(`after drag: ${afterDrag.escaped} piece(s) outside the board frame`);
    if (afterDrag.duplicates.length > 0) failures.push(`after drag: duplicate piece on ${afterDrag.duplicates.join(', ')}`);

    // Engine state sanity: engine must not be stuck thinking forever.
    const settled = await page
      .waitForFunction(() => !window.__MIRROR_PLAY_TEST__.getState().engineThinking, { timeout: 20000 })
      .then(() => true)
      .catch(() => false);
    if (!settled) failures.push('engine stayed in thinking state for >20s');
  }

  // ---- Flipped board (player = black) + Kurukshetra theme: the historical
  // "floating piece" defect lived here (animation/drag transforms vs board
  // size). Legal drag, illegal-drag snapback, and opponent-piece drag must all
  // leave every piece centered on its square with no stray nodes. ----
  await page.evaluate(() => {
    localStorage.setItem(
      'mirror-settings',
      JSON.stringify({ state: { activeTheme: 'mahabharata', audioEnabled: false, audioVolume: 0.5 }, version: 0 })
    );
  });
  await page.reload({ waitUntil: 'networkidle0', timeout: 60000 });
  await page.waitForFunction(() => Boolean(window.__MIRROR_PLAY_TEST__), { timeout: 15000 });
  await page.evaluate(() => window.__MIRROR_PLAY_TEST__.startGame('black', 'Casual'));
  const engineMoved = await page
    .waitForFunction(() => window.__MIRROR_PLAY_TEST__.getState().history.length >= 1, { timeout: 30000 })
    .then(() => true)
    .catch(() => false);
  if (!engineMoved) {
    failures.push('flipped board: engine never made the first move');
  } else {
    await sleep(800);
    await dragMove(page, 'e7', 'e5'); // legal reply
    await sleep(900);
    const flippedState = await flippedBoardState(page);
    if (!flippedState.history.includes('e5')) failures.push(`flipped legal drag failed (history: ${flippedState.history})`);
    await page
      .waitForFunction(() => window.__MIRROR_PLAY_TEST__.getState().history.length >= 3, { timeout: 30000 })
      .catch(() => undefined);
    await sleep(600);
    await dragMove(page, 'a7', 'a3'); // illegal -> snapback
    await sleep(700);
    await dragMove(page, 'b2', 'b3'); // opponent piece -> rejected
    await sleep(700);
    const finalState = await flippedBoardState(page);
    if (finalState.offCenter.length > 0) failures.push(`flipped board: piece(s) off their square: ${finalState.offCenter.join('; ')}`);
    if (finalState.stray > 0) failures.push(`flipped board: ${finalState.stray} stray piece node(s) outside squares`);
    if (finalState.escaped > 0) failures.push(`flipped board: ${finalState.escaped} piece(s) outside the board frame`);
  }
  // restore classic theme for subsequent checks
  await page.evaluate(() => {
    localStorage.setItem(
      'mirror-settings',
      JSON.stringify({ state: { activeTheme: 'standard', audioEnabled: false, audioVolume: 0.5 }, version: 0 })
    );
  });

  // ---- 3D board (same pipeline) ----
  await page.evaluate(() => localStorage.setItem('mirror-board-render-mode', '3d'));
  await page.reload({ waitUntil: 'networkidle0', timeout: 60000 });
  await page.waitForFunction(() => Boolean(window.__MIRROR_PLAY_TEST__), { timeout: 15000 });
  await page.evaluate(() => window.__MIRROR_PLAY_TEST__.startGame('white', 'Casual'));
  const canvas = await page.waitForSelector('[data-qa="battlefield-3d"] canvas', { timeout: 20000 }).catch(() => null);
  const fallback = await page.$('[data-qa="battlefield-fallback"]');
  if (!canvas && !fallback) {
    failures.push('3D mode rendered neither a canvas nor the 2D fallback');
  } else if (canvas) {
    await sleep(2500);
    const hook = await page.evaluate(async () => {
      if (!window.__BATTLEFIELD_TEST__) return null;
      window.__BATTLEFIELD_TEST__.clickSquare('e2');
      await new Promise((r) => setTimeout(r, 100));
      const selected = window.__BATTLEFIELD_TEST__.selected();
      window.__BATTLEFIELD_TEST__.clickSquare('e4');
      await new Promise((r) => setTimeout(r, 1500));
      return { selected, history: window.__MIRROR_PLAY_TEST__.getState().history };
    });
    if (!hook) failures.push('3D scene test hook missing');
    else {
      if (hook.selected !== 'e2') failures.push(`3D selection failed (selected: ${hook.selected})`);
      if (hook.history[0] !== 'e4') failures.push(`3D move did not flow through the legal pipeline (history: ${hook.history})`);
    }
  }

  report();
} catch (error) {
  failures.push(error instanceof Error ? error.message : String(error));
  report();
} finally {
  if (browser) await browser.close().catch(() => undefined);
  if (server) stopProcessTree(server);
}

function report() {
  if (failures.length > 0) {
    console.error(`\nBoard interaction stability check FAILED (${failures.length}):`);
    for (const f of failures) console.error(`- ${f}`);
    process.exitCode = 1;
  } else {
    console.log('Board interaction stability check passed (2D click, 2D drag, bounds, duplicates, engine state, 3D pipeline).');
  }
}

async function clickSquare(page, square) {
  const el = await page.$(`[data-square="${square}"]`);
  if (!el) throw new Error(`square ${square} not found`);
  await el.click();
}

async function dragMove(page, from, to) {
  const a = await page.$(`[data-square="${from}"]`);
  const b = await page.$(`[data-square="${to}"]`);
  if (!a || !b) return false;
  const ra = await a.boundingBox();
  const rb = await b.boundingBox();
  if (!ra || !rb) return false;
  await page.mouse.move(ra.x + ra.width / 2, ra.y + ra.height / 2);
  await page.mouse.down();
  await page.mouse.move(rb.x + rb.width / 2, rb.y + rb.height / 2, { steps: 12 });
  await sleep(80);
  await page.mouse.up();
  return true;
}

async function boardState(page) {
  return page.evaluate(() => {
    const frame = document.querySelector('.board-frame')?.getBoundingClientRect();
    const pieces = [...document.querySelectorAll('[data-piece]')].filter((p) => p.getBoundingClientRect().width > 0);
    let escaped = 0;
    const seen = new Map();
    const duplicates = [];
    for (const p of pieces) {
      const b = p.getBoundingClientRect();
      if (frame && (b.right < frame.left - 2 || b.left > frame.right + 2 || b.bottom < frame.top - 2 || b.top > frame.bottom + 2)) {
        escaped += 1;
      }
      const square = p.closest('[data-square]')?.dataset.square;
      if (square) {
        if (seen.has(square)) duplicates.push(square);
        seen.set(square, true);
      }
    }
    const state = window.__MIRROR_PLAY_TEST__.getState();
    return {
      pieceCount: pieces.length,
      escaped,
      duplicates,
      history: state.history,
      historyStartsE4: state.history[0] === 'e4',
    };
  });
}

async function flippedBoardState(page) {
  return page.evaluate(() => {
    const frame = document.querySelector('.board-frame')?.getBoundingClientRect();
    const offCenter = [];
    let stray = 0;
    let escaped = 0;
    for (const p of document.querySelectorAll('[data-piece]')) {
      const b = p.getBoundingClientRect();
      if (b.width === 0) continue;
      const sq = p.closest('[data-square]');
      if (!sq) {
        stray += 1;
        continue;
      }
      const s = sq.getBoundingClientRect();
      const dx = Math.round(b.x + b.width / 2 - (s.x + s.width / 2));
      const dy = Math.round(b.y + b.height / 2 - (s.y + s.height / 2));
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) offCenter.push(`${p.dataset.piece}@${sq.dataset.square}(${dx},${dy})`);
      if (frame && (b.right < frame.left - 2 || b.left > frame.right + 2 || b.bottom < frame.top - 2 || b.top > frame.bottom + 2)) escaped += 1;
    }
    return { offCenter, stray, escaped, history: window.__MIRROR_PLAY_TEST__.getState().history };
  });
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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
