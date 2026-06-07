import fs from 'fs';
import path from 'path';

function reproduce() {
  const mirrorSrc = fs.readFileSync(path.join(process.cwd(), 'src/routes/Mirror.tsx'), 'utf-8');
  
  const hasColorState = mirrorSrc.includes('setPlayerColor');
  const hardcodedWhite = mirrorSrc.includes('playerColor="white"');
  const blocksBlackMove = mirrorSrc.includes("if (gameRef.current.turn() !== 'w') return false;");

  console.log('--- Bug Reproduction: Color Locking in Mirror.tsx ---');
  console.log(`Has playerColor state? ${hasColorState}`);
  console.log(`Has hardcoded playerColor="white"? ${hardcodedWhite}`);
  console.log(`Blocks player moving black pieces? ${blocksBlackMove}`);

  if (!hasColorState && hardcodedWhite && blocksBlackMove) {
    console.log('✅ BUG REPRODUCED: The UI is completely locked to White. The human cannot play Black, and the Mirror never makes the first move because it only moves in response to a player move.');
    process.exit(1); // Exit 1 to represent the failing test
  } else {
    console.log('❌ Bug not reproduced or already fixed.');
    process.exit(0);
  }
}

reproduce();
