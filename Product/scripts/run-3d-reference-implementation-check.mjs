/**
 * Reference-guided Kurukshetra 3D implementation check.
 *
 * Verifies that the reference-based grounded 3D scene loads, renders nonblank
 * pixels, moves and captures through the shared chess pipeline, captures
 * desktop/mobile screenshots, preserves fallbacks, and makes no external asset requests.
 */
import puppeteer from 'puppeteer';
import { spawn } from 'node:child_process';
import { mkdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { inflateSync } from 'node:zlib';

const PORT = 5176;
const HOST = '127.0.0.1';
const BASE_URL = `http://${HOST}:${PORT}`;
const ARTIFACT_DIR = path.resolve('artifacts/realistic-3d-kurukshetra-visuals');
const failures = [];

let server = null;
let browser = null;

try {
  await mkdir(ARTIFACT_DIR, { recursive: true });
  await assertReferenceTerms();
  await assertProductionGlbFiles();

  if (!(await isServerReachable())) {
    server = startDevServer();
    await waitForServer();
  }

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
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('mirror-board-render-mode', '3d');
    localStorage.setItem(
      'mirror-settings',
      JSON.stringify({ state: { activeTheme: 'mahabharata', audioEnabled: false, audioVolume: 0.5 }, version: 0 })
    );
  });
  await page.goto(`${BASE_URL}/play?stockfishBootCheck=1`, { waitUntil: 'networkidle0', timeout: 60000 });
  await page.waitForSelector('[data-qa="battlefield-3d"] canvas', { timeout: 25000 });
  await page.waitForFunction(() => Boolean(window.__MIRROR_PLAY_TEST__ && window.__BATTLEFIELD_TEST__), { timeout: 15000 });
  const modelStatus = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    for (let i = 0; i < 30; i += 1) {
      const status = window.__BATTLEFIELD_TEST__.modelStatus?.();
      if (status?.checked) return status;
      await sleep(100);
    }
    return window.__BATTLEFIELD_TEST__.modelStatus?.() ?? null;
  });
  if (!modelStatus?.checked) failures.push(`3D model-pack status did not resolve (${JSON.stringify(modelStatus)})`);
  if (modelStatus?.mode !== 'production-glb') {
    failures.push(`3D scene did not load production GLB mode (${JSON.stringify(modelStatus)})`);
  }
  if (modelStatus && modelStatus.mode === 'production-glb' && modelStatus.missing !== 0) {
    failures.push(`production GLB mode has missing models (${JSON.stringify(modelStatus)})`);
  }
  if (modelStatus && modelStatus.mode === 'procedural-fallback' && modelStatus.detected > 0) {
    failures.push(`partial production GLB pack detected; require all 12 models before mixed rendering (${JSON.stringify(modelStatus)})`);
  }
  await page.evaluate(async () => {
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    window.__MIRROR_PLAY_TEST__.startGame('white', 'Casual');
    await sleep(900);
  });
  await sleep(1200);
  await assertStage(page, 'desktop initial');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'reference-3d-desktop-initial.png'), fullPage: true });
  await assertCameraInspectionControls(page);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'reference-3d-camera-pan-zoom.png'), fullPage: true });
  await page.reload({ waitUntil: 'networkidle0', timeout: 60000 });
  await page.waitForSelector('[data-qa="battlefield-3d"] canvas', { timeout: 25000 });
  await page.waitForFunction(() => Boolean(window.__MIRROR_PLAY_TEST__ && window.__BATTLEFIELD_TEST__), { timeout: 15000 });
  await sleep(1200);

  const move = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    window.__MIRROR_PLAY_TEST__.startGame('white', 'Casual');
    await sleep(500);
    window.__BATTLEFIELD_TEST__.clickSquare('e2');
    await sleep(120);
    const selected = window.__BATTLEFIELD_TEST__.selected();
    window.__BATTLEFIELD_TEST__.clickSquare('e4');
    await sleep(1100);
    const state = window.__MIRROR_PLAY_TEST__.getState();
    return { selected, history: state.history, fen: state.fen };
  });
  if (move.selected !== 'e2') failures.push(`3D test hook did not select e2 (${JSON.stringify(move)})`);
  if (move.history[0] !== 'e4') failures.push(`3D legal move did not land as e4 (${JSON.stringify(move)})`);
  await assertStage(page, 'desktop after move');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'reference-3d-desktop-after-e4.png'), fullPage: true });

  await page.waitForFunction(() => !window.__MIRROR_PLAY_TEST__.getState().engineThinking, { timeout: 25000 });
  const capture = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const moved = window.__MIRROR_PLAY_TEST__.makePlayerMove('e4', 'd5');
    await sleep(260);
    const state = window.__MIRROR_PLAY_TEST__.getState();
    return { moved, history: state.history, fen: state.fen };
  });
  if (!capture.moved || !capture.history.some((m) => /xd5/.test(m))) {
    failures.push(`3D capture move e4xd5 failed (${JSON.stringify(capture)})`);
  }
  await assertStage(page, 'desktop capture impact');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'reference-3d-capture-impact.png'), fullPage: true });

  await page.setViewport({ width: 390, height: 844 });
  await sleep(1300);
  await assertStage(page, 'mobile');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'reference-3d-mobile.png'), fullPage: true });

  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.setViewport({ width: 1440, height: 900 });
  await page.reload({ waitUntil: 'networkidle0', timeout: 60000 });
  await sleep(1200);
  const reduced = await page.evaluate(() => ({
    canvas: Boolean(document.querySelector('[data-qa="battlefield-3d"] canvas')),
    notice: document.querySelector('.battlefield-fallback__notice')?.textContent ?? '',
    board2d: Boolean(document.querySelector('.board-frame')),
  }));
  if (reduced.canvas || !reduced.board2d || !/reduced-motion/.test(reduced.notice)) {
    failures.push(`Reduced-motion fallback failed (${JSON.stringify(reduced)})`);
  }
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'reference-3d-reduced-motion-fallback.png'), fullPage: true });

  const realErrors = consoleErrors.filter(
    (e) => !/Download the React DevTools|Failed to load resource.*favicon/i.test(e)
  );
  if (realErrors.length > 0) failures.push(`console errors: ${realErrors.slice(0, 5).join(' | ')}`);
  if (externalRequests.length > 0) failures.push(`external requests detected: ${[...new Set(externalRequests)].slice(0, 5).join(', ')}`);
  await browser.close();
  browser = null;

  const noGl = await puppeteer.launch({
    headless: 'new',
    args: ['--disable-webgl', '--disable-webgl2', '--disable-3d-apis', '--disable-gpu'],
  });
  const noGlPage = await noGl.newPage();
  await noGlPage.setViewport({ width: 1440, height: 900 });
  await noGlPage.evaluateOnNewDocument(() => {
    localStorage.setItem('mirror-board-render-mode', '3d');
    localStorage.setItem(
      'mirror-settings',
      JSON.stringify({ state: { activeTheme: 'mahabharata', audioEnabled: false, audioVolume: 0.5 }, version: 0 })
    );
  });
  await noGlPage.goto(`${BASE_URL}/play?stockfishBootCheck=1`, { waitUntil: 'networkidle0', timeout: 60000 });
  await sleep(1800);
  const noGlState = await noGlPage.evaluate(() => ({
    canvas: Boolean(document.querySelector('[data-qa="battlefield-3d"] canvas')),
    board2d: Boolean(document.querySelector('.board-frame')),
    notice: document.querySelector('.battlefield-fallback__notice')?.textContent ?? '',
  }));
  if (noGlState.canvas || !noGlState.board2d || !/WebGL|failed/i.test(noGlState.notice)) {
    failures.push(`WebGL fallback failed (${JSON.stringify(noGlState)})`);
  }
  await noGlPage.screenshot({ path: path.join(ARTIFACT_DIR, 'reference-3d-webgl-fallback.png'), fullPage: true });
  await noGl.close();

  report();
} catch (error) {
  failures.push(error instanceof Error ? error.message : String(error));
  report();
} finally {
  if (browser) await browser.close().catch(() => undefined);
  if (server) stopProcessTree(server);
}

