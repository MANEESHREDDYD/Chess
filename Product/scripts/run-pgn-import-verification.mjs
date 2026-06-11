import puppeteer from 'puppeteer';
import { spawn } from 'child_process';

const PORT = 5173;
const HOST = '127.0.0.1';
const URL = `http://${HOST}:${PORT}/import-pgn`;
const SERVER_TIMEOUT_MS = 30000;

async function run() {
  let server = null;
  let browser = null;

  try {
    if (await isServerReachable()) {
      console.log(`Using existing dev server at ${URL}`);
    } else {
      console.log('Starting dev server...');
      server = startDevServer();
      await waitForServerBoot(server);
    }

    console.log('Launching browser...');
    browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();

    page.on('console', (msg) => {
      console.log(`BROWSER: ${msg.text()}`);
    });

    page.on('pageerror', (err) => {
      console.error(`BROWSER ERROR: ${err.message}`);
    });

    await page.goto(URL, { waitUntil: 'networkidle0', timeout: 60000 });

    const results = await page.evaluate(async () => {
      const parser = await import('/src/import/pgnParser.ts');
      const service = await import('/src/import/pgnImportService.ts');
      const dbModule = await import('/src/data/db.ts');

      const valid = `[Event "Verification"]
[White "Verifier"]
[Black "Opponent"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 1-0`;

      const second = `[Event "Verification 2"]
[White "Opponent"]
[Black "Verifier"]
[Result "0-1"]

1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 0-1`;

      const invalid = `[Event "Broken"]
[White "Verifier"]
[Black "Opponent"]
[Result "1-0"]

1. e4 e5 2. Nf3 BadMove 1-0`;

      const single = parser.parsePgnText(valid);
      const multi = parser.parsePgnText(`${valid}\n\n${second}`);
      const invalidPreview = parser.parsePgnText(invalid);
      const mixed = parser.parsePgnText(`${valid}\n\n${invalid}`);

      const dbName = `mirror-pgn-verification-${Date.now()}`;
      const db = await dbModule.openMirrorDb(dbName);
      await db.put('players', {
        id: 'player-verifier',
        display_name: 'Verifier',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const saved = await service.savePgnImport(
        {
          playerId: 'player-verifier',
          source: 'manual_pgn',
          games: mixed.games,
          playerNameHint: 'Verifier',
        },
        dbName
      );

      const unknownSide = await service.savePgnImport(
        {
          playerId: 'player-verifier',
          source: 'unknown_pgn',
          games: single.games,
          playerNameHint: 'Someone Else',
        },
        dbName
      );

      await dbModule.closeMirrorDb(dbName);

      return {
        single: {
          detected: single.detected_count,
          valid: single.valid_count,
          finalFen: single.games[0]?.final_fen ?? '',
        },
        multi: {
          detected: multi.detected_count,
          valid: multi.valid_count,
        },
        invalid: {
          detected: invalidPreview.detected_count,
          invalid: invalidPreview.invalid_count,
          errors: invalidPreview.games[0]?.validation_errors ?? [],
        },
        mixed: {
          detected: mixed.detected_count,
          valid: mixed.valid_count,
          invalid: mixed.invalid_count,
        },
        summary: saved.summary,
        styleVector: {
          updated: saved.stylevector_update?.updated ?? false,
          insufficient: saved.stylevector_update?.insufficient_data ?? [],
        },
        unknownSide: {
          updated: unknownSide.stylevector_update?.updated ?? false,
          insufficient: unknownSide.stylevector_update?.insufficient_data ?? [],
        },
      };
    });

    if (results.single.detected !== 1 || results.single.valid !== 1) {
      throw new Error('Single valid PGN did not parse as one valid game.');
    }
    if (!results.single.finalFen || results.single.finalFen.includes(' w KQkq - 0 1')) {
      throw new Error('Valid game did not produce a final FEN.');
    }
    if (results.multi.detected !== 2 || results.multi.valid !== 2) {
      throw new Error('Multi-game PGN did not parse as two valid games.');
    }
    if (results.invalid.detected !== 1 || results.invalid.invalid !== 1 || results.invalid.errors.length === 0) {
      throw new Error('Invalid PGN did not fail safely with validation errors.');
    }
    if (results.mixed.valid !== 1 || results.mixed.invalid !== 1) {
      throw new Error('One invalid PGN blocked or corrupted a valid game.');
    }
    if (results.summary.games_detected !== 2 || results.summary.valid_games !== 1 || results.summary.invalid_games !== 1) {
      throw new Error('Import summary did not match mixed import counts.');
    }
    if (!results.styleVector.updated) {
      throw new Error('Valid user-attributed import did not update StyleVector evidence.');
    }
    if (results.unknownSide.updated || !results.unknownSide.insufficient.includes('user_color_not_detected')) {
      throw new Error('StyleVector update did not handle insufficient user-side data honestly.');
    }

    console.log('PGN import verification passed.');
    console.log(`Summary: ${results.summary.valid_games} valid, ${results.summary.invalid_games} invalid.`);
  } catch (error) {
    console.error('PGN import verification failed:', error);
    process.exitCode = 1;
  } finally {
    if (browser) {
      await browser.close().catch(() => undefined);
    }
    if (server) {
      server.kill();
    }
  }
}

function startDevServer() {
  // Invoke Vite's JS entry via the current Node binary: spawning npm.cmd with
  // shell:false throws EINVAL on modern Node/Windows.
  const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', HOST, '--port', String(PORT)], {
    stdio: 'pipe',
    shell: false,
  });

  server.stdout.on('data', (chunk) => {
    process.stdout.write(String(chunk));
  });

  server.stderr.on('data', (chunk) => {
    process.stderr.write(String(chunk));
  });

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

  throw new Error(`Timed out waiting for the Vite dev server at ${URL}.`);
}

async function isServerReachable() {
  try {
    const response = await fetch(URL, { method: 'GET' });
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
