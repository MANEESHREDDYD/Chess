import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Chess } from 'chess.js';
import { AnalysisPanel } from '../components/Analysis/AnalysisPanel';
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
  getMirrorMatchRecord,
  getCurrentStyleVectorRecord,
  getMirrorMatchesForPlayer,
  getStyleVectorRecord,
  logAnonymousEvent,
  mergeMirrorMatchMetadata,
  putMirrorMatchRecord,
  putStyleVectorRecord,
  saveFeedbackRecord,
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
import {
  MIRROR_PERSONALITY_LABELS,
  MIRROR_PERSONALITY_MODES,
  type MirrorPersonalityMode,
} from '../mirror/mirrorPersonality';
import { stopThinking } from '../engine/stockfishBridge';
import { isStandardTheme, loadThemeManifest } from '../lib/theme';
import { sharpenMirrorVector } from '../ml/evolvingMirror';
import { useSettingsStore } from '../state/settingsStore';
import { usePlayerStore } from '../state/playerStore';
import { useAudioFx } from '../audio/useAudioFx';

type GameStatus = 'idle' | 'playing' | 'game-over';
type MirrorResult = 'You won' | 'Mirror won' | 'Draw' | 'Game ended';
type Promotion = 'q' | 'r' | 'b' | 'n';
type MirrorFeedbackTag =
  | 'felt_like_me'
  | 'too_strong'
  | 'too_random'
  | 'too_aggressive'
  | 'too_passive'
  | 'good_training';

const MIRROR_FEEDBACK_TAGS: Array<{ value: MirrorFeedbackTag; label: string }> = [
  { value: 'felt_like_me', label: 'Felt like me' },
  { value: 'too_strong', label: 'Too strong' },
  { value: 'too_random', label: 'Too random' },
  { value: 'too_aggressive', label: 'Too aggressive' },
  { value: 'too_passive', label: 'Too passive' },
  { value: 'good_training', label: 'Good training' },
];

type StoredMirrorTrace = MirrorDecisionTrace & {
  moveNumber: number;
  fenBefore: string;
  ply: number;
};

let fallbackMirrorIdCounter = 0;