async function assertReferenceTerms() {
  const [pieces, props, modelSlots, productionReadme, manifest] = await Promise.all([
    readFile(path.resolve('src/three/BattlefieldPiece.tsx'), 'utf8'),
    readFile(path.resolve('src/three/BattlefieldProps.tsx'), 'utf8'),
    readFile(path.resolve('src/three/battlefieldModelSlots.ts'), 'utf8'),
    readFile(path.resolve('public/assets/3d/kurukshetra-production-v1/README.md'), 'utf8'),
    readFile(path.resolve('assets/3d/asset-manifest.json'), 'utf8'),
  ]);
  const combined = `${pieces}\n${props}\n${modelSlots}\n${productionReadme}\n${manifest}`;
  for (const forbidden of ['<sprite', 'spriteMaterial', 'ringMaterials', 'baseGeo']) {
    if (pieces.includes(forbidden)) failures.push(`camera-facing/base-marker implementation still present: ${forbidden}`);
  }
  for (const term of [
    'kurukshetra-realism-v1',
    'pawn-foot-archer.png',
    'knight-horse-archer.png',
    'bishop-advisor-standard.png',
    'rook-war-chariot.png',
    'queen-war-elephant.png',
    'king-royal-commander.png',
    'generated-image',
    'Volumetric board units',
    'not sprites or',
    'kurukshetra-production-v1',
    'pandava-foot-archer.glb',
    'kaurava-war-elephant-commander.glb',
    'production GLB',
    'Blender-generated',
    'WarElephant',
    'DistantFort',
    'BattlefieldAttackCue',
    'archer-arrow-volley',
    'advisor-spear-thrust',
    'chariot-crash-shock',
    'elephant-stomp-impact',
    'commander-sword-arc',
    'moveLiftFor',
    'attackProfileFor',
    'SkeletonUtils.clone',
    'fingernails',
    'toenails',
    'trunk wrinkles',
    'chariot wheel rims',
    'material-correct',
  ]) {
    if (!combined.includes(term)) failures.push(`reference-guided implementation term missing: ${term}`);
  }
}

