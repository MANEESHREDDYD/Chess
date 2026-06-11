import { useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Chess } from 'chess.js';
import { BattlefieldBoard } from './BattlefieldBoard';
import { BattlefieldCamera } from './BattlefieldCamera';
import { BattlefieldDust } from './BattlefieldEffects';
import { BattlefieldPiece } from './BattlefieldPiece';
import { BattlefieldProps } from './BattlefieldProps';
import { useBattlefieldPieces } from './useBattlefieldAnimations';
import type { BattlefieldHighlights, SquareName } from './battlefieldTypes';

type BattlefieldSceneProps = {
  fen: string;
  playerColor: 'white' | 'black';
  status: 'idle' | 'playing' | 'game-over';
  engineThinking: boolean;
  /** Same legal-move pipeline the 2D board uses (gameStore.makePlayerMove). */
  onMove: (from: string, to: string, promotion?: 'q' | 'r' | 'b' | 'n') => boolean;
  reducedMotion: boolean;
};

/**
 * Kurukshetra Battlefield Mode — procedural low-poly placeholder scene.
 *
 * Rendering only: chess.js (inside the game store) stays the rules authority.
 * This component derives selection/legal-move/check display state from the
 * FEN and forwards square clicks into the existing move pipeline.
 * Promotion auto-queens in 3D (documented limitation).
 */
export function BattlefieldScene({
  fen,
  playerColor,
  status,
  engineThinking,
  onMove,
  reducedMotion,
}: BattlefieldSceneProps) {
  const [selected, setSelected] = useState<SquareName | null>(null);
  const pieces = useBattlefieldPieces(fen);

  const helpers = useMemo(() => {
    try {
      const chess = new Chess(fen);
      const verbose = selected
        ? chess.moves({ square: selected as never, verbose: true })
        : [];
      let checkSquare: SquareName | null = null;
      if (chess.inCheck()) {
        const color = chess.turn();
        outer: for (const row of chess.board()) {
          for (const cell of row) {
            if (cell && cell.type === 'k' && cell.color === color) {
              checkSquare = cell.square;
              break outer;
            }
          }
        }
      }
      return { chess, verbose, checkSquare };
    } catch {
      return { chess: null, verbose: [], checkSquare: null };
    }
  }, [fen, selected]);

  const lastMove = useMemo(() => {
    const moved = pieces.find((p) => p.fromSquare !== null && p.capturedAt === null);
    return moved ? [moved.fromSquare as SquareName, moved.square] : [];
  }, [pieces]);

  const highlights: BattlefieldHighlights = {
    selected,
    legalMoves: helpers.verbose.map((m) => m.to),
    captureMoves: helpers.verbose.filter((m) => m.flags.includes('c') || m.flags.includes('e')).map((m) => m.to),
    lastMove,
    checkSquare: helpers.checkSquare,
  };

  const handleSquareClick = (square: SquareName) => {
    if (status !== 'playing' || engineThinking || !helpers.chess) return;

    if (selected) {
      const move = helpers.verbose.find((m) => m.to === square);
      if (move) {
        onMove(selected, square, move.promotion ? 'q' : undefined);
        setSelected(null);
        return;
      }
    }
    const piece = helpers.chess.get(square as never);
    if (piece && piece.color === helpers.chess.turn()) {
      setSelected(square);
      return;
    }
    setSelected(null);
  };

  // Test hook: lets browser QA scripts drive square clicks deterministically
  // (screen-space raycast coordinates depend on camera state). Rendering-only;
  // the move still flows through the same legal pipeline.
  useEffect(() => {
    const w = window as typeof window & {
      __BATTLEFIELD_TEST__?: { clickSquare: (square: string) => void; selected: () => string | null };
    };
    w.__BATTLEFIELD_TEST__ = {
      clickSquare: (square: string) => handleSquareClick(square),
      selected: () => selected,
    };
    return () => {
      delete w.__BATTLEFIELD_TEST__;
    };
  });

  return (
    <div className="battlefield-stage" data-qa="battlefield-3d">
      <Canvas
        shadows
        dpr={[1, 1.75]}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        onPointerMissed={() => setSelected(null)}
      >
        {/* Dusk sky matching the fog so the horizon never reads as a void. */}
        <color attach="background" args={['#cbb497']} />
        <fog attach="fog" args={['#cbb497', 18, 34]} />
        <hemisphereLight args={['#f2e9d8', '#6b5b46', 0.75]} />
        <directionalLight
          position={[7, 11, 5]}
          intensity={1.6}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-camera-left={-9}
          shadow-camera-right={9}
          shadow-camera-top={9}
          shadow-camera-bottom={-9}
        />
        <BattlefieldCamera playerColor={playerColor} />
        <BattlefieldProps />
        <BattlefieldDust reducedMotion={reducedMotion} />
        <BattlefieldBoard
          highlights={highlights}
          onSquareClick={handleSquareClick}
          reducedMotion={reducedMotion}
        />
        {pieces.map((piece) => (
          <BattlefieldPiece
            key={piece.id}
            piece={piece}
            reducedMotion={reducedMotion}
            onSquareClick={handleSquareClick}
          />
        ))}
      </Canvas>
    </div>
  );
}

export default BattlefieldScene;
