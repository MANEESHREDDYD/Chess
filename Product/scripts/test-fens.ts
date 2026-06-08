import { Chess } from 'chess.js';

const puzzles = [
  {
    fen: "r5k1/pp3ppp/8/8/8/8/PP2QPPP/4R1K1 w - - 0 1",
    moves: ["e2e8", "a8e8", "e1e8"]
  },
  {
    fen: "3r2k1/3q1ppp/8/8/8/8/3Q1PPP/3R2K1 w - - 0 1",
    moves: ["d2d7", "d8d7", "d1d7"]
  },
  {
    fen: "6k1/p4ppp/1n6/2q5/8/1Q6/P4PPP/4R1K1 w - - 0 1",
    moves: ["e1e8", "c5f8", "e8f8"]
  }
];

puzzles.forEach((p, i) => {
  const c = new Chess(p.fen);
  console.log(`Puzzle ${i+1}`);
  p.moves.forEach(m => {
    try {
      const res = c.move(m);
      console.log(`  Move ${m} -> ${res ? 'OK' : 'FAIL'} FEN: ${c.fen()}`);
    } catch(e) {
      console.log(`  Move ${m} -> ERROR ${e.message}`);
    }
  });
});
