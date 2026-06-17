import { useMemo, useRef } from 'react';
import { useFrame, useLoader, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import {
  SQUARE_SIZE,
  squareToPosition,
  type BattlefieldHighlights,
  type SquareName,
} from './battlefieldTypes';

const BOARD_TEXTURE_URL = '/assets/3d/kurukshetra-realism-v1/realistic-board-texture.png';

const boardTextureGeo = new THREE.PlaneGeometry(SQUARE_SIZE * 9.12, SQUARE_SIZE * 9.12);
const hitSquareGeo = new THREE.PlaneGeometry(SQUARE_SIZE, SQUARE_SIZE);
const hitSquareMat = new THREE.MeshBasicMaterial({
  color: '#ffffff',
  transparent: true,
  opacity: 0,
  depthWrite: false,
  side: THREE.DoubleSide,
});

const legalTargetGeo = new THREE.PlaneGeometry(SQUARE_SIZE * 0.28, SQUARE_SIZE * 0.28);
const captureTargetGeo = new THREE.PlaneGeometry(SQUARE_SIZE * 0.76, SQUARE_SIZE * 0.76);
const selectedGeo = new THREE.PlaneGeometry(SQUARE_SIZE * 0.9, SQUARE_SIZE * 0.9);

const legalMat = new THREE.MeshBasicMaterial({ color: '#8eb7df', transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false });
const captureMat = new THREE.MeshBasicMaterial({ color: '#d6b06f', transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false });
const selectedMat = new THREE.MeshBasicMaterial({ color: '#8eb7df', transparent: true, opacity: 0.26, side: THREE.DoubleSide, depthWrite: false });
const lastMoveMat = new THREE.MeshBasicMaterial({ color: '#8eb7df', transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false });
const checkMat = new THREE.MeshBasicMaterial({ color: '#ff453a', transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false });
const lastMoveGeo = new THREE.PlaneGeometry(SQUARE_SIZE * 0.96, SQUARE_SIZE * 0.96);

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

type BattlefieldBoardProps = {
  highlights: BattlefieldHighlights;
  onSquareClick: (square: SquareName) => void;
  reducedMotion: boolean;
};

export function BattlefieldBoard({ highlights, onSquareClick, reducedMotion }: BattlefieldBoardProps) {
  const checkRef = useRef<THREE.Mesh>(null);
  const boardTexture = useLoader(THREE.TextureLoader, BOARD_TEXTURE_URL);

  useMemo(() => {
    boardTexture.colorSpace = THREE.SRGBColorSpace;
    boardTexture.anisotropy = 8;
    boardTexture.needsUpdate = true;
  }, [boardTexture]);

  const boardMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: boardTexture,
        roughness: 0.86,
        metalness: 0.08,
      }),
    [boardTexture]
  );

  const squares = useMemo(() => {
    const list: Array<{ square: SquareName; pos: [number, number, number] }> = [];
    for (const file of FILES) {
      for (let rank = 1; rank <= 8; rank += 1) {
        const square = `${file}${rank}`;
        list.push({ square, pos: squareToPosition(square) });
      }
    }
    return list;
  }, []);

  useFrame(({ clock }) => {
    if (checkRef.current && !reducedMotion) {
      const pulse = 0.75 + Math.sin(clock.elapsedTime * 6) * 0.25;
      checkRef.current.scale.setScalar(pulse);
    }
  });

  const handleClick = (square: SquareName) => (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onSquareClick(square);
  };

  return (
    <group name="battlefield-board">
      <mesh
        geometry={boardTextureGeo}
        material={boardMat}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.006, 0]}
        receiveShadow
      />

      {squares.map(({ square, pos }) => (
        <mesh
          key={square}
          name={`square-${square}`}
          geometry={hitSquareGeo}
          material={hitSquareMat}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[pos[0], 0.006, pos[2]]}
          onClick={handleClick(square)}
        />
      ))}

      {highlights.lastMove.map((square) => {
        const pos = squareToPosition(square);
        return (
          <mesh key={`last-${square}`} geometry={lastMoveGeo} material={lastMoveMat} rotation={[-Math.PI / 2, 0, 0]} position={[pos[0], 0.012, pos[2]]} />
        );
      })}
      {highlights.selected ? (
        <mesh
          geometry={selectedGeo}
          material={selectedMat}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[squareToPosition(highlights.selected)[0], 0.014, squareToPosition(highlights.selected)[2]]}
        />
      ) : null}
      {highlights.legalMoves.map((square) => {
        const pos = squareToPosition(square);
        const capture = highlights.captureMoves.includes(square);
        return (
          <mesh
            key={`legal-${square}`}
            geometry={capture ? captureTargetGeo : legalTargetGeo}
            material={capture ? captureMat : legalMat}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[pos[0], 0.013, pos[2]]}
          />
        );
      })}
      {highlights.checkSquare ? (
        <mesh
          ref={checkRef}
          geometry={selectedGeo}
          material={checkMat}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[squareToPosition(highlights.checkSquare)[0], 0.016, squareToPosition(highlights.checkSquare)[2]]}
        />
      ) : null}
    </group>
  );
}
