import { useEffect, useState } from 'react';
import { usePlayerStore } from '../state/playerStore';
import {
  getFeedbackRecords,
  getLocalMatchesForPlayer,
  getMirrorMatchesForPlayer,
  getAnalysesForPlayer,
  getClueAttemptsForPlayer,
  getClueStatsForPlayer,
  openMirrorDb,
} from '../data/db';

export default function DevInspector() {
  const activePlayerId = usePlayerStore((s) => s.activePlayerId);
  const activePlayer = usePlayerStore((s) => s.activePlayer);
  const [data, setData] = useState<Record<string, unknown>>({
    activePlayerId: activePlayerId || null,
    activePlayer,
    latestCalibrationRun: null,
    currentStyleVectorId: activePlayer?.current_style_vector_id || null,
    currentStyleVector: null,
    recentLocalMatches: [],
    recentMirrorMatches: [],
    recentAnalyses: [],
    recentClueAttempts: [],
    clueStats: null,
    feedbackRecords: [],
  });

  useEffect(() => {
    async function loadData() {
      if (!activePlayerId) return;

      const db = await openMirrorDb();

      // Latest calibration run
      const runs = await db.getAllFromIndex('calibration_runs', 'started_at');
      const latestRun = runs.filter((r) => r.player_id === activePlayerId).pop() || null;

      // Current Style Vector
      const currentStyleVector = activePlayer?.current_style_vector_id
        ? await db.get('style_vectors', activePlayer.current_style_vector_id)
        : null;

      // Matches
      const localMatches = await getLocalMatchesForPlayer(activePlayerId);
      const mirrorMatches = await getMirrorMatchesForPlayer(activePlayerId);

      // Feedback
      const feedback = await getFeedbackRecords();

      // Analyses
      const analyses = await getAnalysesForPlayer(activePlayerId);

      // Clues
      const clues = await getClueAttemptsForPlayer(activePlayerId);
      const clueStats = await getClueStatsForPlayer(activePlayerId);

      setData({
        activePlayerId: activePlayerId || null,
        activePlayer,
        latestCalibrationRun: latestRun,
        currentStyleVectorId: activePlayer?.current_style_vector_id || null,
        currentStyleVector,
        recentLocalMatches: localMatches.slice(-5),
        recentMirrorMatches: mirrorMatches.slice(-5),
        recentAnalyses: analyses.slice(-5),
        recentClueAttempts: clues.slice(0, 5),
        clueStats,
        feedbackRecords: feedback,
      });
    }

    loadData();
  }, [activePlayerId, activePlayer]);

  if (!import.meta.env.DEV) {
    return <div>Not Found</div>;
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'monospace', fontSize: '12px' }}>
      <h1>Dev Data Inspector</h1>
      <pre style={{ background: '#111', color: '#0f0', padding: '1rem', overflowX: 'auto' }}>
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}
