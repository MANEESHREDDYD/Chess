import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BoardView } from '../components/Board/BoardView';
import { getGameReviewForSource } from '../data/db';
import {
  compareRetryMove,
  createGameReview,
  exportGameReviewMarkdown,
} from '../review/gameReviewService';
import type { GameReviewRecord, MoveReview, RetryAttemptResult, ReviewSourceType } from '../review/reviewTypes';
import { usePlayerStore } from '../state/playerStore';

const REVIEW_SOURCE_TYPES: ReviewSourceType[] = ['local_match', 'mirror_match', 'imported_game'];
const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export default function GameReview() {
  const { sourceType: sourceTypeParam, sourceId } = useParams();
  const activePlayerId = usePlayerStore((state) => state.activePlayerId);
  const sourceType = REVIEW_SOURCE_TYPES.includes(sourceTypeParam as ReviewSourceType)
    ? (sourceTypeParam as ReviewSourceType)
    : null;

  const [review, setReview] = useState<GameReviewRecord | null>(null);
  const [selectedPly, setSelectedPly] = useState<number | null>(null);
  const [retryMove, setRetryMove] = useState<MoveReview | null>(null);
  const [retryResult, setRetryResult] = useState<RetryAttemptResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState({ reviewed_moves: 0, total_moves: 0 });
  const [error, setError] = useState<string | null>(null);

  const loadExistingReview = useCallback(async () => {
    if (!sourceType || !sourceId) return;
    setError(null);
    try {
      const row = await getGameReviewForSource(sourceType, sourceId);
      setReview(row ?? null);
      setSelectedPly(row?.move_reviews[0]?.ply ?? null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load review.');
    }
  }, [sourceId, sourceType]);

  useEffect(() => {
    void loadExistingReview();
  }, [loadExistingReview]);

  const selectedMove = useMemo(() => {
    if (!review) return null;
    return review.move_reviews.find((move) => move.ply === selectedPly) ?? review.move_reviews[0] ?? null;
  }, [review, selectedPly]);

  const replayFen = retryMove?.fen_before ?? selectedMove?.fen_after ?? selectedMove?.fen_before ?? STARTING_FEN;

  async function handleAnalyze() {
    if (!activePlayerId || !sourceType || !sourceId) return;
    setIsAnalyzing(true);
    setError(null);
    setProgress({ reviewed_moves: 0, total_moves: 0 });
    try {
      const created = await createGameReview({
        playerId: activePlayerId,
        sourceType,
        sourceId,
        depth: 8,
        maxMoves: 80,
        onProgress: setProgress,
      });
      setReview(created);
      setSelectedPly(created.move_reviews[0]?.ply ?? null);
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : 'Review failed.');
    } finally {
      setIsAnalyzing(false);
    }
  }

  function handleExportMarkdown() {
    if (!review) return;
    const markdown = exportGameReviewMarkdown(review);
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `mirror-game-review-${date}.md`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function handleRetry(move: MoveReview) {
    setRetryMove(move);
    setRetryResult(null);
    setSelectedPly(move.ply);
  }

  function handleRetryDrop(from: string, to: string, promotion?: 'q' | 'r' | 'b' | 'n'): boolean {
    if (!retryMove) return false;
    const result = compareRetryMove(retryMove, `${from}${to}${promotion ?? ''}`);
    setRetryResult(result);
    return result.status === 'correct' || result.status === 'close' || result.status === 'still_risky';
  }

  if (!sourceType || !sourceId) {
    return (
      <section className="game-review">
        <p className="home-eyebrow">Game Review Pro</p>
        <h1>Review source not recognized</h1>
        <p>Open a review from a completed match, Mirror match, or valid imported game.</p>
      </section>
    );
  }

  if (!activePlayerId) {
    return (
      <section className="game-review">
        <p className="home-eyebrow">Game Review Pro</p>
        <h1>Create a local player first</h1>
        <p>MIRROR reviews stay local and need an active local player profile.</p>
        <Link className="btn btn-primary" to="/onboarding">
          Create local player
        </Link>
      </section>
    );
  }

  return (
    <section className="game-review">
      <header className="game-review__header">
        <p className="home-eyebrow">Game Review Pro</p>
        <h1>Review your game</h1>
        <p>
          Local Stockfish analysis, deterministic MIRROR move labels, StyleVector notes, and direct
          practice recommendations. Runtime GenAI is not used.
        </p>
      </header>

      {error ? <p className="mirror-alert">{error}</p> : null}

      {!review ? (
        <div className="game-review__empty">
          <h2>No saved review yet</h2>
          <p>
            Analyze this source locally to create a replay, CP-loss summary, key moments, and practice plan.
          </p>
          <button className="btn btn-primary" type="button" onClick={handleAnalyze} disabled={isAnalyzing}>
            {isAnalyzing ? 'Analyzing...' : 'Analyze game'}
          </button>
          {isAnalyzing ? (
            <p className="play-note">
              Reviewed {progress.reviewed_moves} of {progress.total_moves || '?'} moves...
            </p>
          ) : null}
        </div>
      ) : (
        <div className="game-review__layout">
          <aside className="game-review__summary">
            <div className="game-review__metric-grid">
              <Metric label="White accuracy" value={`${review.accuracy_white ?? 0}%`} />
              <Metric label="Black accuracy" value={`${review.accuracy_black ?? 0}%`} />
              <Metric label="White CP loss" value={String(review.average_cp_loss_white ?? 0)} />
              <Metric label="Black CP loss" value={String(review.average_cp_loss_black ?? 0)} />
            </div>

            <section className="mirror-panel">
              <h3>Key moments</h3>
              {review.key_moments.length > 0 ? (
                <div className="game-review__moment-list">
                  {review.key_moments.map((moment) => (
                    <button
                      key={moment.id}
                      type="button"
                      className="game-review__moment"
                      onClick={() => setSelectedPly(moment.ply)}
                    >
                      <strong>Move {moment.move_number}: {moment.san}</strong>
                      <span>{moment.reason}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p>No key moments detected.</p>
              )}
            </section>

            <section className="mirror-panel">
              <h3>Phase summary</h3>
              <p>{review.phase_summary.summary}</p>
              <p>Opening: {review.phase_summary.opening.average_cp_loss} avg CP loss</p>
              <p>Middlegame: {review.phase_summary.middlegame.average_cp_loss} avg CP loss</p>
              <p>Endgame: {review.phase_summary.endgame.average_cp_loss} avg CP loss</p>
            </section>

            <section className="mirror-panel">
              <h3>Personalized notes</h3>
              <p>{review.personalized_summary.headline}</p>
              <ul className="game-review__bullets">
                {review.personalized_summary.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </section>

            <section className="mirror-panel">
              <h3>Next actions</h3>
              <div className="game-review__actions">
                {review.recommended_actions.map((action) => (
                  <div key={action.id} className="game-review__action">
                    <strong>{action.title}</strong>
                    <span>{action.description}</span>
                    {action.route ? <Link to={action.route}>Open</Link> : null}
                  </div>
                ))}
              </div>
            </section>

            <button className="btn btn-secondary" type="button" onClick={handleExportMarkdown}>
              Export review summary
            </button>
          </aside>

          <div className="game-review__board-area">
            <BoardView
              fen={replayFen}
              playerColor={selectedMove?.side ?? 'white'}
              status={retryMove ? 'playing' : 'idle'}
              engineThinking={false}
              onPieceDrop={handleRetryDrop}
              onPromotionCheck={() => false}
              onPromotionPieceSelect={() => false}
              themeManifest={null}
            />

            {selectedMove ? (
              <section className="game-review__selected">
                <div>
                  <p className={`game-review__pill game-review__pill--${selectedMove.classification}`}>
                    {selectedMove.classification.replace(/_/g, ' ')}
                  </p>
                  <h2>
                    Move {selectedMove.move_number}{selectedMove.side === 'black' ? '...' : '.'} {selectedMove.san}
                  </h2>
                  <p>{selectedMove.explanation}</p>
                </div>
                <div className="game-review__evidence">
                  {selectedMove.evidence.slice(0, 5).map((entry) => (
                    <span key={entry}>{entry}</span>
                  ))}
                </div>
                {selectedMove.stylevector_note ? <p className="play-note">{selectedMove.stylevector_note}</p> : null}
                {selectedMove.retry_available ? (
                  <button className="btn btn-primary" type="button" onClick={() => handleRetry(selectedMove)}>
                    Retry this move
                  </button>
                ) : null}
                {retryMove?.ply === selectedMove.ply && retryResult ? (
                  <p className="game-review__retry-result">
                    {retryResult.message}
                  </p>
                ) : null}
              </section>
            ) : null}

            <section className="game-review__timeline">
              <h2>Move timeline</h2>
              <div className="game-review__moves">
                {review.move_reviews.map((move) => (
                  <button
                    key={move.ply}
                    type="button"
                    className={`game-review__move ${selectedPly === move.ply ? 'is-selected' : ''}`}
                    onClick={() => {
                      setSelectedPly(move.ply);
                      setRetryMove(null);
                      setRetryResult(null);
                    }}
                  >
                    <span>{move.move_number}{move.side === 'black' ? '...' : '.'}</span>
                    <strong>{move.san}</strong>
                    <em>{move.classification.replace(/_/g, ' ')}</em>
                  </button>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
