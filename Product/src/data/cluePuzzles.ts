export interface CluePuzzle {
  id: string;
  fen: string;
  solution_moves: string[];
  motif: "fork" | "pin" | "skewer" | "removing_the_defender" | "mate" | "hanging_piece" | "endgame" | "opening" | "unknown";
  difficulty: "beginner" | "casual" | "club" | "strong";
  title: string;
  explanation: string;
  clue_levels: string[];
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
  }
];
