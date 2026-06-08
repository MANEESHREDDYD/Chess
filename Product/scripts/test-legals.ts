import { Chess } from 'chess.js';
const c = new Chess("r2qkbnr/ppp2ppp/2np4/4N2b/2B1P3/2N5/PPPP1PPP/R1BQK2R w KQkq - 0 6");
const m1 = c.move("c4f7");
console.log(m1);
const m2 = c.move("e8e7");
console.log(m2);
const m3 = c.move("c3d5");
console.log(m3);
console.log(c.isCheckmate());
