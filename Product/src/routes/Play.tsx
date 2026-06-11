import { lazy, Suspense, useEffect, useState } from 'react';
import { AnalysisPanel } from '../components/Analysis/AnalysisPanel';
import { BoardView } from '../components/Board/BoardView';
import { BattlefieldControls } from '../three/BattlefieldControls';
import { BattlefieldErrorBoundary, BattlefieldFallback } from '../three/BattlefieldFallback';
import { useBattlefieldSettings } from '../three/useBattlefieldSettings';

// three.js never enters the main bundle; 2D users pay zero cost.
const BattlefieldScene = lazy(() => import('../three/BattlefieldScene'));
import { PageFrame } from '../components/layout/PageFrame';
import { Badge } from '../components/ui/Badge';
import { Button, ButtonLink } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { Select } from '../components/ui/Select';
import { TableCard } from '../components/ui/TableCard';
import { getLocalMatchesForPlayer, type LocalMatchRecord } from '../data/db';
import { getStockfishDiagnostics } from '../engine/stockfishBridge';
import { isStandardTheme, loadThemeManifest } from '../lib/theme';
import { useAudioFx } from '../audio/useAudioFx';
import { useGameStore, type Difficulty } from '../state/gameStore';
import { usePlayerStore } from '../state/playerStore';
import { useSettingsStore } from '../state/settingsStore';

declare global {
  interface Window {
    __MIRROR_PLAY_TEST__?: {
      startGame: (side: 'white' | 'black' | 'random', difficulty?: Difficulty) => void;
      makePlayerMove: (from: string, to: string, promotion?: 'q' | 'r' | 'b' | 'n') => boolean;
      forceGameOverForLayout: (recordId: string) => void;
      getState: () => {
        status: string;
        playerColor: string;
        engineThinking: boolean;
        enginePhase: string;
        engineError: string | null;
        history: string[];
        fen: string;
        diagnostics: ReturnType<typeof getStockfishDiagnostics>;
      };
    };
  }
}

const DIFFICULTY_OPTIONS: Array<{ value: Difficulty; label: string }> = [
  { value: 'Beginner', label: 'Beginner' },
  { value: 'Casual', label: 'Casual' },
  { value: 'Club', label: 'Club' },
  { value: 'Strong', label: 'Strong' },
];