async function assertProductionGlbFiles() {
  const files = [
    'pandava-foot-archer.glb',
    'kaurava-foot-archer.glb',
    'pandava-horse-archer.glb',
    'kaurava-horse-archer.glb',
    'pandava-advisor-standard-bearer.glb',
    'kaurava-advisor-standard-bearer.glb',
    'pandava-war-chariot.glb',
    'kaurava-war-chariot.glb',
    'pandava-war-elephant-commander.glb',
    'kaurava-war-elephant-commander.glb',
    'pandava-royal-commander.glb',
    'kaurava-royal-commander.glb',
  ];

  await Promise.all(
    files.map(async (file) => {
      const fullPath = path.resolve('public/assets/3d/kurukshetra-production-v1', file);
      try {
        const info = await stat(fullPath);
        if (info.size < 20000) failures.push(`production GLB is unexpectedly small: ${file} (${info.size} bytes)`);
        const animationNames = readGlbAnimationNames(await readFile(fullPath));
        const requiredAnimations = file.includes('royal-commander')
          ? ['idle', 'move', 'attack', 'hit', 'check']
          : ['idle', 'move', 'attack', 'hit'];
        for (const animation of requiredAnimations) {
          if (!animationNames.includes(animation)) {
            failures.push(`production GLB ${file} missing animation clip: ${animation} (${animationNames.join(', ')})`);
          }
        }
      } catch {
        failures.push(`production GLB missing from repo: ${file}`);
      }
    })
  );
}

function readGlbAnimationNames(buffer) {
  if (buffer.toString('ascii', 0, 4) !== 'glTF') {
    throw new Error('not a binary glTF file');
  }
  const jsonLength = buffer.readUInt32LE(12);
  const jsonType = buffer.toString('ascii', 16, 20);
  if (jsonType !== 'JSON') {
    throw new Error(`first GLB chunk is not JSON: ${jsonType}`);
  }
  const gltf = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString('utf8'));
  return (gltf.animations ?? []).map((animation) => animation.name).filter(Boolean);
}

async function assertStage(page, label) {
  const state = await page.evaluate(() => {
    const stage = document.querySelector('[data-qa="battlefield-3d"]');
    const canvas = stage?.querySelector('canvas');
    if (!stage || !canvas) return { exists: false };
    const rect = stage.getBoundingClientRect();
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    return {
      exists: true,
      width: rect.width,
      height: rect.height,
      left: rect.left,
      top: rect.top,
      gl: Boolean(gl),
    };
  });

  if (!state.exists) failures.push(`${label}: 3D stage missing`);
  if (state.exists && (state.width < 300 || state.height < 300)) failures.push(`${label}: stage too small (${state.width}x${state.height})`);
  if (state.exists && !state.gl) failures.push(`${label}: WebGL context unavailable`);
  if (state.exists) {
    const viewport = page.viewport() ?? { width: 1440, height: 900 };
    const clip = {
      x: Math.max(0, state.left),
      y: Math.max(0, state.top),
      width: Math.min(state.width, viewport.width - Math.max(0, state.left)),
      height: Math.min(state.height, viewport.height - Math.max(0, state.top)),
    };
    const png = await page.screenshot({ clip });
    const pixels = analyzePng(png);
    if (pixels.nonBlank < 500) failures.push(`${label}: stage screenshot appears blank (${pixels.nonBlank} nonblank samples)`);
    if (pixels.variation < 200) failures.push(`${label}: stage screenshot has too little visual variation (${pixels.variation})`);
  }
}

