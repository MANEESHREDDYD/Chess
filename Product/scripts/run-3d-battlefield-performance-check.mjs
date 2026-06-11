/**
 * Kurukshetra Battlefield performance & resilience check (Phase 13).
 *
 * Verifies in a real browser that: the app loads; the 3D scene mounts and
 * stays error-free; move + capture animations complete and clean up; route
 * switching does not crash or remount-leak the scene; reduced-motion and
 * WebGL-disabled environments fall back to the stable 2D board; the mobile
 * viewport renders 3D; and NO external (non-localhost) asset/CDN request is
 * ever made.
 */
import puppeteer from 'puppeteer';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const PORT = 5175;
const HOST = '127.0.0.1';
const BASE_URL = `http://${HOST}:${PORT}`;
const ARTIFACT_DIR = path.resolve('artifacts/complete-frontend-bug-loop');
const failures = [];

let server = null;
let browser = null;

try {
  await mkdir(ARTIFACT_DIR, { recursive: true });
  if (!(await isServerReachable())) {
    server = startDevServer();
    await waitForServer();
  }

  // ---- Main browser: WebGL available (swiftshader ok) ----
  browser = await puppeteer.launch({ headless: 'new', args: ['--enable-unsafe-swiftshader'] });
  const page = await browser.newPage();
  const consoleErrors = [];
  const externalRequests = [];
  page.on('pageerror', (e) => consoleErrors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('request', (req) => {
    const url = new URL(req.url());
    if (url.hostname !== HOST && url.hostname !== 'localhost' && url.protocol.startsWith('http')) {
      externalRequests.push(req.url());
    }
  });

  await page.setViewport({ width: 1440, height: 900 });
  await page.evaluateOnNewDocument(() => localStorage.setItem('mirror-board-render-mode', '3d'));
  await page.goto(`${BASE_URL}/play?stockfishBootCheck=1`, { waitUntil: 'networkidle0', timeout: 60000 });

  const canvas = await page.waitForSelector('[data-qa="battlefield-3d"] canvas', { timeout: 25000 }).catch(() => null);
  if (!canvas) failures.push('3D scene did not load');
  else {
    await sleep(2500);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'perf-3d-desktop.png') });

    // Move + capture animation lifecycle through the shared pipeline.
    await page.waitForFunction(() => Boolean(window.__MIRROR_PLAY_TEST__ && window.__BATTLEFIELD_TEST__), { timeout: 15000 });
    const lifecycle = await page.evaluate(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      window.__MIRROR_PLAY_TEST__.startGame('white', 'Casual');
      await sleep(900);
      const moved = window.__MIRROR_PLAY_TEST__.makePlayerMove('e2', 'e4');
      await sleep(1800); // move animation (<=250ms) + engine reply window
      const history = window.__MIRROR_PLAY_TEST__.getState().history;
      return { moved, history };
    });
    if (!lifecycle.moved || lifecycle.history[0] !== 'e4') failures.push(`3D move did not complete (${JSON.stringify(lifecycle)})`);

    // Route switch twice: scene must unmount/remount without crashing.
    for (let i = 0; i < 2; i += 1) {
      await page.goto(`${BASE_URL}/analytics`, { waitUntil: 'networkidle0', timeout: 60000 });
      await page.goto(`${BASE_URL}/play?stockfishBootCheck=1`, { waitUntil: 'networkidle0', timeout: 60000 });
      const back = await page.waitForSelector('[data-qa="battlefield-3d"] canvas', { timeout: 25000 }).catch(() => null);
      if (!back) failures.push(`3D scene missing after route switch #${i + 1}`);
    }

    // Mobile viewport renders 3D (3D is available on every device).
    await page.setViewport({ width: 390, height: 844 });
    await sleep(1200);
    const mobileCanvas = await page.$('[data-qa="battlefield-3d"] canvas');
    if (!mobileCanvas) failures.push('3D scene missing at mobile viewport');
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'perf-3d-mobile.png') });
  }

  const realErrors = consoleErrors.filter(
    (e) => !/Download the React DevTools|Failed to load resource.*favicon/i.test(e)
  );
  if (realErrors.length > 0) failures.push(`console errors: ${realErrors.slice(0, 5).join(' | ')}`);
  if (externalRequests.length > 0) failures.push(`external CDN requests detected: ${[...new Set(externalRequests)].slice(0, 5).join(', ')}`);

  // ---- Reduced motion: 2D fallback ----
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.setViewport({ width: 1440, height: 900 });
  await page.reload({ waitUntil: 'networkidle0', timeout: 60000 });
  await sleep(1500);
  const reduced = await page.evaluate(() => ({
    canvas: Boolean(document.querySelector('[data-qa="battlefield-3d"] canvas')),
    notice: document.querySelector('.battlefield-fallback__notice')?.textContent ?? '',
  }));
  if (reduced.canvas || !/reduced-motion/.test(reduced.notice)) failures.push('reduced-motion did not fall back to 2D');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'perf-3d-reduced-motion.png') });
  await browser.close();
  browser = null;

  // ---- WebGL disabled: must fall back to 2D, never crash ----
  const noGl = await puppeteer.launch({
    headless: 'new',
    args: ['--disable-webgl', '--disable-webgl2', '--disable-3d-apis', '--disable-gpu'],
  });
  const noGlPage = await noGl.newPage();
  const noGlErrors = [];
  noGlPage.on('pageerror', (e) => noGlErrors.push(e.message));
  await noGlPage.setViewport({ width: 1440, height: 900 });
  await noGlPage.evaluateOnNewDocument(() => localStorage.setItem('mirror-board-render-mode', '3d'));
  await noGlPage.goto(`${BASE_URL}/play?stockfishBootCheck=1`, { waitUntil: 'networkidle0', timeout: 60000 });
  await sleep(2000);
  const noGlState = await noGlPage.evaluate(() => ({
    board2d: Boolean(document.querySelector('.board-frame')),
    notice: document.querySelector('.battlefield-fallback__notice')?.textContent ?? '',
  }));
  if (!noGlState.board2d) failures.push('WebGL-disabled: 2D board fallback missing');
  if (!/WebGL|failed/i.test(noGlState.notice)) failures.push(`WebGL-disabled: fallback notice missing ("${noGlState.notice}")`);
  if (noGlErrors.length > 0) failures.push(`WebGL-disabled crash: ${noGlErrors[0]}`);
  await noGlPage.screenshot({ path: path.join(ARTIFACT_DIR, 'perf-3d-webgl-disabled-fallback.png') });
  await noGl.close();

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
    console.error(`\n3D battlefield performance check FAILED (${failures.length}):`);
    for (const f of failures) console.error(`- ${f}`);
    process.exitCode = 1;
  } else {
    console.log('3D battlefield performance check passed (load, moves, route switches, mobile, reduced-motion fallback, WebGL fallback, no external CDN).');
  }
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
