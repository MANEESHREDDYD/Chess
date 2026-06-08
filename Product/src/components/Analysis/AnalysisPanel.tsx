import { useState, useEffect } from 'react';
import { getAnalysisForMatch, putAnalysisRecord } from '../../data/db';
import type { AnalysisRecord, AnalysisMove } from '../../data/db';
import type { StyleVector } from '../../ml/styleVector';
import { analyzeGame } from '../../analysis/analyzeGame';

interface AnalysisPanelProps {
  pgn: string;
  playerId: string;
  matchId: string;
  matchType: 'computer' | 'mirror';
  styleVector?: StyleVector;
}

export function AnalysisPanel({ pgn, playerId, matchId, matchType, styleVector }: AnalysisPanelProps) {
  const [record, setRecord] = useState<AnalysisRecord | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    getAnalysisForMatch(matchId).then((rec) => {
      if (mounted && rec) {
        setRecord(rec);
      }
    }).catch(err => console.error("Failed to load analysis", err));
    return () => { mounted = false; };
  }, [matchId]);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setError(null);
    try {
      const result = await analyzeGame(pgn, playerId, matchId, matchType, styleVector, {
        depth: 10,
        onProgress: (current, total) => setProgress({ current, total })
      });
      await putAnalysisRecord(result);
      setRecord(result);
    } catch (err: any) {
      setError(err.message || 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  if (record) {
    const s = record.summary;
    return (
      <div className="analysis-panel" style={{ marginTop: '1rem', padding: '1rem', backgroundColor: 'var(--surface-sunken)', borderRadius: '8px' }}>
        <h3>Post-Game Analysis</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <p><strong>Accuracy Est:</strong> {s.accuracy_estimate}%</p>
            <p><strong>Avg CP Loss:</strong> {s.average_cp_loss}</p>
          </div>
          <div>
            <p>
              <span style={{ color: 'var(--success-color, #4ade80)' }}>★ {s.best_count}</span> | 
              <span style={{ color: 'var(--info-color, #60a5fa)' }}> ✓ {s.good_count}</span> | 
              <span style={{ color: 'var(--warning-color, #fbbf24)' }}> ? {s.inaccuracy_count}</span> | 
              <span style={{ color: 'var(--danger-color, #ef4444)' }}> ?? {s.mistake_count}</span> | 
              <span style={{ color: '#b91c1c' }}> ☠ {s.blunder_count}</span>
            </p>
          </div>
        </div>

        <div className="analysis-moves" style={{ maxHeight: '400px', overflowY: 'auto', backgroundColor: 'var(--surface-color)', padding: '0.5rem', borderRadius: '4px' }}>
          {record.moves.map((m: AnalysisMove, idx: number) => {
             // Only show moves that are inaccuracy or worse, to avoid clutter
             if (m.classification === 'best' || m.classification === 'good') return null;
             return (
               <div key={idx} style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                 <strong>{m.move_number}{m.color === 'white' ? '.' : '...'} {m.san}</strong> 
                 <span style={{ marginLeft: '0.5rem', textTransform: 'capitalize', fontWeight: 'bold' }}>{m.classification}</span>
                 <span style={{ marginLeft: '0.5rem', fontSize: '0.9em' }}>(Loss: {m.cp_loss} cp)</span>
                 {m.best_move && <div style={{ fontSize: '0.9em', color: 'var(--text-muted)' }}>Best was {m.best_move}</div>}
                 {m.note && <div style={{ fontSize: '0.9em', color: 'var(--primary-color)', marginTop: '0.2rem' }}>💡 {m.note}</div>}
               </div>
             )
          })}
          {record.moves.every(m => m.classification === 'best' || m.classification === 'good') && (
            <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>No major mistakes found!</div>
          )}
        </div>
      </div>
    );
  }

  if (analyzing) {
    return (
      <div className="analysis-panel" style={{ marginTop: '1rem', padding: '1rem', textAlign: 'center', backgroundColor: 'var(--surface-sunken)', borderRadius: '8px' }}>
        <p>Analyzing move {progress.current} of {progress.total}...</p>
        <div style={{ width: '100%', height: '4px', backgroundColor: 'var(--surface-color)', marginTop: '0.5rem' }}>
          <div style={{ height: '100%', backgroundColor: 'var(--primary-color)', width: `${progress.total ? (progress.current / progress.total) * 100 : 0}%` }} />
        </div>
      </div>
    );
  }

  return (
    <div className="analysis-panel" style={{ marginTop: '1rem', padding: '1rem', backgroundColor: 'var(--surface-sunken)', borderRadius: '8px', textAlign: 'center' }}>
      <button className="btn-primary" onClick={handleAnalyze}>
        Analyze Game
      </button>
      {error && <p style={{ color: 'var(--danger-color)', marginTop: '0.5rem' }}>{error}</p>}
    </div>
  );
}
