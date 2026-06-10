import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import {
  MIRROR_DB_VERSION,
  closeMirrorDb,
  deleteMirrorDb,
  getLatestStyleVectorRecord,
  getCurrentStyleVectorRecord,
  getMirrorMatchRecord,
  getMirrorMatchesForPlayer,
  logAnonymousEvent,
  mergeMirrorMatchMetadata,
  openMirrorDb,
  putMirrorMatchRecord,
  putStyleVectorRecord,
  setCurrentStyleVector,
  putClueAttempt,
  getClueAttemptsForPlayer,
  getClueStatsForPlayer,
  getImportedGamesForPlayer,
  putImportedGameRecord,
  updateImportedGameRecord,
  putGameReviewRecord,
  getGameReviewForSource,
  putClueMemoryRecord,
  getClueMemoryForPuzzleLevel,
  type PlayerRecord,
  type StyleVector,
  type StyleVectorRecord,
} from './db';

const createdDbs: string[] = [];
let dbSeq = 0;

function nextDbName(): string {
  dbSeq += 1;
  const dbName = `mirror-pwa-test-${Date.now()}-${dbSeq}`;
  createdDbs.push(dbName);
  return dbName;
}

function objectStoreNames(db: { objectStoreNames: DOMStringList }): string[] {
  return Array.from(db.objectStoreNames).sort();
}

function indexNames(store: { indexNames: DOMStringList }): string[] {
  return Array.from(store.indexNames).sort();
}

afterEach(async () => {
  await Promise.all(createdDbs.splice(0).map((dbName) => deleteMirrorDb(dbName)));
});

