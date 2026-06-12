import { useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Chess } from 'chess.js';
import { BattlefieldBoard } from './BattlefieldBoard';
import { BattlefieldCamera } from './BattlefieldCamera';
import { BattlefieldDust } from './BattlefieldEffects';
import { BattlefieldPiece } from './BattlefieldPiece';
import { BattlefieldProps } from './BattlefieldProps';
import { useBattlefieldProductionModels } from './useBattlefieldProductionModels';
import { useBattlefieldPieces } from './useBattlefieldAnimations';
import type { BattlefieldHighlights, SquareName } from './battlefieldTypes';

type BattlefieldSceneProps = {
  fen: string;
  playerColor: 'white' | 'black';
  status: 'idle' | 'playing' | 'game-over';
  engineThinking: boolean;
  onMove: (from: string, to: string, promotion?: 'q' | 'r' | 'b' | 'n') => boolean;
  reducedMotion: boolean;
};

/**
 * Kurukshetra Battlefield Mode.
 *
 * Rendering only: chess.js inside the game store remains the rules authority.
 * The current visuals are a reference-guided procedural prototype, not final
 * realistic character art. Production realism still requires approved,
 * licensed or project-authored models, rigs, and animations.
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
  const productionModels = useBattlefieldProductionModels();

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

  useEffect(() => {
    const w = window as typeof window & {
      __BATTLEFIELD_TEST__?: {
        clickSquare: (square: string) => void;
        selected: () => string | null;
        modelStatus: () => {
          mode: string;
          checked: boolean;
          available: number;
          detected: number;
          missing: number;
        };
      };
    };
    w.__BATTLEFIELD_TEST__ = {
      clickSquare: (square: string) => handleSquareClick(square),
      selected: () => selected,
      modelStatus: () => ({
        mode: productionModels.mode,
        checked: productionModels.checked,
        available: productionModels.availableUrls.size,
        detected: productionModels.detectedUrls.size,
        missing: productionModels.missingUrls.length,
      }),
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
        <color attach="background" args={['#8f887e']} />
        <fog attach="fog" args={['#8f887e', 15, 32]} />
        <ambientLight intensity={0.14} />
        <hemisphereLight args={['#f4ead8', '#4f463d', 0.9]} />
        <directionalLight
          position={[5.2, 10.5, 6.6]}
          intensity={2.25}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-bias={-0.00035}
          shadow-camera-left={-9}
          shadow-camera-right={9}
          shadow-camera-top={9}
          shadow-camera-bottom={-9}
        />
        <directionalLight position={[-5, 5.5, -6]} intensity={0.5} color="#b8c4d6" />
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
            availableModelUrls={productionModels.availableUrls}
            onSquareClick={handleSquareClick}
          />
        ))}
      </Canvas>
    </div>
  );
}

export default BattlefieldScene;
