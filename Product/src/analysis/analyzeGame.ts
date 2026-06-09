import { Chess } from 'chess.js';
import { getCandidateMoves } from '../engine/stockfishBridge';
import type { StyleVector } from '../ml/styleVector';
import type { AnalysisMove, AnalysisRecord, AnalysisSummary } from '../data/db';

export interface AnalyzeGameOptions {
  depth?: number;
  maxMoves?: number;
  analyzeOnlyUserMoves?: boolean;
  onProgress?: (analyzed: number, total: number) => void;
}

const MATE_SCORE_BOUND = 10000;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getClassification(cpLoss: number): AnalysisMove['classification'] {
  if (cpLoss <= 20) return 'best';
  if (cpLoss <= 60) return 'good';
  if (cpLoss <= 120) return 'inaccuracy';
  if (cpLoss <= 250) return 'mistake';
  return 'blunder';
}

function getPersonalizedNote(classification: string, _cpLoss: number, styleVector?: StyleVector): string | undefined {
  if (!styleVector || (classification !== 'mistake' && classification !== 'blunder')) {
    return undefined;
  }
  
  if (styleVector.time_pressure_blunder_rate > 0.6) {
    return "This may match your calibration pattern: tactical accuracy drops under time pressure.";
  }
  
  if (styleVector.motif_blindness.removing_the_defender > 0.6 || styleVector.motif_blindness.fork > 0.6) {
    return "This may be related to a motif you struggled with during calibration.";
  }
  
  // Note: Since we don't do full semantic analysis of the specific move right here, we keep it simple.
  return undefined;
}

export async function analyzeGame(
  pgn: string,
  playerId: string,
  matchId: string,
  matchType: 'computer' | 'mirror',
  styleVector?: StyleVector,
  options: AnalyzeGameOptions = {}
): Promise<AnalysisRecord> {
  const depth = options.depth || 10;
  const chess = new Chess();
  
  try {
    chess.loadPgn(pgn);
  } catch (e) {
    throw new Error('Invalid PGN');
  }

  const history = chess.history({ verbose: true });
  const totalMoves = history.length;
  const maxMoves = options.maxMoves || totalMoves;
  
  const movesToAnalyze = Math.min(totalMoves, maxMoves);
  const analysisMoves: AnalysisMove[] = [];
  
  let totalCpLoss = 0;
  let bestCount = 0;
  let goodCount = 0;
  let inaccuracyCount = 0;
  let mistakeCount = 0;
  let blunderCount = 0;
  
  // We recreate the game from start to evaluate before each move
  const evalChess = new Chess();
  
  for (let i = 0; i < movesToAnalyze; i++) {
    const move = history[i];
    const isUserMove = true; // We can refine this if we pass in user side
    
    if (options.analyzeOnlyUserMoves && !isUserMove) {
      evalChess.move(move);
      continue;
    }
    
    const fenBefore = evalChess.fen();
    // 1. Evaluate before the move
    const candidatesBefore = await getCandidateMoves(fenBefore, 1, depth);
    const bestCandidate = candidatesBefore[0];
    
    let bestEvalForMover = 0;
    let bestMoveUci = '';
    
    if (bestCandidate) {
       bestMoveUci = bestCandidate.move;
       if (bestCandidate.mate !== null) {
          bestEvalForMover = bestCandidate.mate > 0 ? MATE_SCORE_BOUND - bestCandidate.mate : -MATE_SCORE_BOUND - bestCandidate.mate;
       } else {
          bestEvalForMover = bestCandidate.cp || 0;
       }
    }
    
    // 2. Make the move
    evalChess.move(move);
    const fenAfter = evalChess.fen();
    
    // 3. Evaluate after the move
    const candidatesAfter = await getCandidateMoves(fenAfter, 1, depth);
    const afterCandidate = candidatesAfter[0];
    
    let evalAfter = 0; // Perspective of opponent
    if (afterCandidate) {
      if (afterCandidate.mate !== null) {
         evalAfter = afterCandidate.mate > 0 ? MATE_SCORE_BOUND - afterCandidate.mate : -MATE_SCORE_BOUND - afterCandidate.mate;
      } else {
         evalAfter = afterCandidate.cp || 0;
      }
    }
    
    // 4. Normalize to mover's perspective
    // Stockfish returns side-to-move. 
    // playedEvalForMover = -evalAfter (since fenAfter is opponent's turn)
    const playedEvalForMover = -evalAfter;
    
    let cpLoss = Math.max(0, bestEvalForMover - playedEvalForMover);
    
    // Safety clamp in case of mate jumps
    if (cpLoss > MATE_SCORE_BOUND) cpLoss = MATE_SCORE_BOUND;
    
    // 5. Classify
    let classification: AnalysisMove['classification'] = 'unknown';
    
    if (bestCandidate && afterCandidate) {
      classification = getClassification(cpLoss);
      
      switch (classification) {
        case 'best': bestCount++; break;
        case 'good': goodCount++; break;
        case 'inaccuracy': inaccuracyCount++; break;
        case 'mistake': mistakeCount++; break;
        case 'blunder': blunderCount++; break;
      }
      
      totalCpLoss += cpLoss;
    }

    const ply = i + 1;
    const moveNumber = Math.floor(i / 2) + 1;
    
    const analysisMove: AnalysisMove = {
      ply,
      move_number: moveNumber,
      color: move.color === 'w' ? 'white' : 'black',
      san: move.san,
      uci: move.lan || (move.from + move.to + (move.promotion || '')),
      fen_before: fenBefore,
      fen_after: fenAfter,
      best_eval_cp: bestEvalForMover,
      played_eval_cp: playedEvalForMover,
      cp_loss: cpLoss,
      classification,
      best_move: bestMoveUci,
      note: getPersonalizedNote(classification, cpLoss, styleVector)
    };
    
    analysisMoves.push(analysisMove);
    
    if (options.onProgress) {
      options.onProgress(i + 1, movesToAnalyze);
    }
  }
  
  const analyzedCount = analysisMoves.length;
  const avgCpLoss = analyzedCount > 0 ? Math.round(totalCpLoss / analyzedCount) : 0;
  const accuracy = clamp(100 - avgCpLoss / 5, 0, 100);
  
  const summary: AnalysisSummary = {
    total_moves: totalMoves,
    analyzed_moves: analyzedCount,
    average_cp_loss: avgCpLoss,
    accuracy_estimate: Math.round(accuracy),
    best_count: bestCount,
    good_count: goodCount,
    inaccuracy_count: inaccuracyCount,
    mistake_count: mistakeCount,
    blunder_count: blunderCount,
  };
  
  const record: AnalysisRecord = {
    id: `analysis-${Date.now()}`,
    player_id: playerId,
    match_id: matchId,
    match_type: matchType,
    source: 'local_stockfish',
    engine_depth: depth,
    status: 'complete',
    created_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    pgn,
    summary,
    moves: analysisMoves
  };
  
  return record;
}
