import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
 * The current visuals are a reference-guided mixed asset prototype. Human and
 * mounted-rider slots use CharMorph/MB-Lab skinned GLBs; animal/vehicle shells
 * still need approved realistic rigs, PBR materials, and combat animations.
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
  const selectedRef = useRef<SquareName | null>(null);
  const fenRef = useRef(fen);
  const statusRef = useRef(status);
  const engineThinkingRef = useRef(engineThinking);
  const onMoveRef = useRef(onMove);
  const pieces = useBattlefieldPieces(fen);
  const productionModels = useBattlefieldProductionModels();

  fenRef.current = fen;
  statusRef.current = status;
  engineThinkingRef.current = engineThinking;
  onMoveRef.current = onMove;

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

  const handleSquareClick = useCallback((square: SquareName) => {
    if (statusRef.current !== 'playing' || engineThinkingRef.current) return;

    let chess: Chess;
    try {
      chess = new Chess(fenRef.current);
    } catch {
      selectedRef.current = null;
      setSelected(null);
      return;
    }

    const currentSelected = selectedRef.current;
    if (currentSelected) {
      const move = chess.moves({ square: currentSelected as never, verbose: true }).find((m) => m.to === square);
      if (move) {
        onMoveRef.current(currentSelected, square, move.promotion ? 'q' : undefined);
        selectedRef.current = null;
        setSelected(null);
        return;
      }
    }
    const piece = chess.get(square as never);
    if (piece && piece.color === chess.turn()) {
      selectedRef.current = square;
      setSelected(square);
      return;
    }
    selectedRef.current = null;
    setSelected(null);
  }, []);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  useEffect(() => {
    selectedRef.current = null;
    setSelected(null);
  }, [fen, playerColor, status]);

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
        <ambientLight intensity={0.24} />
        <hemisphereLight args={['#f7ecdc', '#62584e', 1.05]} />
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
        <directionalLight position={[-5, 5.5, -6]} intensity={0.82} color="#c8d3e4" />
        <directionalLight position={[0, 3.8, -7.5]} intensity={0.48} color="#ffe7c4" />
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
            checked={piece.square === highlights.checkSquare}
          />
        ))}
      </Canvas>
    </div>
  );
}

export default BattlefieldScene;
