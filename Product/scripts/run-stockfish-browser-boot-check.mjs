import puppeteer from 'puppeteer';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import net from 'node:net';

const HOST = '127.0.0.1';
const START_PORT = 4173;
const SERVER_TIMEOUT_MS = 45000;
const FLOW_TIMEOUT_MS = 30000;

async function run() {
  let server = null;
  let browser = null;

  try {
    await withTimeout(async () => {
      await ensureBuildExists();
      const port = await findFreePort(START_PORT);
      const baseUrl = `http://${HOST}:${port}`;
      const playUrl = `${baseUrl}/play?stockfishBootCheck=1`;

      console.log(`Starting Vite preview on ${baseUrl}...`);
      server = startPreviewServer(port);
      await waitForServer(baseUrl, server);
      console.log('Preview server is reachable.');

      console.log('Launching browser...');
      browser = await puppeteer.launch({ headless: 'new' });
      const page = await browser.newPage();
      page.on('console', (msg) => console.log(`BROWSER: ${msg.text()}`));
      page.on('pageerror', (err) => console.error(`BROWSER ERROR: ${err.message}`));

      console.log(`Opening ${playUrl}...`);
      await page.goto(playUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForSelector('.play', { timeout: 10000 });
      await page.waitForFunction(() => !!window.__MIRROR_PLAY_TEST__, { timeout: 10000 });

      const assetProbe = await page.evaluate(async () => {
        const script = await fetch('/stockfish/stockfish-nnue-16-single.js', { cache: 'no-store' });
        const wasm = await fetch('/stockfish/stockfish-nnue-16-single.wasm', { cache: 'no-store' });
        return {
          scriptOk: script.ok,
          wasmOk: wasm.ok,
          wasmContentType: wasm.headers.get('content-type'),
        };
      });

      if (!assetProbe.scriptOk || !assetProbe.wasmOk) {
        throw new Error(`Stockfish assets were not reachable in preview: ${JSON.stringify(assetProbe)}`);
      }

      console.log('Verifying White first-move flow...');
      await selectKurukshetraTheme(page);
      await verifyWhiteFlow(page);
      console.log('Verifying Black engine-first flow...');
      await verifyBlackFlow(page);
      console.log('Verifying Stockfish diagnostics...');
      await verifyDiagnostics(page, assetProbe);
    }, 120000, 'Stockfish browser boot check exceeded its internal timeout.');

    console.log('Stockfish browser boot check passed.');
  } catch (error) {
    console.error('Stockfish browser boot check failed:', error);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close().catch(() => undefined);
    if (server) stopProcessTree(server);
  }
}

async function ensureBuildExists() {
  if (existsSync('dist/index.html')) return;
  console.log('dist/index.html not found; running npm run build first...');
  await runCommand(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build']);
}

function startPreviewServer(port) {
  const command = process.platform === 'win32' ? process.env.ComSpec || 'cmd.exe' : 'npm';
  const args =
    process.platform === 'win32'
      ? ['/d', '/s', '/c', `npm run preview -- --host ${HOST} --port ${port}`]
      : ['run', 'preview', '--', '--host', HOST, '--port', String(port)];
  const server = spawn(command, args, {
    stdio: 'pipe',
    shell: false,
  });
  server.stdout.on('data', (chunk) => process.stdout.write(String(chunk)));
  server.stderr.on('data', (chunk) => process.stderr.write(String(chunk)));
  return server;
}

async function waitForServer(baseUrl, server) {
  let exitError = null;
  server.on('exit', (code) => {
    exitError = new Error(`Preview server exited before it became ready (code ${code}).`);
  });

  const deadline = Date.now() + SERVER_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (exitError) throw exitError;
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {
      // keep waiting
    }
    await delay(250);
  }

  throw new Error(`Timed out waiting for Vite preview at ${baseUrl}.`);
}

async function selectKurukshetraTheme(page) {
  await page.select('.theme-toggle select', 'mahabharata');
  await delay(250);
}

async function verifyWhiteFlow(page) {
  await page.evaluate(() => window.__MIRROR_PLAY_TEST__.startGame('white', 'Club'));
  const beforeMove = await waitForPlayState(page, (state) => state.playerColor === 'white' && state.status === 'playing');
  if (beforeMove.engineError || beforeMove.enginePhase === 'unavailable' || beforeMove.enginePhase === 'retry-failed') {
    throw new Error(`White flow showed blocking engine failure before first move: ${JSON.stringify(beforeMove)}`);
  }
  if (beforeMove.engineThinking) {
    throw new Error(`White flow locked the board before the player moved: ${JSON.stringify(beforeMove)}`);
  }

  const moved = await page.evaluate(() => window.__MIRROR_PLAY_TEST__.makePlayerMove('e2', 'e4'));
  if (!moved) throw new Error('White flow could not make the first player move e2e4.');

  const afterEngine = await waitForPlayState(
    page,
    (state) => state.history.length >= 2 && !state.engineThinking && !state.engineError
  );
  if (afterEngine.history.length < 2) {
    throw new Error(`White flow did not receive a Stockfish response: ${JSON.stringify(afterEngine)}`);
  }
}

async function verifyBlackFlow(page) {
  await page.evaluate(() => window.__MIRROR_PLAY_TEST__.startGame('black', 'Club'));
  const afterEngine = await waitForPlayState(
    page,
    (state) => state.playerColor === 'black' && state.history.length >= 1 && !state.engineThinking && !state.engineError
  );
  if (afterEngine.history.length < 1) {
    throw new Error(`Black flow did not receive Stockfish's first White move: ${JSON.stringify(afterEngine)}`);
  }
}

async function verifyDiagnostics(page, assetProbe) {
  const diagnostics = await page.evaluate(() => window.__MIRROR_PLAY_TEST__.getState().diagnostics);
  const flags = diagnostics.bootFlags;
  const missing = [];
  if (!flags.worker_booted_seen) missing.push('worker_booted');
  if (!flags.stockfish_script_loaded_seen) missing.push('stockfish_script_loaded');
  if (!flags.uciok_seen) missing.push('uciok_received');
  if (!flags.readyok_seen) missing.push('readyok_received');
  if (!flags.first_bestmove_received) missing.push('first_bestmove_received');
  if (missing.length > 0) {
    throw new Error(`Stockfish diagnostics missed required phase(s): ${missing.join(', ')}\n${JSON.stringify(diagnostics, null, 2)}`);
  }
  if (!assetProbe.wasmContentType || !assetProbe.wasmContentType.toLowerCase().includes('wasm')) {
    console.warn(
      `Preview served WASM as ${assetProbe.wasmContentType ?? 'unknown'}; Stockfish's internal ArrayBuffer fallback must cover this.`
    );
  }
}

async function waitForPlayState(page, predicate) {
  const deadline = Date.now() + FLOW_TIMEOUT_MS;
  let lastState = null;
  while (Date.now() < deadline) {
    lastState = await page.evaluate(() => window.__MIRROR_PLAY_TEST__.getState());
    if (predicate(lastState)) return lastState;
    await delay(100);
  }
  throw new Error(`Timed out waiting for play state. Last state: ${JSON.stringify(lastState)}`);
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', shell: false });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
    });
    child.on('error', reject);
  });
}

function stopProcessTree(child) {
  if (!child?.pid) return;
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore', shell: false });
    return;
  }
  child.kill();
}

async function withTimeout(fn, timeoutMs, message) {
  let timer = null;
  try {
    return await Promise.race([
      fn(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function findFreePort(startPort) {
  return new Promise((resolve, reject) => {
    function tryPort(port) {
      const server = net.createServer();
      server.once('error', () => tryPort(port + 1));
      server.once('listening', () => {
        server.close(() => resolve(port));
      });
      server.listen(port, HOST);
    }
    try {
      tryPort(startPort);
    } catch (error) {
      reject(error);
    }
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