async function assertCameraInspectionControls(page) {
  await page.waitForFunction(() => Boolean(window.__BATTLEFIELD_CAMERA_TEST__?.state?.()), { timeout: 10000 });
  const before = await page.evaluate(() => window.__BATTLEFIELD_CAMERA_TEST__.state());
  const rect = await page.evaluate(() => {
    const stage = document.querySelector('[data-qa="battlefield-3d"]');
    const box = stage?.getBoundingClientRect();
    if (!box) return null;
    return { left: box.left, top: box.top, width: box.width, height: box.height };
  });
  if (!rect) {
    failures.push('camera inspection controls: 3D stage missing');
    return;
  }

  await page.mouse.move(rect.left + rect.width * 0.78, rect.top + rect.height * 0.58);
  await page.mouse.wheel({ deltaY: -700 });
  await sleep(500);
  const zoomed = await page.evaluate(() => window.__BATTLEFIELD_CAMERA_TEST__.state());
  if (distance3(before.position, zoomed.position) < 0.1) {
    failures.push(`camera inspection controls: wheel zoom did not move camera (${JSON.stringify({ before, zoomed })})`);
  }

  await page.mouse.move(rect.left + rect.width * 0.55, rect.top + rect.height * 0.55);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(rect.left + rect.width * 0.32, rect.top + rect.height * 0.46, { steps: 10 });
  await page.mouse.up({ button: 'right' });
  await sleep(500);
  const panned = await page.evaluate(() => window.__BATTLEFIELD_CAMERA_TEST__.state());
  if (!zoomed.target || !panned.target || distance3(zoomed.target, panned.target) < 0.05) {
    failures.push(`camera inspection controls: pan did not move orbit target (${JSON.stringify({ zoomed, panned })})`);
  }
}

function distance3(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return 0;
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function analyzePng(buffer) {
  buffer = Buffer.from(buffer);
  if (buffer.toString('ascii', 1, 4) !== 'PNG') throw new Error('Screenshot is not a PNG');
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (type === 'IHDR') {
      width = buffer.readUInt32BE(dataStart);
      height = buffer.readUInt32BE(dataStart + 4);
      bitDepth = buffer[dataStart + 8];
      colorType = buffer[dataStart + 9];
    } else if (type === 'IDAT') {
      idat.push(buffer.subarray(dataStart, dataEnd));
    } else if (type === 'IEND') {
      break;
    }
    offset = dataEnd + 4;
  }

  if (bitDepth !== 8 || ![2, 6].includes(colorType)) {
    throw new Error(`Unsupported PNG format: bitDepth=${bitDepth}, colorType=${colorType}`);
  }

  const bpp = colorType === 6 ? 4 : 3;
  const stride = width * bpp;
  const inflated = inflateSync(Buffer.concat(idat));
  const rows = new Uint8Array(width * height * bpp);
  let src = 0;
  let dst = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[src++];
    for (let x = 0; x < stride; x += 1) {
      const raw = inflated[src++];
      const left = x >= bpp ? rows[dst - bpp] : 0;
      const up = y > 0 ? rows[dst - stride] : 0;
      const upLeft = y > 0 && x >= bpp ? rows[dst - stride - bpp] : 0;
      let value = raw;
      if (filter === 1) value = raw + left;
      else if (filter === 2) value = raw + up;
      else if (filter === 3) value = raw + Math.floor((left + up) / 2);
      else if (filter === 4) value = raw + paeth(left, up, upLeft);
      rows[dst++] = value & 255;
    }
  }

  let nonBlank = 0;
  let variation = 0;
  const pixelStep = Math.max(1, Math.floor((width * height) / 12000));
  for (let p = 0; p < width * height; p += pixelStep) {
    const i = p * bpp;
    const r = rows[i];
    const g = rows[i + 1];
    const b = rows[i + 2];
    if (r + g + b > 15) nonBlank += 1;
    if (Math.max(r, g, b) - Math.min(r, g, b) > 8) variation += 1;
  }
  return { nonBlank, variation };
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function report() {
  if (failures.length > 0) {
    console.error(`\n3D reference implementation check FAILED (${failures.length}):`);
    for (const f of failures) console.error(`- ${f}`);
    process.exitCode = 1;
  } else {
    console.log(`3D reference implementation check passed. Screenshots: ${ARTIFACT_DIR}`);
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
  return new Promise((resolve) => setTimeout(resolve, ms));
}