describe('openMirrorDb', () => {
  it('creates the v1 object stores and required indexes', async () => {
    const db = await openMirrorDb(nextDbName());

    expect(db.version).toBe(MIRROR_DB_VERSION);
    expect(objectStoreNames(db)).toEqual([
      'account_links',
      'achievements',
      'calibration_runs',
      'clue_attempts',
      'clue_memory',
      'feedback',
      'game_reviews',
      'imported_games',
      'local_matches',
      'mirror_matches',
      'players',
      'puzzle_reviews',
      'saved_analyses',
      'story_progress',
      'style_vectors',
    ].sort());

    const calibrationTx = db.transaction('calibration_runs', 'readonly');
    expect(indexNames(calibrationTx.objectStore('calibration_runs'))).toEqual(['started_at']);
    await calibrationTx.done;

    const styleTx = db.transaction('style_vectors', 'readonly');
    expect(indexNames(styleTx.objectStore('style_vectors'))).toEqual(['computed_at']);
    await styleTx.done;

    const importTx = db.transaction('imported_games', 'readonly');
    expect(indexNames(importTx.objectStore('imported_games'))).toEqual([
      'analysis_status',
      'imported_at',
      'legal_status',
      'player_id',
      'source',
    ]);
    await importTx.done;

    const reviewTx = db.transaction('game_reviews', 'readonly');
    expect(indexNames(reviewTx.objectStore('game_reviews'))).toEqual([
      'created_at',
      'player_id',
      'source_id',
      'source_type',
    ]);
    await reviewTx.done;

    const clueMemoryTx = db.transaction('clue_memory', 'readonly');
    expect(indexNames(clueMemoryTx.objectStore('clue_memory'))).toEqual([
      'clue_key',
      'player_id',
      'puzzle_id',
      'shown_at',
    ]);
    await clueMemoryTx.done;
  });

  it('reopens idempotently without dropping existing rows', async () => {
    const dbName = nextDbName();
    const player: PlayerRecord = {
      id: 'player-1',
      display_name: 'test-player',
      created_at: '2026-05-27T00:00:00.000Z',
      updated_at: '2026-05-27T00:00:00.000Z',
    };

    const first = await openMirrorDb(dbName);
    await first.put('players', player);
    await closeMirrorDb(dbName);

    const second = await openMirrorDb(dbName);

    await expect(second.get('players', 'player-1')).resolves.toEqual(player);
  });

  it('round-trips a style vector row through the computed_at index', async () => {
    const db = await openMirrorDb(nextDbName());
    const vector: StyleVector = {
      opening_white_top3: ['e4'],
      opening_black_top3: ['e5', 'd5'],
      avg_move_time_ms: 9_500,
      time_pressure_blunder_rate: 0.25,
      exchange_willingness: 0.6,
      preferred_minor: 'bishop',
      motif_blindness: {
        fork: 0.25,
        pin: 0.5,
        skewer: 0.25,
        removing_the_defender: 0.75,
      },
      endgame_strength: 0.65,
      swindle_preference: 'principled',
      detected_elo: 1420,
      elo_band: 'initiate',
      schema_version: 1,
    };
    const row: StyleVectorRecord = {
      id: 'style-vector-1',
      player_id: 'player-1',
      calibration_run_id: 'run-1',
      source: 'calibration',
      vector,
      computed_at: '2026-05-27T00:10:00.000Z',
    };

    await db.put('style_vectors', row);

    await expect(db.get('style_vectors', 'style-vector-1')).resolves.toEqual(row);
    await expect(db.getAllFromIndex('style_vectors', 'computed_at')).resolves.toEqual([row]);
  });

  it('returns the latest style vector for a player', async () => {
    const dbName = nextDbName();
    const db = await openMirrorDb(dbName);
    const earlyRow: StyleVectorRecord = {
      id: 'style-vector-early',
      player_id: 'player-1',
      source: 'calibration',
      vector: makeVector(1200),
      computed_at: '2026-05-27T00:10:00.000Z',
    };
    const latestRow: StyleVectorRecord = {
      id: 'style-vector-latest',
      player_id: 'player-1',
      source: 'tuned',
      vector: makeVector(1510),
      computed_at: '2026-05-27T00:20:00.000Z',
    };
    const otherPlayerRow: StyleVectorRecord = {
      id: 'style-vector-other',
      player_id: 'player-2',
      source: 'calibration',
      vector: makeVector(1800),
      computed_at: '2026-05-27T00:30:00.000Z',
    };

    await db.put('style_vectors', latestRow);
    await db.put('style_vectors', otherPlayerRow);
    await db.put('style_vectors', earlyRow);

    await expect(getLatestStyleVectorRecord('player-1', dbName)).resolves.toEqual(latestRow);
  });

  it('returns the style vector pointed to by the current player row', async () => {
    const dbName = nextDbName();
    const db = await openMirrorDb(dbName);
    const currentRow: StyleVectorRecord = {
      id: 'style-vector-current',
      player_id: 'player-1',
      source: 'calibration',
      vector: makeVector(1200),
      computed_at: '2026-05-27T00:10:00.000Z',
    };
    const newerRow: StyleVectorRecord = {
      id: 'style-vector-newer-but-not-current',
      player_id: 'player-1',
      source: 'tuned',
      vector: makeVector(1510),
      computed_at: '2026-05-27T00:20:00.000Z',
    };

    await db.put('style_vectors', currentRow);
    await db.put('style_vectors', newerRow);
    await db.put('players', {
      id: 'player-1',
      display_name: 'test-player',
      created_at: '2026-05-27T00:00:00.000Z',
      updated_at: '2026-05-27T00:30:00.000Z',
      current_style_vector_id: currentRow.id,
    });

    await expect(getCurrentStyleVectorRecord('player-1', dbName)).resolves.toEqual(currentRow);
  });

  it('persists completed Mirror matches', async () => {
    const dbName = nextDbName();
    const record = {
      id: 'mirror-match-1',
      player_id: 'player-1',
      started_at: '2026-05-27T00:00:00.000Z',
      completed_at: '2026-05-27T00:10:00.000Z',
      pgn: '1. e4 e5',
      result: 'Draw',
      metadata: {
        explanation: 'It took the trade on move 12 because you accept that exchange about 80% of the time.',
      },
    };

    await putMirrorMatchRecord(record, dbName);

    await expect((await openMirrorDb(dbName)).get('mirror_matches', record.id)).resolves.toEqual(
      record
    );
  });

  it('merges Mirror match metadata and lists completed matches for a player', async () => {
    const dbName = nextDbName();
    const baseRecord = {
      id: 'mirror-match-1',
      player_id: 'player-1',
      started_at: '2026-05-27T00:00:00.000Z',
      completed_at: '2026-05-27T00:10:00.000Z',
      result: 'You won',
      metadata: { explanation: 'line' },
    };
    await putMirrorMatchRecord(baseRecord, dbName);
    await putMirrorMatchRecord(
      {
        id: 'mirror-match-in-progress',
        player_id: 'player-1',
        started_at: '2026-05-27T00:11:00.000Z',
      },
      dbName
    );

    await mergeMirrorMatchMetadata('mirror-match-1', { self_recognition: { correct: true } }, dbName);

    await expect(getMirrorMatchRecord('mirror-match-1', dbName)).resolves.toMatchObject({
      metadata: {
        explanation: 'line',
        self_recognition: { correct: true },
      },
    });
    await expect(getMirrorMatchesForPlayer('player-1', dbName)).resolves.toHaveLength(1);
  });

  it('stores tuned style vectors and updates the current player pointer', async () => {
    const dbName = nextDbName();
    const db = await openMirrorDb(dbName);
    await db.put('players', {
      id: 'player-1',
      display_name: 'test-player',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    const row: StyleVectorRecord = {
      id: 'style-vector-tuned',
      player_id: 'player-1',
      source: 'tuned',
      previous_vector_id: 'style-vector-original',
      vector: makeVector(1510),
      computed_at: '2026-05-27T00:30:00.000Z',
    };

    await putStyleVectorRecord(row, dbName);
    await setCurrentStyleVector('player-1', row, dbName);

    await expect(db.get('style_vectors', row.id)).resolves.toEqual(row);
    await expect(db.get('players', 'player-1')).resolves.toMatchObject({
      current_style_vector_id: row.id,
      detected_elo: 1510,
    });
  });

  it('logs anonymous local events into the feedback store', async () => {
    const dbName = nextDbName();

    const event = await logAnonymousEvent('mirror_played', { mirror_match_id: 'match-1' }, dbName);

    await expect((await openMirrorDb(dbName)).get('feedback', event.id!)).resolves.toMatchObject({
      metadata: {
        event_type: 'mirror_played',
        mirror_match_id: 'match-1',
      },
    });
  });

  it('stores imported games and updates analysis status safely', async () => {
    const dbName = nextDbName();
    await putImportedGameRecord(
      {
        id: 'imported-game-1',
        player_id: 'player-1',
        source: 'manual_pgn',
        imported_at: '2026-06-01T00:00:00.000Z',
        headers: { White: 'Local Player', Black: 'Opponent', Result: '1-0' },
        pgn_text: '1. e4 e5 1-0',
        normalized_pgn: '1. e4 e5 1-0',
        result: '1-0',
        white: 'Local Player',
        black: 'Opponent',
        user_color: 'white',
        move_count: 2,
        final_fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
        legal_status: 'valid',
        validation_errors: [],
        analysis_status: 'not_analyzed',
        stylevector_applied: false,
        created_at: '2026-06-01T00:00:00.000Z',
        updated_at: '2026-06-01T00:00:00.000Z',
      },
      dbName
    );

    await updateImportedGameRecord('imported-game-1', { analysis_status: 'queued' }, dbName);

    await expect(getImportedGamesForPlayer('player-1', undefined, dbName)).resolves.toMatchObject([
      { id: 'imported-game-1', analysis_status: 'queued' },
    ]);
  });

  it('stores Game Review Pro records by source', async () => {
    const dbName = nextDbName();
    await putGameReviewRecord(
      {
        id: 'review-1',
        player_id: 'player-1',
        source_type: 'imported_game',
        source_id: 'imported-game-1',
        created_at: '2026-06-01T00:00:00.000Z',
        analysis_depth: 8,
        engine_name: 'Stockfish',
        engine_version: 'local',
        total_moves: 2,
        reviewed_side: 'white',
        accuracy_white: 94,
        accuracy_black: 92,
        average_cp_loss_white: 12,
        average_cp_loss_black: 18,
        result: '1-0',
        phase_summary: {
          opening: { phase: 'opening', moves: 2, average_cp_loss: 15, blunder_count: 0, mistake_count: 0, inaccuracy_count: 0, summary: 'opening' },
          middlegame: { phase: 'middlegame', moves: 0, average_cp_loss: 0, blunder_count: 0, mistake_count: 0, inaccuracy_count: 0, summary: 'middlegame' },
          endgame: { phase: 'endgame', moves: 0, average_cp_loss: 0, blunder_count: 0, mistake_count: 0, inaccuracy_count: 0, summary: 'endgame' },
          weakest_phase: 'opening',
          summary: 'opening',
        },
        key_moments: [],
        move_reviews: [],
        personalized_summary: {
          headline: 'Review focus',
          notes: [],
          evidence: [],
          insufficient_data: [],
        },
        recommended_actions: [],
      },
      dbName
    );

    await expect(getGameReviewForSource('imported_game', 'imported-game-1', dbName)).resolves.toMatchObject({
      id: 'review-1',
      source_type: 'imported_game',
    });
  });
});

function makeVector(detectedElo: number): StyleVector {
  return {
    opening_white_top3: ['e4'],
    opening_black_top3: ['e5'],
    avg_move_time_ms: 9_500,
    time_pressure_blunder_rate: 0.25,
    exchange_willingness: 0.6,
    preferred_minor: 'bishop',
    motif_blindness: {
      fork: 0.25,
      pin: 0.5,
      skewer: 0.25,
      removing_the_defender: 0.75,
    },
    endgame_strength: 0.65,
    swindle_preference: 'principled',
    detected_elo: detectedElo,
    elo_band: 'initiate',
    schema_version: 1,
  };
}

describe('clue tracking', () => {
  it('putClueAttempt saves correctly and gets filtered by player', async () => {
    const dbName = nextDbName();
    await putClueAttempt({
      id: 'c1',
      player_id: 'p1',
      puzzle_id: 'pz1',
      source: 'seed',
      fen: '8/8',
      solution_moves: ['e4'],
      attempted_moves: [],
      difficulty: 'beginner',
      hints_used: 1,
      solved: true,
      started_at: '2026-01-01T00:00:00Z',
      created_at: '2026-01-01T00:00:00Z'
    }, dbName);
    
    await putClueAttempt({
      id: 'c2',
      player_id: 'p2',
      puzzle_id: 'pz2',
      source: 'seed',
      fen: '8/8',
      solution_moves: ['e4'],
      attempted_moves: [],
      difficulty: 'beginner',
      hints_used: 1,
      solved: false,
      started_at: '2026-01-01T00:00:00Z',
      created_at: '2026-01-01T00:00:00Z'
    }, dbName);

    const p1Clues = await getClueAttemptsForPlayer('p1', 10, dbName);
    expect(p1Clues.length).toBe(1);
    expect(p1Clues[0].id).toBe('c1');
  });

  it('stores clue memory records by player, puzzle, and level', async () => {
    const dbName = nextDbName();
    await putClueMemoryRecord({
      id: 'memory-1',
      player_id: 'p1',
      puzzle_id: 'seed-fork-1',
      clue_level: 1,
      clue_variant_id: 'seed-fork-1:L1:v1:standard',
      shown_at: '2026-06-10T00:00:00.000Z',
      attempt_context: 'adaptive',
      mode: 'adaptive',
    }, dbName);
    await putClueMemoryRecord({
      id: 'memory-2',
      player_id: 'p2',
      puzzle_id: 'seed-fork-1',
      clue_level: 1,
      clue_variant_id: 'seed-fork-1:L1:v1:standard',
      shown_at: '2026-06-10T00:00:00.000Z',
      attempt_context: 'adaptive',
      mode: 'adaptive',
    }, dbName);

    await expect(getClueMemoryForPuzzleLevel('p1', 'seed-fork-1', 1, dbName)).resolves.toHaveLength(1);
  });

  it('getClueStatsForPlayer computes solved rate and average hints', async () => {
    const dbName = nextDbName();
    await putClueAttempt({
      id: 'c1', player_id: 'p1', puzzle_id: 'pz1', source: 'seed', fen: '8/8', solution_moves: ['e4'], attempted_moves: [], difficulty: 'beginner',
      hints_used: 1, solved: true, started_at: '2026-01-01T00:00:00Z', created_at: '2026-01-01T00:00:00Z', motif: 'fork'
    }, dbName);
    await putClueAttempt({
      id: 'c2', player_id: 'p1', puzzle_id: 'pz2', source: 'seed', fen: '8/8', solution_moves: ['e4'], attempted_moves: [], difficulty: 'beginner',
      hints_used: 3, solved: false, started_at: '2026-01-01T00:00:00Z', created_at: '2026-01-01T00:00:00Z', motif: 'pin'
    }, dbName);

    const stats = await getClueStatsForPlayer('p1', dbName);
    expect(stats.attempt_count).toBe(2);
    expect(stats.solved_count).toBe(1);
    expect(stats.solved_rate).toBe(0.5);
    expect(stats.average_hints_used).toBe(2);
    expect(stats.weakest_motif).toBe('pin');
  });
});