export default function Mirror() {
  const activeTheme = useSettingsStore((state) => state.activeTheme);
  const setActiveTheme = useSettingsStore((state) => state.setActiveTheme);
  const activePlayerId = usePlayerStore((s) => s.activePlayerId);
  const gameRef = useRef(new Chess());
  const gameIdRef = useRef(0);
  const opponentRef = useRef<MirrorOpponentProvider | null>(null);
  const startedAtRef = useRef(new Date().toISOString());
  const persistedRef = useRef(false);
  const mirrorTracesRef = useRef<StoredMirrorTrace[]>([]);

  const [styleRecord, setStyleRecord] = useState<StyleVectorRecord | null>(null);
  const [pastStyleRecord, setPastStyleRecord] = useState<StyleVectorRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fen, setFen] = useState(gameRef.current.fen());
  const [status, setStatus] = useState<GameStatus>('idle');
  const [result, setResult] = useState<MirrorResult | null>(null);
  const [isMirrorThinking, setIsMirrorThinking] = useState(false);
  const [playerColor, setPlayerColor] = useState<'white' | 'black'>('white');
  const [personalityMode, setPersonalityMode] = useState<MirrorPersonalityMode>('current_self');
  
  useAudioFx(gameRef.current.history());

  const [themeManifest, setThemeManifest] = useState<Awaited<ReturnType<typeof loadThemeManifest>>>(
    null
  );
  const [themeError, setThemeError] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [lastMirrorLine, setLastMirrorLine] = useState<string | null>(null);
  const [lastMirrorTrace, setLastMirrorTrace] = useState<StoredMirrorTrace | null>(null);
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
  const [matchExportStatus, setMatchExportStatus] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [feedbackStatus, setFeedbackStatus] = useState<string | null>(null);
  const [hasSubmittedFeedback, setHasSubmittedFeedback] = useState(false);
  const [feltLikeMe, setFeltLikeMe] = useState<'yes' | 'somewhat' | 'no' | null>(null);
  const [perceivedStrength, setPerceivedStrength] = useState<'weaker' | 'equal' | 'stronger' | null>(null);
  const [feedbackTags, setFeedbackTags] = useState<MirrorFeedbackTag[]>([]);
  const [similarNotes, setSimilarNotes] = useState('');
  const [wrongNotes, setWrongNotes] = useState('');

  const requestMirrorMoveRef = useRef<() => Promise<void>>();

  useEffect(() => {
    let cancelled = false;

    async function loadStyleVector() {
      setIsLoading(true);
      setLoadError(null);

      try {
        if (!activePlayerId) {
          setStyleRecord(null);
          setPastStyleRecord(null);
          setStatus('idle');
          setIsLoading(false);
          return;
        }

        const row = await getCurrentStyleVectorRecord(activePlayerId);
        if (cancelled) return;

        setStyleRecord(row);
        if (row) {
          const previous = row.previous_vector_id
            ? await getStyleVectorRecord(row.previous_vector_id)
            : null;
          if (!cancelled) setPastStyleRecord(previous?.player_id === row.player_id ? previous : null);
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
          setPlayerColor('white');
          setFen(gameRef.current.fen());
          setStatus('playing');
          setResult(null);
          setIsMirrorThinking(false);
          setExplanation(null);
          setLastMirrorLine(null);
          setLastMirrorTrace(null);
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
          setMatchExportStatus(null);
          setSaveStatus(null);
          setFeedbackStatus(null);
          setHasSubmittedFeedback(false);
          setFeltLikeMe(null);
          setPerceivedStrength(null);
          setFeedbackTags([]);
          setSimilarNotes('');
          setWrongNotes('');
        } else {
          setPastStyleRecord(null);
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
  }, [activePlayerId]);

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
            personality_mode: personalityMode,
            self_recognition_options: challenge.options,
            self_recognition_correct_option_id: challenge.correctOptionId,
            mirror_base: 'stockfish-personality-rerank',
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
        opponentRef.current = createMirrorOpponent(tunedRecord.vector, { personalityMode });
        persistedRef.current = true;
        setPastStyleRecord(styleRecord);
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
    [personalityMode, styleRecord]
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
    setLastMirrorTrace(null);

    try {
      const mirrorMove = await opponent.getMoveWithTrace(fenBefore, {
        depth: 8,
        timeoutMs: 15_000,
        personalityMode,
        styleVectorOverride: personalityMode === 'past_self' ? pastStyleRecord?.vector ?? null : undefined,
        seed: `${fenBefore}|${moveNumber}|${personalityMode}`,
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
        setLastMirrorTrace(storedTrace);
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
  }, [finishGame, pastStyleRecord, personalityMode, settleIfGameOver, status]);

  useEffect(() => {
    requestMirrorMoveRef.current = requestMirrorMove;
  }, [requestMirrorMove]);

  const makePlayerMove = useCallback(
    (from: string, to: string, promotion?: Promotion): boolean => {
      if (!styleRecord || status !== 'playing' || isMirrorThinking) return false;
      const turnColor = gameRef.current.turn() === 'w' ? 'white' : 'black';
      if (turnColor !== playerColor) return false;

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
    [isMirrorThinking, requestMirrorMove, settleIfGameOver, status, styleRecord, playerColor]
  );

  const startNewGame = useCallback((color: 'white' | 'black' = 'white') => {
    stopThinking();
    gameIdRef.current += 1;
    gameRef.current = new Chess();
    startedAtRef.current = new Date().toISOString();
    persistedRef.current = false;
    mirrorTracesRef.current = [];
    setPlayerColor(color);
    setFen(gameRef.current.fen());
    setStatus(styleRecord ? 'playing' : 'idle');
    setResult(null);
    setIsMirrorThinking(false);
    setExplanation(null);
    setLastMirrorLine(null);
    setLastMirrorTrace(null);
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
    setFeedbackStatus(null);
    setHasSubmittedFeedback(false);
    setFeltLikeMe(null);
    setPerceivedStrength(null);
    setFeedbackTags([]);
    setSimilarNotes('');
    setWrongNotes('');

    if (color === 'black' && styleRecord) {
      setTimeout(() => {
        if (requestMirrorMoveRef.current) {
          void requestMirrorMoveRef.current();
        }
      }, 10);
    }
  }, [styleRecord]);

  const handlePromotionCheck = (sourceSquare: string, targetSquare: string, piece: string): boolean => {
    return Boolean(sourceSquare && targetSquare && piece);
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
        try {
          await navigator.share({
            title: 'MIRROR scouting card',
            text: scoutingCardShareText(input),
            files: [file],
          });
          setScoutingCardStatus('Scouting card shared.');
          return;
        } catch {
          // Browser support can be optimistic, especially in automated or desktop contexts.
        }
      }

      const shareText = scoutingCardShareText(input);
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(shareText);
          setScoutingCardStatus('Scouting card generated. Share text copied.');
          return;
        } catch {
          // Clipboard permissions can be denied in private, headless, or locked-down browsers.
        }
      }

      setScoutingCardStatus('Share card ready. Copy/share unavailable in this browser.');
    } catch (error) {
      setScoutingCardStatus(
        error instanceof Error ? `Could not generate scouting card: ${error.message}` : 'Could not generate scouting card.'
      );
    }
  };

  const handleExportMatchData = async () => {
    if (!styleRecord) return;

    setMatchExportStatus('Preparing match export...');
    try {
      const record =
        (currentMatchId ? await getMirrorMatchRecord(currentMatchId) : undefined) ??
        latestMirrorMatch(await getMirrorMatchesForPlayer(styleRecord.player_id));

      if (!record) {
        setMatchExportStatus('No saved Mirror match found yet.');
        return;
      }

      const json = JSON.stringify(record, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${record.id || 'mirror-match'}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      const traces = Array.isArray(record.metadata?.mirror_moves) ? record.metadata.mirror_moves.length : 0;
      setMatchExportStatus(`Exported ${record.id} with ${traces} Mirror traces.`);
    } catch (error) {
      setMatchExportStatus(error instanceof Error ? `Could not export match: ${error.message}` : 'Could not export match.');
    }
  };

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!styleRecord || !currentMatchId || !feltLikeMe || !perceivedStrength) return;

    setFeedbackStatus('Saving feedback...');
    try {
      await saveFeedbackRecord({
        id: makeId('feedback'),
        player_id: styleRecord.player_id,
        mirror_match_id: currentMatchId,
        style_vector_id: styleRecord.id,
        felt_like_me: feltLikeMe,
        perceived_strength: perceivedStrength,
        similar_notes: similarNotes,
        wrong_notes: wrongNotes,
        created_at: new Date().toISOString(),
        metadata: {
          personality_mode: personalityMode,
          feedback_tags: feedbackTags,
        },
      });
      setHasSubmittedFeedback(true);
      setFeedbackStatus('Feedback saved. Thank you!');
    } catch (error) {
      setFeedbackStatus(error instanceof Error ? `Failed to save feedback: ${error.message}` : 'Failed to save feedback.');
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

  const styleVectorWarning = useMemo(() => {
    if (!styleRecord) return null;
    if (personalityMode === 'past_self' && !pastStyleRecord) {
      return 'Past self needs an older tuned StyleVector. Play and save a Mirror game first, then this mode can use prior local evidence.';
    }
    return styleVectorHasThinEvidence(styleRecord.vector)
      ? 'StyleVector evidence is still thin. Play more Mirror games or recalibrate for stronger personalization.'
      : null;
  }, [pastStyleRecord, personalityMode, styleRecord]);

  const toggleFeedbackTag = (tag: MirrorFeedbackTag) => {
    setFeedbackTags((current) =>
      current.includes(tag) ? current.filter((entry) => entry !== tag) : [...current, tag]
    );
  };

  if (isLoading || loadError || !styleRecord) {
    return (
      <div className="mirror-empty">
        <p className="home-eyebrow">Mirror match</p>
        <h1>Play the opponent built from your style vector.</h1>
        {loadError ? <p className="mirror-alert">{loadError}</p> : null}
        {!activePlayerId ? (
          <p>Please create a player profile before playing Mirror.</p>
        ) : !isLoading && !loadError && !styleRecord ? (
          <p>Finish calibration once, then the Mirror can load your latest local style vector.</p>
        ) : null}
        {isLoading ? <p>Loading your local calibration...</p> : null}
        <div className="home-actions">
          {!activePlayerId ? (
            <Link to="/onboarding" className="btn btn-primary">
              Create Profile
            </Link>
          ) : (
            <Link to="/calibration" className="btn btn-primary">
              Begin Calibration
            </Link>
          )}
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
          <dd>{playerColor === 'white' ? 'White' : 'Black'}</dd>
          <dt>Opponent</dt>
          <dd>Mirror ({styleRecord.vector.detected_elo} Elo base)</dd>
          <dt>Personality</dt>
          <dd>{MIRROR_PERSONALITY_LABELS[personalityMode]}</dd>
          <dt>Theme</dt>
          <dd>{activeTheme === 'standard' ? 'Standard' : 'Kurukshetra'}</dd>
          <dt>Status</dt>
          <dd>{statusLabel}</dd>
        </dl>

        <div className="play-actions">
          <button
            className="btn btn-secondary"
            onClick={() => setActiveTheme(activeTheme === 'standard' ? 'mahabharata' : 'standard')}
          >
            Theme - {activeTheme === 'standard' ? 'Standard' : 'Kurukshetra'}
          </button>
          <button className="btn btn-secondary" onClick={() => startNewGame('white')}>
            New Mirror game · White
          </button>
          <button className="btn btn-secondary" onClick={() => startNewGame('black')}>
            New Mirror game · Black
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

        <section className="mirror-panel mirror-personality">
          <h3>Mirror personality</h3>
          <select
            className="mirror-select"
            value={personalityMode}
            onChange={(event) => setPersonalityMode(event.target.value as MirrorPersonalityMode)}
            disabled={isMirrorThinking}
          >
            {MIRROR_PERSONALITY_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {MIRROR_PERSONALITY_LABELS[mode]}
              </option>
            ))}
          </select>
          <p>{personalityDescription(personalityMode)}</p>
        </section>

        <section className="mirror-panel">
          <h3>Style source</h3>
          <p>{generateSummary(styleRecord.vector)}</p>
        </section>

        {styleVectorWarning ? (
          <section className="mirror-panel mirror-panel--warning">
            <h3>Calibration signal</h3>
            <p>{styleVectorWarning}</p>
          </section>
        ) : null}

        {lastMirrorLine ? (
          <section className="mirror-panel mirror-panel--line">
            <h3>Why Mirror moved</h3>
            <p>{lastMirrorLine}</p>
            {lastMirrorTrace ? (
              <div className="mirror-evidence">
                <span>Confidence: {lastMirrorTrace.confidence ?? 'medium'}</span>
                <span>Mode: {MIRROR_PERSONALITY_LABELS[lastMirrorTrace.personalityMode ?? personalityMode]}</span>
                {(lastMirrorTrace.evidence ?? []).slice(0, 3).map((entry) => (
                  <span key={entry}>{entry}</span>
                ))}
              </div>
            ) : null}
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
            <button className="btn btn-ghost" type="button" onClick={() => void handleExportMatchData()}>
              Export match data
            </button>
            {matchExportStatus ? <p className="play-note">{matchExportStatus}</p> : null}
          </section>
        ) : null}

        {status === 'game-over' && currentMatchId ? (
          <section className="mirror-panel">
            <h3>Mirror Match Feedback</h3>
            {hasSubmittedFeedback ? (
              <p className="play-note">✅ {feedbackStatus}</p>
            ) : (
              <form onSubmit={handleFeedbackSubmit} className="feedback-form" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <fieldset>
                  <legend>Did this opponent feel like you?</legend>
                  <label><input type="radio" name="feltLikeMe" value="yes" checked={feltLikeMe === 'yes'} onChange={() => setFeltLikeMe('yes')} required /> Yes</label>
                  <label><input type="radio" name="feltLikeMe" value="somewhat" checked={feltLikeMe === 'somewhat'} onChange={() => setFeltLikeMe('somewhat')} /> Somewhat</label>
                  <label><input type="radio" name="feltLikeMe" value="no" checked={feltLikeMe === 'no'} onChange={() => setFeltLikeMe('no')} /> No</label>
                </fieldset>

                <fieldset>
                  <legend>Did it feel weaker, equal, or stronger?</legend>
                  <label><input type="radio" name="perceivedStrength" value="weaker" checked={perceivedStrength === 'weaker'} onChange={() => setPerceivedStrength('weaker')} required /> Weaker</label>
                  <label><input type="radio" name="perceivedStrength" value="equal" checked={perceivedStrength === 'equal'} onChange={() => setPerceivedStrength('equal')} /> Equal</label>
                  <label><input type="radio" name="perceivedStrength" value="stronger" checked={perceivedStrength === 'stronger'} onChange={() => setPerceivedStrength('stronger')} /> Stronger</label>
                </fieldset>

                <fieldset>
                  <legend>What should Mirror remember?</legend>
                  {MIRROR_FEEDBACK_TAGS.map((option) => (
                    <label key={option.value}>
                      <input
                        type="checkbox"
                        checked={feedbackTags.includes(option.value)}
                        onChange={() => toggleFeedbackTag(option.value)}
                      />{' '}
                      {option.label}
                    </label>
                  ))}
                </fieldset>

                <label style={{ display: 'flex', flexDirection: 'column' }}>
                  What felt similar?
                  <textarea value={similarNotes} onChange={(e) => setSimilarNotes(e.target.value)} rows={2}></textarea>
                </label>

                <label style={{ display: 'flex', flexDirection: 'column' }}>
                  What felt wrong?
                  <textarea value={wrongNotes} onChange={(e) => setWrongNotes(e.target.value)} rows={2}></textarea>
                </label>

                <button type="submit" className="btn btn-primary" disabled={!feltLikeMe || !perceivedStrength}>
                  Submit Feedback
                </button>
                {feedbackStatus && <p className="play-note">{feedbackStatus}</p>}
              </form>
            )}
          </section>
        ) : null}

        {status === 'game-over' && currentMatchId && activePlayerId && styleRecord && (
          <>
            <AnalysisPanel
              pgn={gameRef.current.pgn()}
              playerId={activePlayerId}
              matchId={currentMatchId}
              matchType="mirror"
              styleVector={styleRecord.vector}
            />
            <p className="play-note" style={{ marginTop: '0.75rem' }}>
              <Link to={`/review/mirror_match/${currentMatchId}`}>Open Game Review Pro</Link>
            </p>
          </>
        )}

        {saveStatus ? (
          <p className="play-note">
            {saveStatus}
            {saveStatus.startsWith('Match finished, but save failed') && result ? (
              <>
                {' '}
                <button className="btn btn-ghost" type="button" onClick={() => void finishGame(result)}>
                  Retry save
                </button>
              </>
            ) : null}
          </p>
        ) : null}
      </aside>

      <section className="play-board-wrap">
        <BoardView
          fen={fen}
          playerColor={playerColor}
          status={status}
          engineThinking={isMirrorThinking}
          onPieceDrop={(from, to, promotion) => makePlayerMove(from, to, promotion)}
          onPromotionCheck={handlePromotionCheck}
          onPromotionPieceSelect={() => false}
          themeManifest={themeManifest}
          themeError={themeError}
        />
      </section>
    </div>
  );
}

