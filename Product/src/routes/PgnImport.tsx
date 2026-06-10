import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getAllLocalPlayers,
  getImportedGamesForPlayer,
  type ImportedGameRecord,
  type ImportedGameSource,
  type PlayerRecord,
} from '../data/db';
import {
  analyzeImportedGames,
  buildImportReportMarkdown,
  previewPgnImport,
  savePgnImport,
} from '../import/pgnImportService';
import type { PgnImportPreview, PgnImportSaveResult } from '../import/pgnTypes';
import { usePlayerStore } from '../state/playerStore';

const SOURCE_LABELS: Array<{ value: ImportedGameSource; label: string }> = [
  { value: 'manual_pgn', label: 'Manual PGN' },
  { value: 'chess_com_pgn', label: 'Chess.com PGN export' },
  { value: 'lichess_pgn', label: 'Lichess PGN export' },
  { value: 'unknown_pgn', label: 'Unknown' },
];

export default function PgnImport() {
  const activePlayer = usePlayerStore((state) => state.activePlayer);
  const activePlayerId = usePlayerStore((state) => state.activePlayerId);
  const setActivePlayer = usePlayerStore((state) => state.setActivePlayer);
  const [players, setPlayers] = useState<PlayerRecord[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState(activePlayerId ?? '');
  const [pgnText, setPgnText] = useState('');
  const [source, setSource] = useState<ImportedGameSource>('manual_pgn');
  const [originalFilename, setOriginalFilename] = useState<string | undefined>();
  const [playerNameHint, setPlayerNameHint] = useState(activePlayer?.display_name ?? '');
  const [preview, setPreview] = useState<PgnImportPreview | null>(null);
  const [saveResult, setSaveResult] = useState<PgnImportSaveResult | null>(null);
  const [latestGames, setLatestGames] = useState<ImportedGameRecord[]>([]);
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [analysisStatus, setAnalysisStatus] = useState<string>('');

  const refreshPlayers = useCallback(async () => {
    const rows = await getAllLocalPlayers();
    setPlayers(rows);
    setSelectedPlayerId((current) => current || rows[0]?.id || '');
  }, []);

  const refreshImportedGames = useCallback(async (playerId: string) => {
    const rows = await getImportedGamesForPlayer(playerId, 8);
    setLatestGames(rows);
  }, []);

  useEffect(() => {
    void refreshPlayers();
  }, [refreshPlayers]);

  useEffect(() => {
    if (activePlayerId) {
      setSelectedPlayerId(activePlayerId);
    }
    if (activePlayer?.display_name && !playerNameHint) {
      setPlayerNameHint(activePlayer.display_name);
    }
  }, [activePlayer, activePlayerId, playerNameHint]);

  useEffect(() => {
    if (selectedPlayerId) {
      void refreshImportedGames(selectedPlayerId);
    }
  }, [refreshImportedGames, selectedPlayerId]);

  const reportMarkdown = useMemo(
    () => (saveResult ? buildImportReportMarkdown(saveResult.summary) : ''),
    [saveResult]
  );

  function handlePreview() {
    setError('');
    setSaveResult(null);
    const nextPreview = previewPgnImport(pgnText);
    setPreview(nextPreview);
    setStatus(
      nextPreview.detected_count === 0
        ? 'No PGN games detected yet.'
        : `Detected ${nextPreview.detected_count} game(s): ${nextPreview.valid_count} valid, ${nextPreview.invalid_count} invalid, ${nextPreview.partial_count} partial.`
    );
  }

  async function handleImport() {
    if (!preview || !selectedPlayerId) return;
    setError('');
    setStatus('Saving imported games locally...');
    try {
      const result = await savePgnImport({
        playerId: selectedPlayerId,
        source,
        games: preview.games,
        originalFilename,
        playerNameHint,
      });
      setSaveResult(result);
      setStatus(`Saved ${result.summary.games_saved} imported game(s) locally.`);
      await setActivePlayer(selectedPlayerId);
      await refreshImportedGames(selectedPlayerId);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Import failed.');
    }
  }

  async function handleAnalyzeImported() {
    if (!saveResult || !selectedPlayerId) return;
    setAnalysisStatus('Analyzing up to 5 valid imported games sequentially...');
    const result = await analyzeImportedGames(
      selectedPlayerId,
      saveResult.records.map((record) => record.id),
      {
        limit: 5,
        onProgress: (progress) => {
          if (progress.current_move && progress.total_moves) {
            setAnalysisStatus(
              `Analyzing game ${progress.analyzed_games + 1} of ${progress.total_games}: move ${progress.current_move}/${progress.total_moves}`
            );
          }
        },
      }
    );
    setAnalysisStatus(
      `Analysis complete: ${result.analyzed} analyzed, ${result.failed} failed, ${result.skipped} skipped.`
    );
    await refreshImportedGames(selectedPlayerId);
  }

  function handleFileUpload(file: File | null) {
    if (!file) return;
    setOriginalFilename(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setPgnText(String(reader.result ?? ''));
      setPreview(null);
      setSaveResult(null);
      setStatus(`Loaded ${file.name}. Preview before importing.`);
    };
    reader.onerror = () => setError(`Could not read ${file.name}.`);
    reader.readAsText(file);
  }

  if (players.length === 0) {
    return (
      <section className="import-pgn">
        <div className="import-pgn__header">
          <p className="home-eyebrow">Local PGN import</p>
          <h1>Import games</h1>
          <p>Create a local player before importing PGNs. MIRROR keeps imported games on this device.</p>
          <Link className="btn btn-primary" to="/onboarding">
            Create local player
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="import-pgn">
      <div className="import-pgn__header">
        <p className="home-eyebrow">Local-first fingerprint builder</p>
        <h1>Import games</h1>
        <p>
          Paste or upload user-provided PGN files. MIRROR validates games locally, preserves raw PGN text,
          and only updates StyleVector from valid games with user-attributed moves.
        </p>
      </div>

      <div className="import-pgn__layout">
        <div className="import-pgn__panel">
          <label className="import-pgn__label">
            Active player
            <select
              value={selectedPlayerId}
              onChange={(event) => setSelectedPlayerId(event.target.value)}
            >
              {players.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.display_name}
                </option>
              ))}
            </select>
          </label>

          <label className="import-pgn__label">
            Player name in PGN
            <input
              value={playerNameHint}
              onChange={(event) => setPlayerNameHint(event.target.value)}
              placeholder="Name as it appears in White/Black header"
            />
          </label>

          <label className="import-pgn__label">
            Source
            <select value={source} onChange={(event) => setSource(event.target.value as ImportedGameSource)}>
              {SOURCE_LABELS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="import-pgn__label">
            Upload .pgn file
            <input
              type="file"
              accept=".pgn,.txt"
              onChange={(event) => handleFileUpload(event.currentTarget.files?.[0] ?? null)}
            />
          </label>

          <label className="import-pgn__label">
            Paste PGN text
            <textarea
              value={pgnText}
              onChange={(event) => {
                setPgnText(event.target.value);
                setPreview(null);
                setSaveResult(null);
              }}
              rows={14}
              spellCheck={false}
              placeholder={'[Event "Training game"]\n[White "Your PGN Name"]\n[Black "Opponent"]\n[Result "1-0"]\n\n1. e4 e5 2. Nf3 Nc6 1-0'}
            />
          </label>

          <div className="import-pgn__actions">
            <button className="btn btn-secondary" type="button" onClick={handlePreview}>
              Preview import
            </button>
            <button
              className="btn btn-primary"
              type="button"
              onClick={handleImport}
              disabled={!preview || preview.detected_count === 0}
            >
              Import locally
            </button>
          </div>

          <p className="import-pgn__privacy">
            Local-only: no OAuth, no scraping, no cloud upload, and no account login required.
          </p>
          {status && <p className="import-pgn__status">{status}</p>}
          {error && <p className="mirror-alert">{error}</p>}
        </div>

        <div className="import-pgn__panel">
          <h2>Import preview</h2>
          {preview ? (
            <>
              <div className="import-pgn__stats">
                <Metric label="Detected" value={preview.detected_count} />
                <Metric label="Valid" value={preview.valid_count} />
                <Metric label="Invalid" value={preview.invalid_count} />
                <Metric label="Partial" value={preview.partial_count} />
              </div>
              <div className="import-pgn__game-list">
                {preview.games.map((game, index) => (
                  <article key={`${game.headers.Event ?? 'game'}-${index}`} className="import-pgn__game">
                    <strong>
                      Game {index + 1}: {game.headers.White ?? 'Unknown'} vs {game.headers.Black ?? 'Unknown'}
                    </strong>
                    <span>{game.legal_status}</span>
                    <span>{game.move_count} ply</span>
                    <span>{game.result ?? 'No result marker'}</span>
                    {game.validation_errors.length > 0 && (
                      <p>{game.validation_errors.join(' ')}</p>
                    )}
                  </article>
                ))}
              </div>
            </>
          ) : (
            <p className="import-pgn__muted">Preview a pasted or uploaded PGN before saving.</p>
          )}
        </div>
      </div>

      {saveResult && (
        <div className="import-pgn__layout import-pgn__layout--bottom">
          <div className="import-pgn__panel">
            <h2>Post-import summary</h2>
            <pre className="import-pgn__report">{reportMarkdown}</pre>
            <button className="btn btn-secondary" type="button" onClick={handleAnalyzeImported}>
              Analyze first 5 valid imported games
            </button>
            {analysisStatus && <p className="import-pgn__status">{analysisStatus}</p>}
          </div>
          <div className="import-pgn__panel">
            <h2>Latest imported games</h2>
            <ImportedGamesList games={latestGames} />
          </div>
        </div>
      )}

      {!saveResult && latestGames.length > 0 && (
        <div className="import-pgn__panel import-pgn__panel--wide">
          <h2>Latest imported games</h2>
          <ImportedGamesList games={latestGames} />
        </div>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function ImportedGamesList({ games }: { games: ImportedGameRecord[] }) {
  if (games.length === 0) {
    return <p className="import-pgn__muted">No imported games saved yet.</p>;
  }

  return (
    <div className="import-pgn__table-wrap">
      <table className="import-pgn__table">
        <thead>
          <tr>
            <th>Imported</th>
            <th>Source</th>
            <th>Result</th>
            <th>Moves</th>
            <th>Validation</th>
            <th>Analysis</th>
            <th>Review</th>
          </tr>
        </thead>
        <tbody>
          {games.map((game) => (
            <tr key={game.id}>
              <td>{new Date(game.imported_at).toLocaleDateString()}</td>
              <td>{game.source}</td>
              <td>{game.result ?? 'unknown'}</td>
              <td>{game.move_count}</td>
              <td>{game.legal_status}</td>
              <td>{game.analysis_status}</td>
              <td>
                {game.legal_status === 'valid' ? (
                  <Link to={`/review/imported_game/${game.id}`}>Review</Link>
                ) : (
                  <span className="import-pgn__muted">Invalid</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
