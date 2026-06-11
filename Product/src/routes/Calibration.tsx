import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Task1Tactical } from '../components/Calibration/Task1Tactical';
import { Task2OpeningChoice } from '../components/Calibration/Task2OpeningChoice';
import { Task3EndgameTechnique } from '../components/Calibration/Task3EndgameTechnique';
import { Task4TacticalRace } from '../components/Calibration/Task4TacticalRace';
import { Task5MoralChess } from '../components/Calibration/Task5MoralChess';
import { Task6BlackRepertoire } from '../components/Calibration/Task6BlackRepertoire';
import { Task7Exchange } from '../components/Calibration/Task7Exchange';
import { Task8VyasaMatch } from '../components/Calibration/Task8VyasaMatch';
import { getTacticalTaskPositions } from '../components/Calibration/taskData';
import { generateSummary } from '../components/Mirror/styleSummary';
import { logAnonymousEvent } from '../data/db';
import { useCalibrationStore } from '../state/calibrationStore';
import { usePlayerStore } from '../state/playerStore';

export default function Calibration() {
  const run = useCalibrationStore((state) => state.run);
  const currentTaskIndex = useCalibrationStore((state) => state.currentTaskIndex);
  const styleVector = useCalibrationStore((state) => state.styleVector);
  const isLoading = useCalibrationStore((state) => state.isLoading);
  const resumeRun = useCalibrationStore((state) => state.resumeRun);
  const submitTask = useCalibrationStore((state) => state.submitTask);
  const completeRun = useCalibrationStore((state) => state.completeRun);
  const activePlayerId = usePlayerStore((state) => state.activePlayerId);

  useEffect(() => {
    // The active player loads asynchronously on a hard refresh; resuming
    // before it resolves used to throw an unhandled "No active player for
    // calibration" page error. Gate on the player and never let the promise
    // escape unhandled.
    if (!activePlayerId) return;
    resumeRun().catch(() => undefined);
  }, [activePlayerId, resumeRun]);

  const statusLabel = useMemo(() => {
    if (isLoading) return 'Loading calibration…';
    if (styleVector) return 'Calibration complete';
    if (!run) return 'Preparing run…';
    return `Task ${currentTaskIndex} of 8`;
  }, [currentTaskIndex, isLoading, run, styleVector]);

  const taskView = useMemo(() => {
    if (styleVector) {
      return (
        <section className="calibration-finish">
          <header>
            <p className="calibration-task-eyebrow">Calibration complete</p>
            <h2>Your style vector is ready.</h2>
          </header>
          <p>{generateSummary(styleVector)}</p>
          <dl className="calibration-task-stats">
            <div>
              <dt>Detected Elo</dt>
              <dd>{styleVector.detected_elo}</dd>
            </div>
            <div>
              <dt>Band</dt>
              <dd>{styleVector.elo_band}</dd>
            </div>
            <div>
              <dt>Top White Openings</dt>
              <dd>{styleVector.opening_white_top3?.join(', ') || 'N/A'}</dd>
            </div>
            <div>
              <dt>Top Black Replies</dt>
              <dd>{styleVector.opening_black_top3?.join(', ') || 'N/A'}</dd>
            </div>
            <div>
              <dt>Exchange Willingness</dt>
              <dd>{(styleVector.exchange_willingness * 100).toFixed(0)}%</dd>
            </div>
            <div>
              <dt>Preferred Minor</dt>
              <dd>{styleVector.preferred_minor}</dd>
            </div>
            <div>
              <dt>Time-Pressure Blunder Rate</dt>
              <dd>{(styleVector.time_pressure_blunder_rate * 100).toFixed(0)}%</dd>
            </div>
            <div>
              <dt>Endgame Strength</dt>
              <dd>{(styleVector.endgame_strength * 100).toFixed(0)}%</dd>
            </div>
            <div>
              <dt>Swindle Preference</dt>
              <dd>{styleVector.swindle_preference || 'unset'}</dd>
            </div>
          </dl>
          <h3>Motif Blindness</h3>
          <dl className="calibration-task-stats">
            <div>
              <dt>Fork</dt>
              <dd>{((styleVector.motif_blindness?.fork ?? 0) * 100).toFixed(0)}%</dd>
            </div>
            <div>
              <dt>Pin</dt>
              <dd>{((styleVector.motif_blindness?.pin ?? 0) * 100).toFixed(0)}%</dd>
            </div>
            <div>
              <dt>Skewer</dt>
              <dd>{((styleVector.motif_blindness?.skewer ?? 0) * 100).toFixed(0)}%</dd>
            </div>
            <div>
              <dt>Removing Defender</dt>
              <dd>{((styleVector.motif_blindness?.removing_the_defender ?? 0) * 100).toFixed(0)}%</dd>
            </div>
          </dl>
          <p>
            <Link to="/mirror" className="btn btn-primary">
              Play your Mirror
            </Link>
          </p>
        </section>
      );
    }

    switch (currentTaskIndex) {
      case 1:
        return (
          <Task1Tactical
            onComplete={async (result) => {
              await submitTask(1, {
                correct_count: result.correctCount,
                total_count: getTacticalTaskPositions(1).length,
                time_pressure_blunder_rate: result.timePressureBlunderRate,
                attempts: getTacticalTaskPositions(1).map((position) => ({
                  motif: position.motif,
                  correct: !result.missedPositions.includes(position.id),
                })),
              });
            }}
          />
        );
      case 2:
        return <Task2OpeningChoice onComplete={async (result) => void submitTask(2, result)} />;
      case 3:
        return (
          <Task3EndgameTechnique
            onComplete={async (result) => {
              await submitTask(3, {
                outcome: result.success ? 'full' : 'none',
                score: Math.max(0, Math.min(1, result.endgame_strength / 100)),
              });
            }}
          />
        );
      case 4:
        return (
          <Task4TacticalRace
            onComplete={async (result) => {
              await submitTask(4, {
                correct_count: result.correctCount,
                total_count: getTacticalTaskPositions(4).length,
                time_pressure_blunder_rate: result.timePressureBlunderRate,
                attempts: getTacticalTaskPositions(4).map((position) => ({
                  motif: position.motif,
                  correct: !result.missedPositions.includes(position.id),
                })),
              });
            }}
          />
        );
      case 5:
        return <Task5MoralChess onComplete={async (result) => void submitTask(5, { choice: result.outcome })} />;
      case 6:
        return <Task6BlackRepertoire onComplete={async (result) => void submitTask(6, result)} />;
      case 7:
        return <Task7Exchange onComplete={async (result) => void submitTask(7, result)} />;
      case 8:
        return (
          <Task8VyasaMatch
            onComplete={async (result) => {
              await submitTask(8, {
                result: result.result,
                avg_cp_loss: result.avg_cp_loss,
                avg_move_time_ms: result.avg_move_time_ms,
              });
              await completeRun();
              await logAnonymousEvent('calibration_completed').catch(() => undefined);
            }}
          />
        );
      default:
        return <p>Run complete.</p>;
    }
  }, [completeRun, currentTaskIndex, styleVector, submitTask]);

  return (
    <div className="calibration-flow">
      <aside className="calibration-flow__rail">
        <p className="calibration-task-eyebrow">Calibration</p>
        <h1>Build the style vector.</h1>
        <p>{statusLabel}</p>
        <ol className="calibration-flow__steps">
          <li>1. Tactical sight</li>
          <li>2. Opening choice</li>
          <li>3. Endgame technique</li>
          <li>4. Tactical race</li>
          <li>5. Moral chess</li>
          <li>6. Black repertoire</li>
          <li>7. Exchange willingness</li>
          <li>8. Vyasa match</li>
        </ol>
        <p className="calibration-flow__note">Your answers are stored locally and can be resumed later.</p>
      </aside>

      <main className="calibration-flow__content">{taskView}</main>
    </div>
  );
}
