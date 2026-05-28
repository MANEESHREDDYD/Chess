import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Chess } from 'chess.js';
import { BoardView } from '../components/Board/BoardView';
import {
  buildSelfRecognitionChallenge,
  type SelfRecognitionChallenge,
} from '../components/Mirror/selfRecognition';
import {
  renderScoutingCardPng,
  scoutingCardShareText,
  summarizeMirrorRecord,
  type MirrorRecordSummary,
} from '../components/Mirror/scoutingCard';
import { generateSummary } from '../components/Mirror/styleSummary';
import {
  getLatestStyleVectorRecord,
  getMirrorMatchesForPlayer,
  logAnonymousEvent,
  mergeMirrorMatchMetadata,
  putMirrorMatchRecord,
  putStyleVectorRecord,
  setCurrentStyleVector,
  type StyleVectorRecord,
} from '../data/db';
import {
  createMirrorOpponent,
  describeMirrorDecision,
  summarizeMirrorReranks,
  type MirrorDecisionTrace,
  type MirrorRerankSummary,
  type MirrorOpponentProvider,
} from '../engine/mirrorOpponent';
import { stopThinking } from '../engine/stockfishBridge';
import { isStandardTheme, loadThemeManifest } from '../lib/theme';
import { sharpenMirrorVector } from '../ml/evolvingMirror';
import { useSettingsStore } from '../state/settingsStore';

type GameStatus = 'idle' | 'playing' | 'game-over';
type MirrorResult = 'You won' | 'Mirror won' | 'Draw' | 'Game ended';
type Promotion = 'q' | 'r' | 'b' | 'n';
type PendingPromotion = { from: string; to: string } | null;

type StoredMirrorTrace = MirrorDecisionTrace & {
  moveNumber: number;
  fenBefore: string;
  ply: number;
};

const LOCAL_PLAYER_ID = 'local-player';
const FEEDBACK_FORM_URL = import.meta.env.VITE_FEEDBACK_FORM_URL?.trim() ?? '';

