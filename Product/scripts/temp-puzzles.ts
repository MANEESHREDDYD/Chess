import { CluePuzzle } from '../src/data/cluePuzzles';

export const newPuzzles: CluePuzzle[] = [
  {
    id: "seed-multi-mate-1",
    fen: "r5k1/pp3ppp/8/8/8/8/PP2QPPP/4R1K1 w - - 0 1",
    solution_moves: ["e2e8"], // Fallback
    solution_line: [
      { ply: 1, side: "user", move: "e2e8", san: "Qe8+" },
      { ply: 2, side: "opponent", move: "a8e8", san: "Rxe8" },
      { ply: 3, side: "user", move: "e1e8", san: "Rxe8#" }
    ],
    motif: "mate",
    difficulty: "casual",
    title: "The Decoy Sacrifice",
    explanation: "By sacrificing the queen on e8, you force the black rook away from defending the back rank, allowing your rook to deliver checkmate.",
    clue_levels: [
      "Look at the back rank.",
      "Your rook and queen are doubled on the e-file.",
      "If you check on e8, Black must take.",
      "Sacrifice your queen to deflect the rook!"
    ],
    step_clues: {
      0: ["Look for a forcing check.", "Sacrifice your highest value piece on the back rank."],
      2: ["Now finish the job.", "Recapture on e8 for checkmate!"]
    }
  },
  {
    id: "seed-multi-deflection-1",
    fen: "3r2k1/3q1ppp/8/8/8/8/3Q1PPP/3R2K1 w - - 0 1",
    solution_moves: ["d2d7"],
    solution_line: [
      { ply: 1, side: "user", move: "d2d7", san: "Qxd7" },
      { ply: 2, side: "opponent", move: "d8d7", san: "Rxd7" },
      { ply: 3, side: "user", move: "d1d7", san: "Rxd7" }
    ],
    motif: "removing_the_defender",
    difficulty: "beginner",
    title: "Liquidating to an Advantage",
    explanation: "By trading queens, you force the exchange of pieces because your rook is backing up your queen. You end up winning a free rook in the end.",
    clue_levels: [
      "Look at the tension on the d-file.",
      "Count the attackers and defenders.",
      "You have two attackers on d7, Black has two defenders.",
      "Wait, Black only has one defender (the rook)!"
    ],
    step_clues: {
      0: ["Initiate the trade on d7."],
      2: ["Recapture the rook to win the exchange."]
    }
  },
  {
    id: "seed-multi-remove-defender-1",
    fen: "6k1/p4ppp/1n6/2q5/8/1Q6/P4PPP/4R1K1 w - - 0 1",
    solution_moves: ["e1e8"],
    solution_line: [
      { ply: 1, side: "user", move: "e1e8", san: "Re8+" },
      { ply: 2, side: "opponent", move: "c5f8", san: "Qf8" },
      { ply: 3, side: "user", move: "e8f8", san: "Rxf8+" }
    ],
    motif: "removing_the_defender",
    difficulty: "casual",
    title: "Pin and Win",
    explanation: "The check on the back rank forces the black queen to block, abandoning its post and allowing you to win it for a rook.",
    clue_levels: [
      "Look for a check.",
      "The back rank is weak.",
      "Force the queen to block on f8.",
      "Win the queen."
    ],
    step_clues: {
      0: ["Deliver a check on the back rank."],
      2: ["Capture the pinned piece."]
    }
  }
];