function personalityDescription(mode: MirrorPersonalityMode): string {
  if (mode === 'aggressive_self') {
    return 'Leans into your capture, attack, and forcing-move tendencies when the CP window is safe.';
  }

  if (mode === 'past_self') {
    return 'Uses an older saved StyleVector when available, so you can spar with earlier local habits.';
  }

  if (mode === 'cautious_self') {
    return 'Keeps your profile but prefers safer king position, lower risk, and steadier choices.';
  }

  if (mode === 'blunder_prone_self') {
    return 'Practices against your known weak habits, with controlled CP-loss bounds so it stays useful.';
  }

  if (mode === 'improved_self') {
    return 'Keeps your recognizable style while reducing known weakness and avoidable CP loss.';
  }

  return 'Closest to your current StyleVector, reranking Stockfish candidates to match local evidence.';
}

function styleVectorHasThinEvidence(vector: StyleVectorRecord['vector']): boolean {
  const openingCount = vector.opening_white_top3.length + vector.opening_black_top3.length;
  const motifValues = Object.values(vector.motif_blindness);
  const motifLooksDefault = motifValues.length === 0 || motifValues.every((value) => value >= 0.95);
  return openingCount === 0 && motifLooksDefault && vector.avg_move_time_ms <= 0;
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

function latestMirrorMatch(matches: Awaited<ReturnType<typeof getMirrorMatchesForPlayer>>) {
  return [...matches].sort((a, b) => a.started_at.localeCompare(b.started_at)).pop();
}

function nextMoveNumber(game: Chess): number {
  return Math.floor(game.history().length / 2) + 1;
}

function makeId(prefix: string): string {
  fallbackMirrorIdCounter += 1;
  const randomId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${fallbackMirrorIdCounter}`;
  return `${prefix}-${randomId}`;
}