export default function Play() {
  const status = useGameStore((s) => s.status);
  const result = useGameStore((s) => s.result);
  const playerColor = useGameStore((s) => s.playerColor);
  const engineThinking = useGameStore((s) => s.engineThinking);
  const enginePhase = useGameStore((s) => s.enginePhase);
  const engineError = useGameStore((s) => s.engineError);
  const engineErrorDetails = useGameStore((s) => s.engineErrorDetails);
  const startGame = useGameStore((s) => s.startGame);
  const resign = useGameStore((s) => s.resign);
  const claimDraw = useGameStore((s) => s.claimDraw);
  const exportPgn = useGameStore((s) => s.exportPgn);
  const makePlayerMove = useGameStore((s) => s.makePlayerMove);
  const fen = useGameStore((s) => s.fen);
  const history = useGameStore((s) => s.history);
  const currentDifficulty = useGameStore((s) => s.difficulty);
  const savedRecordId = useGameStore((s) => s.savedRecordId);

  useAudioFx(history);

  const activeTheme = useSettingsStore((s) => s.activeTheme);
  const setActiveTheme = useSettingsStore((s) => s.setActiveTheme);
  const activePlayerId = usePlayerStore((s) => s.activePlayerId);

  const [themeManifest, setThemeManifest] = useState<Awaited<ReturnType<typeof loadThemeManifest>>>(null);
  const [themeError, setThemeError] = useState<string | null>(null);
  const [localMatches, setLocalMatches] = useState<LocalMatchRecord[]>([]);
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>('Club');
  const battlefield = useBattlefieldSettings();

  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has('stockfishBootCheck')) return;

    window.__MIRROR_PLAY_TEST__ = {
      startGame,
      makePlayerMove,
      forceGameOverForLayout: (recordId: string) => {
        useGameStore.setState({
          status: 'game-over',
          result: 'Draw',
          resultLabel: 'draw',
          playerColor: 'white',
          engineThinking: false,
          enginePhase: 'idle',
          engineError: null,
          savedRecordId: recordId,
          history: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6'],
          difficulty: 'Club',
        });
      },
      getState: () => {
        const state = useGameStore.getState();
        return {
          status: state.status,
          playerColor: state.playerColor,
          engineThinking: state.engineThinking,
          enginePhase: state.enginePhase,
          engineError: state.engineError,
          history: [...state.history],
          fen: state.fen,
          diagnostics: getStockfishDiagnostics(),
        };
      },
    };

    return () => {
      delete window.__MIRROR_PLAY_TEST__;
    };
  }, [makePlayerMove, startGame]);

  useEffect(() => {
    if (status === 'idle') {
      startGame('random', selectedDifficulty);
    }
  }, [selectedDifficulty, startGame, status]);

  useEffect(() => {
    let cancelled = false;
    async function loadTheme() {
      if (isStandardTheme(activeTheme)) {
        setThemeManifest(null);
        setThemeError(null);
        return;
      }
      try {
        const manifest = await loadThemeManifest(activeTheme);
        if (!cancelled) {
          setThemeManifest(manifest);
          setThemeError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setThemeManifest(null);
          setThemeError(error instanceof Error ? error.message : 'Failed to load theme.');
        }
      }
    }
    void loadTheme();
    return () => {
      cancelled = true;
    };
  }, [activeTheme]);

  useEffect(() => {
    if (!activePlayerId) return;
    if (status === 'game-over' || status === 'idle') {
      void getLocalMatchesForPlayer(activePlayerId).then((matches) => setLocalMatches(matches));
    }
  }, [activePlayerId, status]);

  const statusLabel = getStatusLabel(status, result, engineThinking, enginePhase);
  const statusVariant = enginePhase === 'unavailable' || enginePhase === 'retry-failed' ? 'danger' : 'active';
  const activeThemeLabel = activeTheme === 'mahabharata' ? 'Kurukshetra' : 'Classic';

  const handleDownloadPgn = () => {
    const pgn = exportPgn();
    const blob = new Blob([pgn], { type: 'application/x-chess-pgn' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mirror-game-${Date.now()}.pgn`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const handleExportJson = (match: LocalMatchRecord) => {
    const exportRecord = {
      id: match.id,
      mode: match.mode,
      side: match.side,
      actual_side: match.actual_side,
      difficulty: match.difficulty,
      result: match.result,
      pgn: match.pgn,
      move_count: match.move_count,
      created_at: match.created_at,
      completed_at: match.completed_at,
      engine_settings: {
        difficulty: match.difficulty,
      },
    };
    const json = JSON.stringify(exportRecord, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${match.id}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handlePromotionCheck = (sourceSquare: string, targetSquare: string, piece: string): boolean => {
    return Boolean(sourceSquare && targetSquare && piece);
  };

  return (
    <PageFrame className="play-page">
      {/* Compact context bar — the board is the hero on /play (Phase 4/10). */}
      <header className="play-context" data-qa="play-context">
        <div className="play-context__title">
          <h1>Play</h1>
          <span>Stockfish · Local</span>
        </div>
        <div className="play-status-strip" data-qa="play-status-strip">
          <Badge variant="neutral">You play {playerColor === 'white' ? 'White' : 'Black'}</Badge>
          <Badge variant="info">Stockfish {currentDifficulty}</Badge>
          <Badge variant="neutral">{activeThemeLabel}</Badge>
          <Badge variant={statusVariant}>{statusLabel}</Badge>
          <BattlefieldControls
            mode={battlefield.requestedMode}
            setMode={battlefield.setRequestedMode}
            webGlAvailable={battlefield.webGlAvailable}
          />
        </div>
      </header>

      <div className="play play-layout" data-qa="play-layout">
        <aside className="play-sidebar" data-qa="play-controls">
          <Card className="play-control-card" variant="game-panel">
            <h2 className="play-title">Match controls</h2>
            <dl className="play-meta play-meta--chips">
              <div>
                <dt>You play</dt>
                <dd>{playerColor === 'white' ? 'White' : 'Black'}</dd>
              </div>
              <div>
                <dt>Opponent</dt>
                <dd>Stockfish ({currentDifficulty})</dd>
              </div>
              <div>
                <dt>Theme</dt>
                <dd>{activeThemeLabel}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{statusLabel}</dd>
              </div>
            </dl>

            {engineError ? (
              <section className="ui-alert ui-alert--danger" data-qa="engine-error">
                <strong>{engineError}</strong>
                {import.meta.env.DEV && engineErrorDetails ? (
                  <details>
                    <summary>Debug details</summary>
                    <pre>{engineErrorDetails}</pre>
                  </details>
                ) : null}
                {/* Engine failure must always be actionable (Play contract). */}
                <div className="play-action-group play-action-group--inline">
                  <Button onClick={() => startGame(playerColor, currentDifficulty)} variant="primary">
                    Retry engine
                  </Button>
                  <ButtonLink to="/stockfish-diagnostics" variant="secondary">
                    Open Diagnostics
                  </ButtonLink>
                </div>
              </section>
            ) : null}

            <SegmentedControl
              label="Difficulty"
              onChange={setSelectedDifficulty}
              options={DIFFICULTY_OPTIONS}
              value={selectedDifficulty}
            />

            <Select
              className="ui-field"
              label="Board theme"
              onChange={(event) => setActiveTheme(event.target.value)}
              options={[
                { value: 'standard', label: 'Classic' },
                { value: 'mahabharata', label: 'Kurukshetra' },
              ]}
              value={activeTheme}
            />

            <div className="play-action-group" aria-label="New game actions">
              <Button fullWidth onClick={() => startGame('white', selectedDifficulty)} variant="primary">
                New game - White
              </Button>
              <Button fullWidth onClick={() => startGame('black', selectedDifficulty)} variant="secondary">
                New game - Black
              </Button>
              <Button fullWidth onClick={() => startGame('random', selectedDifficulty)} variant="ghost">
                New game - Random
              </Button>
            </div>

            {status === 'playing' ? (
              <div className="play-action-group play-action-group--inline">
                <Button onClick={resign} variant="danger">
                  Resign
                </Button>
                <Button onClick={claimDraw} variant="ghost">
                  Claim Draw
                </Button>
              </div>
            ) : null}

            <Button fullWidth onClick={handleDownloadPgn} variant="ghost">
              Download PGN
            </Button>
          </Card>
        </aside>

        <section className="play-board-wrap" data-qa="play-board">
          <Card className="play-board-card" variant="battlefield">
            {battlefield.effectiveMode === '3d' ? (
              <BattlefieldErrorBoundary
                fallback={
                  <BattlefieldFallback reason="load-error">
                    <BoardView
                      engineThinking={engineThinking}
                      fen={fen}
                      onPieceDrop={(from, to, promotion) => makePlayerMove(from, to, promotion)}
                      onPromotionCheck={handlePromotionCheck}
                      onPromotionPieceSelect={() => false}
                      playerColor={playerColor}
                      status={status}
                      themeError={themeError}
                      themeManifest={themeManifest}
                    />
                  </BattlefieldFallback>
                }
              >
                <Suspense fallback={<div className="battlefield-loading" role="status">Preparing battlefield…</div>}>
                  <BattlefieldScene
                    engineThinking={engineThinking}
                    fen={fen}
                    onMove={(from, to, promotion) => makePlayerMove(from, to, promotion)}
                    playerColor={playerColor}
                    reducedMotion={battlefield.reducedMotion}
                    status={status}
                  />
                </Suspense>
              </BattlefieldErrorBoundary>
            ) : (
              <BattlefieldFallback reason={battlefield.fallbackReason}>
                <BoardView
                  engineThinking={engineThinking}
                  fen={fen}
                  onPieceDrop={(from, to, promotion) => makePlayerMove(from, to, promotion)}
                  onPromotionCheck={handlePromotionCheck}
                  onPromotionPieceSelect={() => false}
                  playerColor={playerColor}
                  status={status}
                  themeError={themeError}
                  themeManifest={themeManifest}
                />
              </BattlefieldFallback>
            )}
          </Card>
        </section>

        <aside className="play-side-panel" data-qa="play-history">
          <Card className="play-review-card" variant="game-panel">
            <h2>Review tools</h2>
            {status === 'game-over' && result ? <Badge variant="success">Game over - {result}</Badge> : null}
            {status === 'game-over' && activePlayerId && savedRecordId ? (
              <>
                <AnalysisPanel
                  matchId={savedRecordId}
                  matchType="computer"
                  pgn={exportPgn()}
                  playerId={activePlayerId}
                />
                <ButtonLink to={`/review/local_match/${savedRecordId}`} variant="primary">
                  Open Game Review Pro
                </ButtonLink>
              </>
            ) : (
              <EmptyState eyebrow="After the game" title="Review unlocks at game end">
                Finish this match to analyze it locally and open Game Review Pro.
              </EmptyState>
            )}
          </Card>

          <Card className="play-move-card" variant="default">
            <h2>Move history</h2>
            {history.length > 0 ? (
              <ol className="play-move-list">
                {Array.from({ length: Math.ceil(history.length / 2) }).map((_, index) => (
                  <li key={index}>
                    <span>{index + 1}.</span>
                    <strong>{history[index * 2]}</strong>
                    {history[index * 2 + 1] ? <strong>{history[index * 2 + 1]}</strong> : null}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="ui-muted">Moves will appear here as the game develops.</p>
            )}
          </Card>

          {localMatches.length > 0 ? (
            <TableCard
              className="play-history-card"
              description="Contained locally. Scroll inside the card if columns need more room."
              title="Local Match History"
            >
              <table className="ui-data-table play-history-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Mode</th>
                    <th>Side</th>
                    <th>Difficulty</th>
                    <th>Moves</th>
                    <th>Result</th>
                    <th>Export</th>
                    <th>Review</th>
                  </tr>
                </thead>
                <tbody>
                  {localMatches.slice(0, 10).map((match) => (
                    <tr key={match.id}>
                      <td>{new Date(match.created_at).toLocaleDateString()}</td>
                      <td>{match.mode}</td>
                      <td>{match.side}</td>
                      <td>{match.difficulty}</td>
                      <td>{match.move_count}</td>
                      <td>{match.result}</td>
                      <td>
                        <Button onClick={() => handleExportJson(match)} size="compact" variant="ghost">
                          JSON
                        </Button>
                      </td>
                      <td>
                        <ButtonLink size="compact" to={`/review/local_match/${match.id}`} variant="secondary">
                          Review
                        </ButtonLink>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableCard>
          ) : null}
        </aside>
      </div>
    </PageFrame>
  );
}

function getStatusLabel(
  status: ReturnType<typeof useGameStore.getState>['status'],
  result: ReturnType<typeof useGameStore.getState>['result'],
  engineThinking: boolean,
  enginePhase: ReturnType<typeof useGameStore.getState>['enginePhase']
): string {
  if (status === 'idle') return 'Setting up';
  if (status === 'game-over') return result ?? 'Game over';
  if (enginePhase === 'unavailable' || enginePhase === 'retry-failed') return 'Engine unavailable';
  if (!engineThinking) return 'Your move';
  if (enginePhase === 'starting') return 'Engine starting';
  if (enginePhase === 'restarting') return 'Engine restarting';
  return 'Engine thinking';
}
