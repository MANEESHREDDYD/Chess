export interface PuzzleLineStep {
  ply: number;
  side: "user" | "opponent";
  move: string;
  san?: string;
  note?: string;
}

export interface CluePuzzle {
  id: string;
  fen: string;
  solution_moves: string[];
  solution_line?: PuzzleLineStep[];
  motif: "fork" | "pin" | "skewer" | "removing_the_defender" | "mate" | "hanging_piece" | "endgame" | "opening" | "defense" | "sacrifice" | "discovered_attack" | "unknown";
  difficulty: "beginner" | "casual" | "club" | "strong";
  title: string;
  explanation: string;
  clue_levels: string[];
  step_clues?: Record<number, string[]>;
}

export const seedPuzzles: CluePuzzle[] = [
  {
    id: "seed-mate-1",
    fen: "6k1/5ppp/8/8/8/8/8/1R4K1 w - - 0 1",
    solution_moves: ["b1b8"],
    motif: "mate",
    difficulty: "beginner",
    title: "Back Rank Mate",
    explanation: "The black king is trapped behind its own pawns. A check on the back rank results in checkmate.",
    clue_levels: [
      "Look for a forcing move.",
      "Identify weaknesses around the enemy king.",
      "The black king is trapped by its own pawns.",
      "A check on the 8th rank would be fatal.",
      "Move the rook to the back rank to deliver checkmate."
    ]
  },
  {
    id: "seed-hanging-1",
    fen: "1k6/8/8/8/3q4/8/8/3Q2K1 w - - 0 1",
    solution_moves: ["d1d4"],
    motif: "hanging_piece",
    difficulty: "beginner",
    title: "Free Material",
    explanation: "The queen is unprotected and can be taken for free.",
    clue_levels: [
      "Look for captures.",
      "Check which enemy pieces are undefended.",
      "The black queen has no defenders.",
      "Your queen can take their queen.",
      "Capture the black queen on d4."
    ]
  },
  {
    id: "seed-fork-1",
    fen: "8/8/4k3/8/3r4/8/3N4/6K1 w - - 0 1",
    solution_moves: ["d2f3"],
    motif: "fork",
    difficulty: "beginner",
    title: "Knight Fork",
    explanation: "The knight can attack both the king and the rook at the same time.",
    clue_levels: [
      "Look for a knight move that attacks multiple pieces.",
      "The black king and rook are on squares a knight can reach.",
      "The f3 square looks very interesting.",
      "Moving the knight to f3 will check the king.",
      "Play Nf3 to fork the king and rook."
    ]
  },
  {
    id: "seed-pin-1",
    fen: "4k3/4r3/8/8/8/4R3/8/4K3 w - - 0 1",
    solution_moves: ["e3e7"],
    motif: "pin",
    difficulty: "beginner",
    title: "Capture the Pinned Piece",
    explanation: "The black rook is pinned to its king and cannot run away.",
    clue_levels: [
      "Look for a piece that cannot move.",
      "Identify the relationship between the black pieces on the e-file.",
      "The black rook is pinned.",
      "White's rook is attacking it safely.",
      "Capture the pinned rook on e7."
    ]
  },
  {
    id: "seed-skewer-1",
    fen: "8/8/8/8/4k3/8/8/R3q2K w - - 0 1",
    solution_moves: ["a1e1"],
    motif: "skewer",
    difficulty: "beginner",
    title: "Rook Skewer",
    explanation: "The rook can capture the queen.",
    clue_levels: [
      "Look for a capture.",
      "The enemy queen is vulnerable.",
      "Your rook is on the same file.",
      "The queen is unprotected on e1.",
      "Capture the queen with Rxe1."
    ]
  },
  {
    id: "seed-mate-2",
    fen: "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 0 1",
    solution_moves: ["h5f7"],
    motif: "mate",
    difficulty: "beginner",
    title: "Scholar's Mate",
    explanation: "The classic Scholar's Mate. The queen and bishop coordinate on f7.",
    clue_levels: [
      "Look for a forcing move.",
      "Find the weakest point in black's camp.",
      "The f7 pawn is only defended by the king.",
      "Your bishop and queen both attack f7.",
      "Deliver checkmate by capturing on f7."
    ]
  },
  {
    id: "seed-skewer-2",
    fen: "8/8/8/8/8/2k5/8/R6K w - - 0 1",
    solution_moves: ["a1c1"],
    motif: "skewer",
    difficulty: "beginner",
    title: "Checking the King",
    explanation: "Check the king with the rook.",
    clue_levels: [
      "Look for a check.",
      "The king is on the c-file.",
      "Rooks like open files.",
      "Move the rook to the c-file.",
      "Play Rc1+."
    ]
  },
  {
    id: "seed-hanging-2",
    fen: "2k5/8/8/8/8/8/4N3/2K3q1 w - - 0 1",
    solution_moves: ["e2g1"],
    motif: "hanging_piece",
    difficulty: "beginner",
    title: "Hanging Queen",
    explanation: "The queen is simply hanging to the knight.",
    clue_levels: [
      "Look for captures.",
      "The enemy queen is vulnerable.",
      "Your knight can move.",
      "The knight can jump to g1.",
      "Capture the queen with Nxg1."
    ]
  },
  {
    id: "seed-endgame-1",
    fen: "8/8/8/8/8/5k2/5p2/R4K2 w - - 0 1",
    solution_moves: ["a1a3"],
    motif: "endgame",
    difficulty: "casual",
    title: "Defending against promotion",
    explanation: "Check the king from behind to stop the pawn.",
    clue_levels: [
      "Look for a check.",
      "The black pawn is about to promote.",
      "Your king is stuck.",
      "You need to use your rook.",
      "Play Ra3+."
    ]
  },
  {
    id: "seed-fork-2",
    fen: "r1bqk2r/pppp1ppp/2n5/2b1p3/2B1P1n1/2NP4/PPP2PPP/R1BQK1NR w KQkq - 0 1",
    solution_moves: ["d1g4"],
    motif: "hanging_piece",
    difficulty: "casual",
    title: "Watch the Knight",
    explanation: "The knight on g4 is unprotected.",
    clue_levels: [
      "Look for captures.",
      "Check which enemy pieces are undefended.",
      "The black knight on g4 has no defenders.",
      "Your queen can take their knight.",
      "Capture the black knight with Qxg4."
    ]
  },
  {
    id: "seed-pin-2",
    fen: "4k3/8/8/8/4r3/8/8/4R1K1 w - - 0 1",
    solution_moves: ["e1e4"],
    motif: "pin",
    difficulty: "beginner",
    title: "Absolute Pin",
    explanation: "The rook is pinned to the king.",
    clue_levels: [
      "Look for a piece that cannot move.",
      "Identify the relationship between the black pieces.",
      "The black rook is pinned.",
      "White's rook is attacking it.",
      "Capture the pinned rook with Rxe4."
    ]
  },
  {
    id: "seed-removing_defender-1",
    fen: "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 0 1",
    solution_moves: ["f3e5"],
    motif: "removing_the_defender",
    difficulty: "casual",
    title: "Center Trick",
    explanation: "A common center trick to win a pawn and control the center.",
    clue_levels: [
      "Look for a forcing move.",
      "Identify the defenders in the center.",
      "The e5 pawn is defended by the knight.",
      "There is a trick involving a temporary sacrifice.",
      "Capture the e5 pawn with your knight."
    ]
  },
  {
    id: "seed-mate-3",
    fen: "5rk1/5ppp/8/8/8/8/5PPP/1R4K1 w - - 0 1",
    solution_moves: ["b1b8"],
    motif: "mate",
    difficulty: "beginner",
    title: "Rook endgame mate",
    explanation: "Another back rank mate setup.",
    clue_levels: [
      "Look for a move that checks.",
      "Move the rook.",
      "The back rank is weak.",
      "A check on the back rank forces a response.",
      "Play Rb8."
    ]
  },
  {
    id: "seed-unknown-1",
    fen: "r3k2r/ppp2ppp/2n5/3q4/3P4/5N2/PP1Q1PPP/R3K2R w KQkq - 0 1",
    solution_moves: ["e1g1"],
    motif: "unknown",
    difficulty: "beginner",
    title: "Castling",
    explanation: "Get the king to safety.",
    clue_levels: [
      "Look for a king safety move.",
      "Your king is in the center.",
      "You can castle.",
      "Kingside castling is available.",
      "Play O-O."
    ]
  },
  {
    id: "seed-endgame-2",
    fen: "1k6/1P6/1K6/8/8/8/8/6R1 w - - 0 1",
    solution_moves: ["g1g8"],
    motif: "mate",
    difficulty: "beginner",
    title: "Rook and King Mate",
    explanation: "The king cuts off the escape squares, the rook delivers mate.",
    clue_levels: [
      "Look for a forcing move.",
      "The black king is restricted by your king.",
      "The black king cannot move to the 7th rank.",
      "A check on the 8th rank would be mate.",
      "Move the rook to g8 for checkmate."
    ]
  },
  {
    id: "seed-fork-3",
    fen: "2rq1rk1/pp1b1ppp/2n1pn2/8/1b1P4/2N2N2/PPQ1BPPP/R1BR2K1 w - - 0 1",
    solution_moves: ["a2a3"],
    motif: "unknown",
    difficulty: "casual",
    title: "Kick the Bishop",
    explanation: "Force the bishop to decide.",
    clue_levels: [
      "Look for a pawn move.",
      "The black bishop is annoying on b4.",
      "You can attack it.",
      "Push the a-pawn.",
      "Play a3 to attack the bishop."
    ]
  },
  {
    id: "seed-pin-3",
    fen: "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1",
    solution_moves: ["g1f3"],
    motif: "opening",
    difficulty: "beginner",
    title: "Develop a piece",
    explanation: "Develop your kingside knight towards the center.",
    clue_levels: [
      "Look for a developing move.",
      "Control the center.",
      "Develop a minor piece.",
      "The kingside knight is well placed on f3.",
      "Play Nf3."
    ]
  },
  {
    id: "seed-skewer-3",
    fen: "7k/8/8/r7/8/B7/8/7K w - - 0 1",
    solution_moves: ["a3b2"],
    motif: "skewer",
    difficulty: "casual",
    title: "Bishop check",
    explanation: "The bishop can safely check the king.",
    clue_levels: [
      "Look for a check.",
      "Your bishop can reach the long diagonal.",
      "The king is on the corner square.",
      "Move the bishop to the b2 square.",
      "Play Bb2+."
    ]
  },
  {
    id: "seed-fork-4",
    fen: "2k5/8/8/8/8/8/3NN3/2K5 w - - 0 1",
    solution_moves: ["d2e4"],
    motif: "unknown",
    difficulty: "beginner",
    title: "Centralize the Knight",
    explanation: "Move the knight towards the center.",
    clue_levels: [
      "Look for a knight move.",
      "Knights are best placed in the center.",
      "The e4 square is a great outpost.",
      "Move the d2 knight.",
      "Play Ne4."
    ]
  },
  {
    id: "seed-mate-4",
    fen: "6k1/5ppp/8/8/8/8/7P/1R4K1 w - - 0 1",
    solution_moves: ["b1b8"],
    motif: "mate",
    difficulty: "beginner",
    title: "Back Rank Mate 2",
    explanation: "Another back rank mate.",
    clue_levels: [
      "Look for a forcing move.",
      "Identify weaknesses around the enemy king.",
      "The black king is trapped by its own pawns.",
      "A check on the 8th rank would be fatal.",
      "Move the rook to the back rank."
    ]
  },
  {
    id: "seed-mate-bhima",
    fen: "r1b2k1r/pppp1p1p/2n4B/8/8/8/PPP2PPP/R3R1K1 w - - 0 1",
    solution_moves: ["e1e8"],
    motif: "mate",
    difficulty: "beginner",
    title: "The Direct Path",
    explanation: "The bishop controls the escape squares. The rook delivers the final blow.",
    clue_levels: [
      "Look for a forcing check.",
      "The black king is trapped by your bishop.",
      "The e8 square is unguarded by black pieces.",
      "Bring the rook to the back rank.",
      "Play Re8#."
    ]
  },
  {
    id: "seed-defense-drona",
    fen: "8/p7/1k6/8/8/8/1K6/R6q w - - 0 1",
    solution_moves: ["a1h1"],
    motif: "hanging_piece",
    difficulty: "beginner",
    title: "See the Whole Board",
    explanation: "The enemy queen has strayed too far and is completely unprotected.",
    clue_levels: [
      "Look at every piece on the board.",
      "Is there a piece in danger?",
      "The black queen is isolated.",
      "Your rook can reach the other side of the board.",
      "Capture the hanging queen with Rxh1."
    ]
  },
  {
    id: "seed-tactics-karna",
    fen: "k7/2p5/1p6/pP1p4/P2P4/8/3K4/2Q5 w - - 0 1",
    solution_moves: ["c1c6"],
    motif: "endgame",
    difficulty: "casual",
    title: "The Risk of Recklessness",
    explanation: "Capturing the c7 pawn immediately results in a stalemate. You must check the king first.",
    clue_levels: [
      "Look for a forcing move.",
      "Beware of stalemate if you capture blindly.",
      "The black king has very few squares.",
      "Force the king to move before capturing.",
      "Play Qc6+."
    ]
  },
  {
    id: "seed-strategy-krishna",
    fen: "4r1k1/5ppp/8/3Q4/8/8/4q1PP/5R1K w - - 0 1",
    solution_moves: ["d5f7"],
    motif: "mate",
    difficulty: "club",
    title: "The Difficult Choice",
    explanation: "Sacrificing the queen will eventually lead to a forced back-rank mate.",
    clue_levels: [
      "Look at the weakness on f7 and the back rank.",
      "Your queen and rook coordinate on f7.",
      "A check on f7 forces the king into the corner.",
      "Sometimes the most valuable piece must be given up.",
      "Play Qxf7+."
    ]
  },
  {
    id: "seed-multi-mate-1",
    fen: "r5k1/pp3ppp/8/8/8/8/PP2QPPP/4R1K1 w - - 0 1",
    solution_moves: ["e2e8"],
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
  },
  {
    id: "seed-multi-legals-mate-1",
    fen: "r2qkbnr/ppp2ppp/2np4/4N2b/2B1P3/2N5/PPPP1PPP/R1BQK2R w KQkq - 0 6",
    solution_moves: ["c4f7"],
    solution_line: [
      { ply: 1, side: "user", move: "c4f7", san: "Bxf7+" },
      { ply: 2, side: "opponent", move: "e8e7", san: "Ke7" },
      { ply: 3, side: "user", move: "c3d5", san: "Nd5#" }
    ],
    motif: "mate",
    difficulty: "club",
    title: "Legal's Mate Conclusion",
    explanation: "Black accepted the queen sacrifice, allowing a beautiful forced mate with the minor pieces.",
    clue_levels: [
      "You just sacrificed your queen on d1.",
      "Find a forcing check.",
      "The bishop and knight can coordinate.",
      "Check on f7 with the bishop."
    ],
    step_clues: {
      0: ["Deliver a check with the bishop.", "Bxf7+ forces the king out."],
      2: ["Now jump in with the knight for checkmate.", "Nd5 covers all escape squares."]
    }
  },
  {
    id: "seed-multi-defense-1",
    fen: "6k1/p4ppp/8/8/8/8/5PPP/r3N1K1 w - - 0 1",
    solution_moves: ["g1f1"],
    solution_line: [
      { ply: 1, side: "user", move: "g1f1", san: "Kf1" },
      { ply: 2, side: "opponent", move: "a1e1", san: "Rxe1+" },
      { ply: 3, side: "user", move: "f1e1", san: "Kxe1" }
    ],
    motif: "defense",
    difficulty: "casual",
    title: "The Circle Narrows",
    explanation: "Defend the pinned knight with your king, preparing for the inevitable trade.",
    clue_levels: [
      "Your knight is pinned and under attack.",
      "You cannot save the knight by moving it.",
      "Defend it with your king."
    ],
    step_clues: {
      0: ["Bring your king to defend the knight on e1.", "Play Kf1."],
      2: ["Recapture the rook.", "Play Kxe1."]
    }
  },
  {
    id: "seed-defensive-resource-1",
    fen: "6k1/p4ppp/8/3q4/8/8/5PKP/8 w - - 0 1",
    solution_moves: ["f2f3"],
    motif: "defense",
    difficulty: "casual",
    title: "The Unbroken Vow",
    explanation: "The white king is in check. Blocking with the f-pawn is the only precise defense.",
    clue_levels: [
      "You are in check from the queen on d5.",
      "Moving the king leads to disaster.",
      "Block the diagonal.",
      "Push the f-pawn."
    ]
  },
  {
    id: "seed-multi-disrupt-1",
    fen: "r1b2r1k/1pp3pp/p7/4Np2/2Q5/8/PP3PPP/R5K1 w - - 0 1",
    solution_moves: ["e5f7"],
    solution_line: [
      { ply: 1, side: "user", move: "e5f7", san: "Nf7+" },
      { ply: 2, side: "opponent", move: "h8g8", san: "Kg8" },
      { ply: 3, side: "user", move: "f7h6", san: "Nh6+" },
      { ply: 4, side: "opponent", move: "g8h8", san: "Kh8" },
      { ply: 5, side: "user", move: "c4g8", san: "Qg8+" },
      { ply: 6, side: "opponent", move: "f8g8", san: "Rxg8" },
      { ply: 7, side: "user", move: "h6f7", san: "Nf7#" }
    ],
    motif: "sacrifice",
    difficulty: "strong",
    title: "The Night Tactic",
    explanation: "A classic smothered mate sequence involving a double check and a beautiful queen sacrifice.",
    clue_levels: [
      "Look for a forced sequence starting with a knight check.",
      "You can force the king into the corner.",
      "Prepare a double check.",
      "Sacrifice your queen to smother the king."
    ],
    step_clues: {
      0: ["Check with the knight on f7.", "Play Nf7+."],
      2: ["Deliver a double check with the knight.", "Play Nh6+."],
      4: ["Sacrifice the queen to force the rook away from the back rank.", "Play Qg8+."],
      6: ["The king is smothered. Deliver the final blow.", "Play Nf7#."]
    }
  },
  {
    id: "seed-discovered-attack-1",
    fen: "6k1/p2q1ppp/8/8/3B4/8/5PPP/3R2K1 w - - 0 1",
    solution_moves: ["d4g7"],
    motif: "discovered_attack",
    difficulty: "casual",
    title: "The Hidden File",
    explanation: "Moving the bishop reveals an attack from the rook on the black queen.",
    clue_levels: [
      "Look at the alignment on the d-file.",
      "Your bishop is blocking your rook.",
      "Move the bishop with a threat.",
      "Play Bxg7 to win material."
    ]
  },
  {
    id: "seed-mixed-motif-1",
    fen: "6k1/p4ppp/1q6/8/8/8/5PPP/2R3K1 w - - 0 1",
    solution_moves: ["c1c8"],
    motif: "mate",
    difficulty: "beginner",
    title: "The Field Before Dawn",
    explanation: "A classic back-rank mate concludes the act.",
    clue_levels: [
      "The black king has no escape squares.",
      "The back rank is completely undefended.",
      "Move your rook.",
      "Play Rc8#."
    ]
  },
  {
    id: "seed-act3-defense-line-1",
    fen: "3r2k1/p4ppp/8/8/8/8/PP1q1PPP/3R2K1 w - - 0 1",
    solution_moves: ["d1d2"],
    motif: "defense",
    difficulty: "casual",
    title: "The Line That Holds",
    explanation: "Defend against the threat by liquidating the attacking pieces.",
    clue_levels: [
      "Your back rank is under pressure.",
      "Look for a capture.",
      "Trading queens simplifies the position safely.",
      "Take the black queen."
    ]
  },
  {
    id: "seed-act3-poisoned-gain-1",
    fen: "3r2k1/p4ppp/8/8/8/1Q2q3/PP4PP/3R3K w - - 0 1",
    solution_moves: ["d1d8"],
    solution_line: [
      { ply: 1, side: "user", move: "d1d8", san: "Rxd8+" },
      { ply: 2, side: "opponent", move: "e3e8", san: "Qe8" },
      { ply: 3, side: "user", move: "d8e8", san: "Rxe8#" }
    ],
    motif: "sacrifice",
    difficulty: "strong",
    title: "The Poisoned Gain",
    explanation: "Taking the queen immediately loses to a back-rank mate. Instead, initiate a forced sequence that wins safely.",
    clue_levels: [
      "The obvious capture is a trap.",
      "Look for a check.",
      "Force the black queen to block on the back rank.",
      "Play Rxd8+."
    ]
  },
  {
    id: "seed-act3-open-file-1",
    fen: "4q1k1/p4ppp/8/8/4B3/8/PP3PPP/4R1K1 w - - 0 1",
    solution_moves: ["e4h7"],
    motif: "discovered_attack",
    difficulty: "casual",
    title: "The Open File",
    explanation: "Use a discovered attack with check to win the unprotected queen.",
    clue_levels: [
      "Your bishop is blocking your rook.",
      "Find a check.",
      "Sacrifice the bishop on h7.",
      "Play Bxh7+ to attack the queen."
    ]
  },
  {
    id: "seed-act3-calculation-1",
    fen: "r5k1/p4ppp/8/4Q3/8/8/PP3PPP/4R1K1 w - - 0 1",
    solution_moves: ["e5e8"],
    solution_line: [
      { ply: 1, side: "user", move: "e5e8", san: "Qe8+" },
      { ply: 2, side: "opponent", move: "a8e8", san: "Rxe8" },
      { ply: 3, side: "user", move: "e1e8", san: "Rxe8#" }
    ],
    motif: "mate",
    difficulty: "casual",
    title: "The Unquiet Calculation",
    explanation: "A forced sequence utilizing the weak back rank.",
    clue_levels: [
      "Look at the back rank.",
      "Sacrifice to open the file.",
      "The queen can be offered on e8.",
      "Play Qe8+ to force mate."
    ]
  }
];
