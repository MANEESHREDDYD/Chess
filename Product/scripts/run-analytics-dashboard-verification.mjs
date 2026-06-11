import puppeteer from 'puppeteer';
import { spawn } from 'child_process';

const PORT = 5173;
const HOST = '127.0.0.1';
const BASE_URL = `http://${HOST}:${PORT}`;
const URL = `${BASE_URL}/analytics`;
const SERVER_TIMEOUT_MS = 30000;

async function run() {
  let server = null;
  let browser = null;

  try {
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
    await page.evaluate(async () => {
      const dbModule = await import('/src/data/db.ts');
      await dbModule.deleteMirrorDb();
      localStorage.removeItem('mirror_active_player_id');
    });

    await page.goto(URL, { waitUntil: 'networkidle0', timeout: 60000 });
    const emptyText = await page.$eval('body', (body) => body.textContent ?? '');
    if (!emptyText.includes('Player intelligence dashboard') || !emptyText.includes('No active local player profile')) {
      throw new Error('/analytics did not render the empty-data dashboard safely.');
    }

    const results = await page.evaluate(async () => {
      const dbModule = await import('/src/data/db.ts');
      const service = await import('/src/analytics/dashboardService.ts');
      const db = await dbModule.openMirrorDb();
      const playerId = 'analytics-browser-verifier';
      await seedAnalyticsFixture(db, playerId);
      localStorage.setItem('mirror_active_player_id', playerId);

      const snapshot = await service.buildAnalyticsDashboardSnapshot(playerId);
      const markdown = service.buildAnalyticsDashboardMarkdown(snapshot);
      const json = service.buildAnalyticsDashboardJson(snapshot);
      return {
        cards: {
          localGames: snapshot.player_summary.total_local_games,
          reviewedGames: snapshot.review_summary.reviewed_games_count,
          importedGames: snapshot.imported_game_summary.imported_games_count,
          weakestMotif: snapshot.puzzle_summary.weakest_motif,
          mirrorMatches: snapshot.mirror_summary.mirror_matches_count,
        },
        actions: snapshot.recommended_actions.length,
        firstActionEvidence: snapshot.recommended_actions[0]?.evidence?.length ?? 0,
        markdownSafe: !service.analyticsExportContainsUnsafeText(markdown),
        jsonSafe: !service.analyticsExportContainsUnsafeText(json),
        markdownHasTitle: markdown.includes('# MIRROR Advanced Analytics Dashboard'),
        jsonHasSchema: json.includes('mirror_analytics_dashboard_snapshot_v1'),
      };

      async function seedAnalyticsFixture(database, playerIdValue) {
        await database.put('players', {
          id: playerIdValue,
          display_name: 'Analytics Browser Verifier',
          created_at: '2026-06-01T00:00:00.000Z',
          updated_at: '2026-06-01T00:00:00.000Z',
          current_style_vector_id: 'sv-browser-analytics',
          calibration_status: 'complete',
        });
        await database.put('style_vectors', {
          id: 'sv-browser-analytics',
          player_id: playerIdValue,
          source: 'tuned',
          computed_at: '2026-06-01T01:00:00.000Z',
          vector: {
            opening_white_top3: ['e4'],
            opening_black_top3: ['c5'],
            avg_move_time_ms: 9000,
            time_pressure_blunder_rate: 0.25,
            exchange_willingness: 0.65,
            preferred_minor: 'knight',
            motif_blindness: {
              fork: 0.2,
              pin: 0.8,
              skewer: 0.3,
              removing_the_defender: 0.4,
            },
            endgame_strength: 0.55,
            swindle_preference: 'swindle',
            detected_elo: 1420,
            elo_band: 'initiate',
            schema_version: 1,
          },
        });
        await database.put('local_matches', {
          id: 'local-browser-analytics',
          player_id: playerIdValue,
          mode: 'computer',
          side: 'white',
          actual_side: 'white',
          difficulty: 'Club',
          result: 'white_win',
          result_label: 'White wins',
          pgn: '1. e4 e5 1-0',
          move_count: 2,
          created_at: '2026-06-02T00:00:00.000Z',
          completed_at: '2026-06-02T00:10:00.000Z',
        });
        await database.put('mirror_matches', {
          id: 'mirror-browser-analytics',
          player_id: playerIdValue,
          started_at: '2026-06-03T00:00:00.000Z',
          completed_at: '2026-06-03T00:20:00.000Z',
          result: 'draw',
          pgn: '1. d4 d5 1/2-1/2',
          metadata: { personality_mode: 'current_self' },
        });
        await database.put('feedback', {
          id: 'feedback-browser-analytics',
          player_id: playerIdValue,
          mirror_match_id: 'mirror-browser-analytics',
          style_vector_id: 'sv-browser-analytics',
          felt_like_me: 'yes',
          perceived_strength: 'equal',
          created_at: '2026-06-03T00:25:00.000Z',
          metadata: { feedback_tags: ['felt_like_me'], personality_mode: 'current_self' },
        });
        await database.put('imported_games', {
          id: 'import-browser-analytics',
          player_id: playerIdValue,
          source: 'manual_pgn',
          imported_at: '2026-06-04T00:00:00.000Z',
          headers: { Event: 'Analytics browser fixture' },
          pgn_text: '1. e4 e5 1-0',
          normalized_pgn: '1. e4 e5 1-0',
          result: '1-0',
          user_color: 'white',
          move_count: 2,
          final_fen: 'final',
          legal_status: 'valid',
          validation_errors: [],
          analysis_status: 'analyzed',
          stylevector_applied: true,
          created_at: '2026-06-04T00:00:00.000Z',
          updated_at: '2026-06-04T00:00:00.000Z',
        });
        await database.put('game_reviews', makeReview(playerIdValue));
        await database.put('clue_attempts', {
          id: 'clue-browser-pin',
          player_id: playerIdValue,
          puzzle_id: 'pin-browser',
          source: 'seed',
          fen: '8/8/8/8/8/8/8/8 w - - 0 1',
          solution_moves: ['a2a3'],
          attempted_moves: ['a2a4'],
          motif: 'pin',
          difficulty: 'casual',
          hints_used: 1,
          solved: false,
          started_at: '2026-06-05T00:00:00.000Z',
          completed_at: '2026-06-05T00:05:00.000Z',
          created_at: '2026-06-05T00:00:00.000Z',
        });
        await database.put('puzzle_reviews', {
          id: `${playerIdValue}:pin-browser`,
          player_id: playerIdValue,
          puzzle_id: 'pin-browser',
          motif: 'pin',
          difficulty: 'casual',
          next_due_at: '2020-01-01T00:00:00.000Z',
          interval_days: 0,
          ease: 2,
          attempts: 2,
          lapses: 2,
          solved_streak: 0,
          last_result: 'failed',
          updated_at: '2026-06-05T00:05:00.000Z',
        });
        await database.put('story_progress', {
          id: `${playerIdValue}_ch1_apprentice_arrives`,
          player_id: playerIdValue,
          chapter_id: 'ch1_apprentice_arrives',
          status: 'complete',
          attempts: 1,
          completed_at: '2026-06-06T00:00:00.000Z',
          updated_at: '2026-06-06T00:00:00.000Z',
        });
      }

      function makeReview(playerIdValue) {
        const moveReviews = [
          {
            ply: 1,
            move_number: 1,
            san: 'e4',
            fen_before: 'fixture-1',
            side: 'white',
            cp_loss: 8,
            classification: 'best',
            phase: 'opening',
            motif_tags: ['opening'],
            is_turning_point: false,
            retry_available: true,
            explanation: 'Best move fixture.',
            evidence: ['Normalized CP loss: 8.'],
            best_move: 'e2e4',
          },
          {
            ply: 2,
            move_number: 1,
            san: 'e5',
            fen_before: 'fixture-2',
            side: 'black',
            cp_loss: 260,
            classification: 'blunder',
            phase: 'middlegame',
            motif_tags: ['pin'],
            is_turning_point: true,
            retry_available: true,
            explanation: 'Blunder fixture.',
            evidence: ['Normalized CP loss: 260.'],
            best_move: 'g8f6',
          },
        ];
        return {
          id: 'review-browser-analytics',
          player_id: playerIdValue,
          source_type: 'imported_game',
          source_id: 'import-browser-analytics',
          created_at: '2026-06-06T01:00:00.000Z',
          engine_name: 'Stockfish',
          engine_version: 'local',
          total_moves: 2,
          reviewed_side: 'both',
          accuracy_white: 96,
          accuracy_black: 40,
          average_cp_loss_white: 8,
          average_cp_loss_black: 260,
          phase_summary: {
            opening: { phase: 'opening', moves: 1, average_cp_loss: 8, blunder_count: 0, mistake_count: 0, inaccuracy_count: 0, summary: 'Opening reviewed.' },
            middlegame: { phase: 'middlegame', moves: 1, average_cp_loss: 260, blunder_count: 1, mistake_count: 0, inaccuracy_count: 0, summary: 'Middlegame reviewed.' },
            endgame: { phase: 'endgame', moves: 0, average_cp_loss: 0, blunder_count: 0, mistake_count: 0, inaccuracy_count: 0, summary: 'No endgame moves.' },
            weakest_phase: 'middlegame',
            summary: 'Largest MIRROR internal CP-loss came in the middlegame.',
          },
          key_moments: [
            {
              id: 'browser-moment',
              type: 'largest_cp_loss',
              ply: 2,
              move_number: 1,
              san: 'e5',
              classification: 'blunder',
              phase: 'middlegame',
              reason: 'Largest CP-loss in fixture.',
              evidence: ['Normalized CP loss: 260.'],
              suggested_retry: 'Retry the reviewed best move.',
              cp_loss: 260,
              best_move: 'g8f6',
            },
          ],
          move_reviews: moveReviews,
          personalized_summary: {
            headline: 'Pin pattern needs review.',
            notes: ['StyleVector pin blindness evidence is present.'],
            evidence: ['motif_blindness.pin=0.8'],
            insufficient_data: [],
          },
          recommended_actions: [],
        };
      }
    });

    if (results.cards.localGames !== 1 || results.cards.reviewedGames !== 1 || results.cards.importedGames !== 1) {
      throw new Error(`Full fixture snapshot did not generate expected summary cards: ${JSON.stringify(results.cards)}`);
    }
    if (results.cards.weakestMotif !== 'pin') {
      throw new Error(`Expected weakest motif pin, got ${results.cards.weakestMotif}`);
    }
    if (results.actions < 1 || results.firstActionEvidence < 1) {
      throw new Error('Recommended actions were not produced with evidence.');
    }
    if (!results.markdownSafe || !results.jsonSafe || !results.markdownHasTitle || !results.jsonHasSchema) {
      throw new Error(`Export safety or export generation failed: ${JSON.stringify(results)}`);
    }

    await page.goto(URL, { waitUntil: 'networkidle0', timeout: 60000 });
    const fullText = await page.$eval('body', (body) => body.textContent ?? '');
    const requiredText = [
      'Player intelligence dashboard',
      'Game Review Pro summary',
      'StyleVector profile',
      'Weak motif analytics',
      'Imported-game coverage',
      'Mirror performance',
      'Recommended next actions',
    ];
    for (const text of requiredText) {
      if (!fullText.includes(text)) {
        throw new Error(`/analytics full fixture route missing text: ${text}`);
      }
    }

    console.log('Analytics dashboard verification passed.');
    console.log(`Actions: ${results.actions}; weakest motif: ${results.cards.weakestMotif}.`);
  } catch (error) {
    console.error('Analytics dashboard verification failed:', error);
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

  throw new Error(`Timed out waiting for the Vite dev server at ${BASE_URL}.`);
}

async function isServerReachable() {
  try {
    const response = await fetch(BASE_URL, { method: 'GET' });
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
