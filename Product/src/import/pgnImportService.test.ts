import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deleteMirrorDb,
  openMirrorDb,
  type AnalysisRecord,
  type StyleVector,
  type StyleVectorRecord,
} from '../data/db';
import { parsePgnText } from './pgnParser';
import { analyzeImportedGames, savePgnImport } from './pgnImportService';

const analyzeMock = vi.hoisted(() => vi.fn());

vi.mock('../analysis/analyzeGame', () => ({
  analyzeGame: analyzeMock,
}));

let dbName = '';
let dbSeq = 0;

const VALID_PGN = `[Event "Imported win"]
[White "Local Player"]
[Black "Opponent"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 1-0`;

const BLACK_PGN = `[Event "Imported black game"]
[White "Opponent"]
[Black "Local Player"]
[Result "0-1"]

1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 0-1`;

const INVALID_PGN = `[Event "Broken import"]
[White "Local Player"]
[Black "Opponent"]
[Result "1-0"]

1. e4 e5 2. Nf3 BadMove 1-0`;

beforeEach(async () => {
  dbSeq += 1;
  dbName = `mirror-pgn-import-test-${Date.now()}-${dbSeq}`;
  analyzeMock.mockReset();
  const db = await openMirrorDb(dbName);
  await db.put('players', {
    id: 'player-1',
    display_name: 'Local Player',
    created_at: '2026-06-01T00:00:00.000Z',
    updated_at: '2026-06-01T00:00:00.000Z',
    current_style_vector_id: 'sv-base',
  });
  await db.put('style_vectors', baseStyleVectorRecord());
});

afterEach(async () => {
  await deleteMirrorDb(dbName);
});

describe('PGN import service', () => {
  it('saves imported games locally with validation status and detected user color', async () => {
    const preview = parsePgnText(VALID_PGN);

    const result = await savePgnImport(
      {
        playerId: 'player-1',
        source: 'manual_pgn',
        games: preview.games,
        playerNameHint: 'Local Player',
      },
      dbName
    );

    const rows = await (await openMirrorDb(dbName)).getAll('imported_games');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      player_id: 'player-1',
      source: 'manual_pgn',
      legal_status: 'valid',
      user_color: 'white',
      analysis_status: 'not_analyzed',
    });
    expect(result.summary.valid_games).toBe(1);
  });

  it('does not update StyleVector from invalid imported games', async () => {
    const preview = parsePgnText(INVALID_PGN);

    const result = await savePgnImport(
      {
        playerId: 'player-1',
        source: 'manual_pgn',
        games: preview.games,
        playerNameHint: 'Local Player',
      },
      dbName
    );

    const styleRows = await (await openMirrorDb(dbName)).getAll('style_vectors');
    expect(result.stylevector_update?.updated).toBe(false);
    expect(styleRows).toHaveLength(1);
  });

  it('updates StyleVector evidence from valid games without inventing time-pressure metrics', async () => {
    const preview = parsePgnText(`${VALID_PGN}\n\n${BLACK_PGN}`);

    const result = await savePgnImport(
      {
        playerId: 'player-1',
        source: 'lichess_pgn',
        games: preview.games,
        originalFilename: 'games.pgn',
        playerNameHint: 'Local Player',
      },
      dbName
    );

    expect(result.stylevector_update?.updated).toBe(true);
    expect(result.stylevector_update?.fields_updated).toContain('opening_white_top3');
    expect(result.stylevector_update?.fields_updated).toContain('opening_black_top3');
    expect(result.stylevector_update?.insufficient_data).toContain('no_clock_data_time_pressure_not_updated');

    const player = await (await openMirrorDb(dbName)).get('players', 'player-1');
    const current = await (await openMirrorDb(dbName)).get('style_vectors', player?.current_style_vector_id ?? '');
    expect(current?.vector.opening_white_top3[0]).toBe('e4');
    expect(current?.vector.opening_black_top3[0]).toBe('Nf6');
    expect(current?.vector.time_pressure_blunder_rate).toBe(0.22);
  });

  it('does not update StyleVector when user color cannot be attributed', async () => {
    const preview = parsePgnText(VALID_PGN);

    const result = await savePgnImport(
      {
        playerId: 'player-1',
        source: 'unknown_pgn',
        games: preview.games,
        playerNameHint: 'Different Name',
      },
      dbName
    );

    expect(result.stylevector_update?.updated).toBe(false);
    expect(result.stylevector_update?.insufficient_data).toContain('user_color_not_detected');
  });

  it('analyzes valid imported games through the stable analysis path and skips invalid rows', async () => {
    analyzeMock.mockResolvedValue(makeAnalysisRecord());
    const preview = parsePgnText(`${VALID_PGN}\n\n${INVALID_PGN}`);
    const saved = await savePgnImport(
      {
        playerId: 'player-1',
        source: 'manual_pgn',
        games: preview.games,
        playerNameHint: 'Local Player',
      },
      dbName
    );

    const result = await analyzeImportedGames(
      'player-1',
      saved.records.map((record) => record.id),
      { limit: 5 },
      dbName
    );

    expect(analyzeMock).toHaveBeenCalledOnce();
    expect(analyzeMock.mock.calls[0][3]).toBe('imported');
    expect(result.analyzed).toBe(1);
    expect(result.skipped).toBe(1);
    expect(await (await openMirrorDb(dbName)).getAll('saved_analyses')).toHaveLength(1);
  });
});

function baseStyleVectorRecord(): StyleVectorRecord {
  return {
    id: 'sv-base',
    player_id: 'player-1',
    source: 'calibration',
    computed_at: '2026-06-01T00:10:00.000Z',
    vector: makeVector(),
  };
}

function makeVector(): StyleVector {
  return {
    opening_white_top3: ['d4'],
    opening_black_top3: ['c5'],
    avg_move_time_ms: 9000,
    time_pressure_blunder_rate: 0.22,
    exchange_willingness: 0.4,
    preferred_minor: 'neutral',
    motif_blindness: {
      fork: 0.3,
      pin: 0.3,
      skewer: 0.3,
      removing_the_defender: 0.3,
    },
    endgame_strength: 0.5,
    swindle_preference: null,
    detected_elo: 1300,
    elo_band: 'initiate',
    schema_version: 1,
  };
}

function makeAnalysisRecord(): AnalysisRecord {
  return {
    id: 'analysis-imported-1',
    player_id: 'player-1',
    match_id: 'imported-game-1',
    match_type: 'imported',
    source: 'local_stockfish',
    engine_depth: 8,
    status: 'complete',
    created_at: '2026-06-01T01:00:00.000Z',
    completed_at: '2026-06-01T01:01:00.000Z',
    pgn: VALID_PGN,
    summary: {
      total_moves: 6,
      analyzed_moves: 6,
      average_cp_loss: 35,
      accuracy_estimate: 93,
      best_count: 3,
      good_count: 2,
      inaccuracy_count: 1,
      mistake_count: 0,
      blunder_count: 0,
    },
    moves: [],
  };
}

