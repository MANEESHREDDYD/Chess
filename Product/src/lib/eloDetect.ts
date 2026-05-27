import type { CalibrationRunData, EloBand, EndgameOutcome, VyasaResult } from '../ml/styleVector';

export interface DetectedElo {
  detected_elo: number;
  elo_band: EloBand;
}

interface EloScoreInputs {
  tactical: number;
  endgame: number;
  vyasa: number;
}

const EXPECTED_TACTICAL_POSITIONS = 8;

/*
 * Band table:
 * elo < 1200         -> apprentice
 * 1200 <= elo < 1500 -> initiate
 * 1500 <= elo < 1800 -> adept
 * elo >= 1800        -> master
 *
 * Limitations:
 * 1. This is a single-session heuristic, not real Elo.
 * 2. Adept and master are under-discriminated because the Phase 1 sample is small.
 * 3. If the v2/v4 band thresholds shift, this file must be retuned with the report.
 *
 * Clamp rationale: the upper cap prevents one strong calibration run from becoming an
 * inflated rating. The lower cap is deliberately below the 1000 participation baseline
 * so later disengagement penalties can be represented without changing the schema.
 */
export function computeDetectedElo(data: CalibrationRunData): DetectedElo {
  return computeDetectedEloFromScores({
    tactical: tacticalScore(data),
    endgame: endgameScore(data.task3?.outcome, data.task3?.score),
    vyasa: vyasaScore(data.task8?.result, data.task8?.avg_cp_loss),
  });
}

export function computeDetectedEloFromScores(scores: EloScoreInputs): DetectedElo {
  const detected_elo = clamp(
    Math.round(
      1000 +
        600 * finiteNumber(scores.tactical, 0) +
        200 * finiteNumber(scores.endgame, 0) +
        300 * finiteNumber(scores.vyasa, 0)
    ),
    800,
    2100
  );

  return {
    detected_elo,
    elo_band: eloBandFromRating(detected_elo),
  };
}

export function eloBandFromRating(elo: number): EloBand {
  const safeElo = finiteNumber(elo, 0);
  if (safeElo < 1200) return 'apprentice';
  if (safeElo < 1500) return 'initiate';
  if (safeElo < 1800) return 'adept';
  return 'master';
}

function tacticalScore(data: CalibrationRunData): number {
  const correct = safeCount(data.task1?.correct_count) + safeCount(data.task4?.correct_count);
  return correct / EXPECTED_TACTICAL_POSITIONS;
}

function endgameScore(outcome: EndgameOutcome | null | undefined, explicitScore: number | null | undefined): number {
  const score = finiteNumberOrNull(explicitScore);
  if (score !== null) return score;
  if (outcome === 'full') return 1;
  if (outcome === 'partial') return 0.5;
  return 0;
}

function vyasaScore(result: VyasaResult | null | undefined, avgCpLoss: number | null | undefined): number {
  const safeResult = result ?? 'abandoned';
  if (safeResult === 'abandoned' && finiteNumberOrNull(avgCpLoss) === null) return 0;

  const resultFactor = safeResult === 'win' ? 1 : safeResult === 'draw' ? 0.5 : 0;
  const cpLoss = Math.max(0, finiteNumber(avgCpLoss, 999));
  let cpLossFactor = 0.1;

  if (cpLoss < 30) {
    cpLossFactor = 1;
  } else if (cpLoss < 70) {
    cpLossFactor = 0.7;
  } else if (cpLoss < 150) {
    cpLossFactor = 0.4;
  }

  return 0.5 * resultFactor + 0.5 * cpLossFactor;
}

function safeCount(value: number | null | undefined): number {
  return Math.max(0, Math.round(finiteNumber(value, 0)));
}

function finiteNumberOrNull(value: number | null | undefined): number | null {
  return Number.isFinite(value) ? Number(value) : null;
}

function finiteNumber(value: number | null | undefined, fallback: number): number {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
