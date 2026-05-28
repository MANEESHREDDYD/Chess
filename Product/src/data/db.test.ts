import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import {
  MIRROR_DB_VERSION,
  closeMirrorDb,
  deleteMirrorDb,
  getLatestStyleVectorRecord,
  openMirrorDb,
  putMirrorMatchRecord,
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
      'calibration_runs',
      'feedback',
      'mirror_matches',
      'players',
      'style_vectors',
    ]);

    const calibrationTx = db.transaction('calibration_runs', 'readonly');
    expect(indexNames(calibrationTx.objectStore('calibration_runs'))).toEqual(['started_at']);
    await calibrationTx.done;

    const styleTx = db.transaction('style_vectors', 'readonly');
    expect(indexNames(styleTx.objectStore('style_vectors'))).toEqual(['computed_at']);
    await styleTx.done;
  });

  it('reopens idempotently without dropping existing rows', async () => {
    const dbName = nextDbName();
    const player: PlayerRecord = {
      id: 'player-1',
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