export default function Mirror() {
  const activeTheme = useSettingsStore((state) => state.activeTheme);
  const setActiveTheme = useSettingsStore((state) => state.setActiveTheme);
  const gameRef = useRef(new Chess());
  const gameIdRef = useRef(0);
  const opponentRef = useRef<MirrorOpponentProvider | null>(null);
  const startedAtRef = useRef(new Date().toISOString());
  const persistedRef = useRef(false);
  const mirrorTracesRef = useRef<StoredMirrorTrace[]>([]);

  const [styleRecord, setStyleRecord] = useState<StyleVectorRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fen, setFen] = useState(gameRef.current.fen());
  const [status, setStatus] = useState<GameStatus>('idle');
  const [result, setResult] = useState<MirrorResult | null>(null);
  const [isMirrorThinking, setIsMirrorThinking] = useState(false);
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion>(null);
  const [themeManifest, setThemeManifest] = useState<Awaited<ReturnType<typeof loadThemeManifest>>>(
    null
  );
  const [themeError, setThemeError] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [lastMirrorLine, setLastMirrorLine] = useState<string | null>(null);
  const [rerankSummary, setRerankSummary] = useState<MirrorRerankSummary>({
    totalMirrorMoves: 0,
    overrideCount: 0,
    overrideRate: 0,
    overridesByDimension: {},
  });
  const [currentMatchId, setCurrentMatchId] = useState<string | null>(null);
  const [selfRecognitionChallenge, setSelfRecognitionChallenge] =
    useState<SelfRecognitionChallenge | null>(null);
  const [selfRecognitionResult, setSelfRecognitionResult] = useState<{
    selectedOptionId: string;
    correct: boolean;
  } | null>(null);
  const [evolvingLine, setEvolvingLine] = useState<string | null>(null);
  const [mirrorRecord, setMirrorRecord] = useState<MirrorRecordSummary>({
    playerWins: 0,
    mirrorWins: 0,
    draws: 0,
  });
  const [scoutingCardUrl, setScoutingCardUrl] = useState<string | null>(null);
  const [scoutingCardStatus, setScoutingCardStatus] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadStyleVector() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const row = await getLatestStyleVectorRecord(LOCAL_PLAYER_ID);
        if (cancelled) return;

        setStyleRecord(row);
        if (row) {
          const matches = await getMirrorMatchesForPlayer(row.player_id);
          if (!cancelled) setMirrorRecord(summarizeMirrorRecord(matches));
          opponentRef.current?.dispose?.();
          opponentRef.current = createMirrorOpponent(row.vector);
          stopThinking();
          gameIdRef.current += 1;
          gameRef.current = new Chess();
          startedAtRef.current = new Date().toISOString();
          persistedRef.current = false;
          mirrorTracesRef.current = [];
          setFen(gameRef.current.fen());
          setStatus('playing');
          setResult(null);
          setIsMirrorThinking(false);
          setPendingPromotion(null);
          setExplanation(null);
          setLastMirrorLine(null);
          setRerankSummary(summarizeMirrorReranks([]));
          setCurrentMatchId(null);
          setSelfRecognitionChallenge(null);
          setSelfRecognitionResult(null);
          setEvolvingLine(null);
          setScoutingCardUrl((currentUrl) => {
            if (currentUrl) URL.revokeObjectURL(currentUrl);
            return null;
          });
          setScoutingCardStatus(null);
          setSaveStatus(null);
        } else {
          setStatus('idle');
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'Could not load your style vector.');
          setStatus('idle');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadStyleVector();

    return () => {
      cancelled = true;
      stopThinking();
      opponentRef.current?.dispose?.();
      opponentRef.current = null;
    };
  }, []);

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

  const finishGame = useCallback(
    async (resultLabel: MirrorResult) => {
      if (persistedRef.current || !styleRecord) return;
      persistedRef.current = true;

      const traces = mirrorTracesRef.current;
      const highlightedTrace =
        traces.find((trace) => trace.overrodeStockfish) ??
        traces.find((trace) => trace.styleDimension !== 'engine') ??
        traces[0] ??
        null;
      const summary = summarizeMirrorReranks(traces);
      const explanationText = describeMirrorDecision(
        highlightedTrace,
        highlightedTrace?.moveNumber ?? Math.max(1, Math.ceil(gameRef.current.history().length / 2))
      );
      setExplanation(explanationText);
      setRerankSummary(summary);

      const completedAt = new Date().toISOString();
      const game = gameRef.current;
      game.header(
        'Event',
        'MIRROR MVP match',
        'White',
        'Player',
        'Black',
        'Mirror',
        'Date',
        completedAt.slice(0, 10),
        'Result',
        pgnResultFor(resultLabel)
      );

      try {
        const matchId = makeId('mirror-match');
        const challenge = buildSelfRecognitionChallenge(styleRecord.vector, traces, matchId);
        await putMirrorMatchRecord({
          id: matchId,
          player_id: styleRecord.player_id,
          started_at: startedAtRef.current,
          completed_at: completedAt,
          pgn: game.pgn(),
          result: resultLabel,
          metadata: {
            style_vector_id: styleRecord.id,
            explanation: explanationText,
            mirror_moves: traces,
            rerank_summary: summary,
            self_recognition_options: challenge.options,
            self_recognition_correct_option_id: challenge.correctOptionId,
            mirror_base: 'stockfish-limit-strength',
          },
        });
        await logAnonymousEvent('mirror_played', { mirror_match_id: matchId }).catch(() => undefined);
        const matches = await getMirrorMatchesForPlayer(styleRecord.player_id);
        setMirrorRecord(summarizeMirrorRecord(matches));

        const evolving = sharpenMirrorVector({
          vector: styleRecord.vector,
          result: resultLabel,
          traces,
        });
        const tunedRecord: StyleVectorRecord = {
          id: makeId('style-vector'),
          player_id: styleRecord.player_id,
          source: 'tuned',
          previous_vector_id: styleRecord.id,
          vector: evolving.vector,
          computed_at: new Date(Date.now() + 1).toISOString(),
        };
        await putStyleVectorRecord(tunedRecord);
        await setCurrentStyleVector(styleRecord.player_id, tunedRecord);
        await mergeMirrorMatchMetadata(matchId, {
          tuned_style_vector_id: tunedRecord.id,
          evolving_mirror: {
            previous_style_vector_id: styleRecord.id,
            tuned_style_vector_id: tunedRecord.id,
            dimension: evolving.dimension,
            delta_line: evolving.deltaLine,
          },
        });

        opponentRef.current?.dispose?.();
        opponentRef.current = createMirrorOpponent(tunedRecord.vector);
        setStyleRecord(tunedRecord);
        setCurrentMatchId(matchId);
        setSelfRecognitionChallenge(challenge);
        setSelfRecognitionResult(null);
        setEvolvingLine(evolving.deltaLine);
        setSaveStatus('Match saved. Your Mirror has been sharpened for the next game.');
      } catch (error) {
        setSaveStatus(
          error instanceof Error ? `Match finished, but save failed: ${error.message}` : 'Match finished, but save failed.'
        );
      }
    },
    [styleRecord]
  );

  const settleIfGameOver = useCallback((): boolean => {
    const nextResult = resultForGame(gameRef.current);
    if (!nextResult) return false;

    setStatus('game-over');
    setResult(nextResult);
    setIsMirrorThinking(false);
    void finishGame(nextResult);
    return true;
  }, [finishGame]);

  const requestMirrorMove = useCallback(async () => {
    const opponent = opponentRef.current;
    if (!opponent || status !== 'playing' || gameRef.current.isGameOver()) return;

    const activeGameId = gameIdRef.current;
    const fenBefore = gameRef.current.fen();
    const moveNumber = nextMoveNumber(gameRef.current);
    setIsMirrorThinking(true);
    setLastMirrorLine(null);

    try {
      const mirrorMove = await opponent.getMoveWithTrace(fenBefore, {
        depth: 8,
        timeoutMs: 15_000,
      });
      if (gameIdRef.current !== activeGameId || status !== 'playing') return;

      if (!mirrorMove.move) {
        setStatus('game-over');
        setResult('Game ended');
        await finishGame('Game ended');
        return;
      }

      try {
        gameRef.current.move(uciToMove(mirrorMove.move));
      } catch (error) {
        setLastMirrorLine(
          error instanceof Error
            ? `Mirror produced an invalid move (${mirrorMove.move}): ${error.message}`
            : `Mirror produced an invalid move (${mirrorMove.move}).`
        );
        setIsMirrorThinking(false);
        return;
      }

      if (mirrorMove.trace) {
        const storedTrace: StoredMirrorTrace = {
          ...mirrorMove.trace,
          moveNumber,
          fenBefore,
          ply: gameRef.current.history().length,
        };
        mirrorTracesRef.current.push(storedTrace);
        setRerankSummary(summarizeMirrorReranks(mirrorTracesRef.current));
        setLastMirrorLine(describeMirrorDecision(storedTrace, moveNumber));
      }

      setFen(gameRef.current.fen());
      if (!settleIfGameOver()) {
        setIsMirrorThinking(false);
      }
    } catch (error) {
      if (gameIdRef.current === activeGameId) {
        setLastMirrorLine(
          error instanceof Error ? `Mirror engine error: ${error.message}` : 'Mirror engine error.'
        );
        setIsMirrorThinking(false);
      }
    }
  }, [finishGame, settleIfGameOver, status]);

  const makePlayerMove = useCallback(
    (from: string, to: string, promotion?: Promotion): boolean => {
      if (!styleRecord || status !== 'playing' || isMirrorThinking) return false;
      if (gameRef.current.turn() !== 'w') return false;

      try {
        const move = gameRef.current.move({ from, to, promotion: promotion ?? 'q' });
        if (!move) return false;
      } catch {
        return false;
      }

      setFen(gameRef.current.fen());
      if (!settleIfGameOver()) {
        void requestMirrorMove();
      }
      return true;
    },
    [isMirrorThinking, requestMirrorMove, settleIfGameOver, status, styleRecord]
  );

  const startNewGame = useCallback(() => {
    stopThinking();
    gameIdRef.current += 1;
    gameRef.current = new Chess();
    startedAtRef.current = new Date().toISOString();
    persistedRef.current = false;
    mirrorTracesRef.current = [];
    setFen(gameRef.current.fen());
    setStatus(styleRecord ? 'playing' : 'idle');
    setResult(null);
    setIsMirrorThinking(false);
    setPendingPromotion(null);
    setExplanation(null);
    setLastMirrorLine(null);
    setRerankSummary(summarizeMirrorReranks([]));
    setCurrentMatchId(null);
    setSelfRecognitionChallenge(null);
    setSelfRecognitionResult(null);
    setEvolvingLine(null);
    setScoutingCardUrl((currentUrl) => {
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      return null;
    });
    setScoutingCardStatus(null);
    setSaveStatus(null);
  }, [styleRecord]);

  const handlePromotionCheck = (sourceSquare: string, targetSquare: string, piece: string): boolean => {
    if (piece[1] !== 'P') return false;
    const isWhitePromotion = piece[0] === 'w' && targetSquare[1] === '8';
    if (!isWhitePromotion) return false;

    setPendingPromotion({ from: sourceSquare, to: targetSquare });
    return true;
  };

  const handlePromotionPieceSelect = (piece?: string): boolean => {
    if (!piece || !pendingPromotion) {
      setPendingPromotion(null);
      return false;
    }

    const promotion = piece[1].toLowerCase() as Promotion;
    const ok = makePlayerMove(pendingPromotion.from, pendingPromotion.to, promotion);
    setPendingPromotion(null);
    return ok;
  };

  const handleResign = () => {
    if (status !== 'playing') return;
    stopThinking();
    gameIdRef.current += 1;
    setStatus('game-over');
    setResult('Mirror won');
    setIsMirrorThinking(false);
    void finishGame('Mirror won');
  };

  const handleDownloadPgn = () => {
    const pgn = gameRef.current.pgn();
    const blob = new Blob([pgn], { type: 'application/x-chess-pgn' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mirror-match-${Date.now()}.pgn`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const handleSelfRecognitionSelect = async (optionId: string) => {
    if (!selfRecognitionChallenge || !currentMatchId || selfRecognitionResult) return;

    const correct = optionId === selfRecognitionChallenge.correctOptionId;
    const resultPayload = {
      selected_option_id: optionId,
      correct_option_id: selfRecognitionChallenge.correctOptionId,
      correct,
      selected_at: new Date().toISOString(),
    };
    setSelfRecognitionResult({ selectedOptionId: optionId, correct });

    await mergeMirrorMatchMetadata(currentMatchId, {
      self_recognition: resultPayload,
    }).catch(() => undefined);

    if (correct) {
      await logAnonymousEvent('self_recognition_correct', {
        mirror_match_id: currentMatchId,
      }).catch(() => undefined);
    }
  };

  const handleGenerateScoutingCard = async () => {
    if (!styleRecord || !explanation) return;

    setScoutingCardStatus('Generating scouting card...');
    try {
      const input = {
        vector: styleRecord.vector,
        record: mirrorRecord,
        line: explanation,
      };
      const blob = await renderScoutingCardPng(input);
      const file = new File([blob], 'mirror-scouting-card.png', { type: 'image/png' });
      setScoutingCardUrl((currentUrl) => {
        if (currentUrl) URL.revokeObjectURL(currentUrl);
        return URL.createObjectURL(blob);
      });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: 'MIRROR scouting card',
          text: scoutingCardShareText(input),
          files: [file],
        });
        setScoutingCardStatus('Scouting card shared.');
        return;
      }

      await navigator.clipboard?.writeText(scoutingCardShareText(input));
      setScoutingCardStatus('Scouting card generated. Share text copied.');
    } catch (error) {
      setScoutingCardStatus(
        error instanceof Error ? `Could not generate scouting card: ${error.message}` : 'Could not generate scouting card.'
      );
    }
  };

  const statusLabel = useMemo(() => {
    if (isLoading) return 'Loading style vector...';
    if (loadError) return 'Could not load Mirror';
    if (!styleRecord) return 'Calibration needed';
    if (status === 'game-over') return result ?? 'Game over';
    if (isMirrorThinking) return 'Mirror thinking...';
    return 'Your move';
  }, [isLoading, isMirrorThinking, loadError, result, status, styleRecord]);

  if (isLoading || loadError || !styleRecord) {
    return (
      <div className="mirror-empty">
        <p className="home-eyebrow">Mirror match</p>
        <h1>Play the opponent built from your style vector.</h1>
        {loadError ? <p className="mirror-alert">{loadError}</p> : null}
        {!isLoading && !loadError && !styleRecord ? (
          <p>Finish calibration once, then the Mirror can load your latest local style vector.</p>
        ) : null}
        {isLoading ? <p>Loading your local calibration...</p> : null}
        <div className="home-actions">
          <Link to="/calibration" className="btn btn-primary">
            Begin Calibration
          </Link>
          <Link to="/play" className="btn btn-ghost">
            Free play
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="play mirror-match">
      <aside className="play-sidebar">
        <h2 className="play-title">Mirror</h2>
        <dl className="play-meta">
          <dt>You play</dt>
          <dd>White</dd>
          <dt>Opponent</dt>
          <dd>Mirror ({styleRecord.vector.detected_elo} Elo base)</dd>
          <dt>Theme</dt>
          <dd>{activeTheme === 'standard' ? 'Standard' : 'Kurukshetra'}</dd>
          <dt>Status</dt>
          <dd>{statusLabel}</dd>
        </dl>

        <div className="play-actions">
          <button
            className="btn btn-secondary"
            onClick={() => setActiveTheme(activeTheme === 'standard' ? 'kurukshetra' : 'standard')}
          >
            Theme - {activeTheme === 'standard' ? 'Standard' : 'Kurukshetra'}
          </button>
          <button className="btn btn-secondary" onClick={startNewGame}>
            New Mirror game
          </button>
          {status === 'playing' ? (
            <button className="btn btn-warn" onClick={handleResign}>
              Resign
            </button>
          ) : null}
          <button className="btn btn-ghost" onClick={handleDownloadPgn}>
            Download PGN
          </button>
        </div>

        <section className="mirror-panel">
          <h3>Style source</h3>
          <p>{generateSummary(styleRecord.vector)}</p>
        </section>

        {lastMirrorLine ? (
          <section className="mirror-panel mirror-panel--line">
            <h3>Why that move?</h3>
            <p>{lastMirrorLine}</p>
          </section>
        ) : null}

        {rerankSummary.totalMirrorMoves > 0 ? (
          <section className="mirror-panel">
            <h3>Personalization</h3>
            <p>
              {rerankSummary.overrideCount} of {rerankSummary.totalMirrorMoves} Mirror moves
              overrode Stockfish's top line ({Math.round(rerankSummary.overrideRate * 100)}%).
            </p>
          </section>
        ) : null}

        {explanation ? (
          <section className="mirror-panel mirror-panel--power">
            <h3>Mirror line</h3>
            <p>{explanation}</p>
          </section>
        ) : null}

        {evolvingLine ? (
          <section className="mirror-panel mirror-panel--evolving">
            <h3>Evolving Mirror</h3>
            <p>{evolvingLine}</p>
          </section>
        ) : null}

        {selfRecognitionChallenge ? (
          <section className="mirror-panel mirror-self-test">
            <h3>Which line feels like yours?</h3>
            <p>One of these came from this Mirror game. Two are decoys from perturbed style vectors.</p>
            <div className="mirror-self-test__options">
              {selfRecognitionChallenge.options.map((option) => (
                <button
                  key={option.id}
                  className="mirror-self-test__option"
                  type="button"
                  aria-pressed={selfRecognitionResult?.selectedOptionId === option.id}
                  disabled={Boolean(selfRecognitionResult)}
                  onClick={() => void handleSelfRecognitionSelect(option.id)}
                >
                  <strong>{option.label}</strong>
                  {option.lines.map((line) => (
                    <span key={line}>{line}</span>
                  ))}
                </button>
              ))}
            </div>
            {selfRecognitionResult ? (
              <p className="play-note">
                {selfRecognitionResult.correct
                  ? 'Recorded: you recognized your Mirror.'
                  : 'Recorded: this one did not feel like you.'}
              </p>
            ) : null}
          </section>
        ) : null}

        {explanation ? (
          <section className="mirror-panel mirror-share">
            <h3>Scouting card</h3>
            <p>
              Record: {mirrorRecord.playerWins}-{mirrorRecord.mirrorWins}-{mirrorRecord.draws}
            </p>
            <button className="btn btn-primary" type="button" onClick={() => void handleGenerateScoutingCard()}>
              Generate PNG
            </button>
            {scoutingCardStatus ? <p className="play-note">{scoutingCardStatus}</p> : null}
            {scoutingCardUrl ? (
              <img className="mirror-share__preview" alt="Generated MIRROR scouting card" src={scoutingCardUrl} />
            ) : null}
          </section>
        ) : null}

        <section className="mirror-panel">
          <h3>Feedback</h3>
          {FEEDBACK_FORM_URL ? (
            <a className="btn btn-ghost" href={FEEDBACK_FORM_URL} target="_blank" rel="noreferrer">
              Send feedback
            </a>
          ) : (
            <p>Feedback form link pending human URL.</p>
          )}
        </section>

        {saveStatus ? <p className="play-note">{saveStatus}</p> : null}
      </aside>

      <section className="play-board-wrap">
        <BoardView
          fen={fen}
          playerColor="white"
          status={status}
          engineThinking={isMirrorThinking}
          onPieceDrop={(from, to) => makePlayerMove(from, to)}
          onPromotionCheck={handlePromotionCheck}
          onPromotionPieceSelect={handlePromotionPieceSelect}
          themeManifest={themeManifest}
          themeError={themeError}
        />
      </section>
    </div>
  );
}

function uciToMove(uci: string): { from: string; to: string; promotion?: Promotion } {
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  const promotion = uci.length === 5 ? (uci[4] as Promotion) : undefined;
  return promotion ? { from, to, promotion } : { from, to };
}

function resultForGame(game: Chess): MirrorResult | null {
  if (!game.isGameOver()) return null;

  if (game.isCheckmate()) {
    return game.turn() === 'w' ? 'Mirror won' : 'You won';
  }

  if (game.isDraw() || game.isStalemate() || game.isThreefoldRepetition() || game.isInsufficientMaterial()) {
    return 'Draw';
  }

  return 'Game ended';
}

function pgnResultFor(result: MirrorResult): string {
  if (result === 'You won') return '1-0';
  if (result === 'Mirror won') return '0-1';
  if (result === 'Draw') return '1/2-1/2';
  return '*';
}

function nextMoveNumber(game: Chess): number {
  return Math.floor(game.history().length / 2) + 1;
}

function makeId(prefix: string): string {
  const randomId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${randomId}`;
}
