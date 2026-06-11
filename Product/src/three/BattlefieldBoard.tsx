import { useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import {
  SQUARE_SIZE,
  squareToPosition,
  type BattlefieldHighlights,
  type SquareName,
} from './battlefieldTypes';

/* Restrained sand/clay: warm tones live only inside the battlefield scene. */
const lightSquareMat = new THREE.MeshStandardMaterial({ color: '#d3bd8f', roughness: 0.92 });
const darkSquareMat = new THREE.MeshStandardMaterial({ color: '#8d654b', roughness: 0.94 });
const squareGeo = new THREE.BoxGeometry(SQUARE_SIZE * 0.985, 0.1, SQUARE_SIZE * 0.985);
const rimGeo = new THREE.BoxGeometry(SQUARE_SIZE * 8.5, 0.12, SQUARE_SIZE * 8.5);
const rimMat = new THREE.MeshStandardMaterial({ color: '#5f4734', roughness: 0.9, metalness: 0.08 });
const railGeo = new THREE.BoxGeometry(SQUARE_SIZE * 8.62, 0.12, 0.08);
const railSideGeo = new THREE.BoxGeometry(0.08, 0.12, SQUARE_SIZE * 8.62);
const railMat = new THREE.MeshStandardMaterial({ color: '#9a6f3d', roughness: 0.5, metalness: 0.58 });
const cornerGeo = new THREE.CylinderGeometry(0.12, 0.14, 0.1, 10);

const ringGeo = new THREE.RingGeometry(0.12, 0.2, 24);
const captureRingGeo = new THREE.RingGeometry(0.34, 0.45, 28);
const haloGeo = new THREE.RingGeometry(0.4, 0.48, 32);

const legalMat = new THREE.MeshBasicMaterial({ color: '#0a84ff', transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
const captureMat = new THREE.MeshBasicMaterial({ color: '#0a84ff', transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false });
const selectedMat = new THREE.MeshBasicMaterial({ color: '#409cff', transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false });
const lastMoveMat = new THREE.MeshBasicMaterial({ color: '#0a84ff', transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false });
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

  const squares = useMemo(() => {
    const list: Array<{ square: SquareName; pos: [number, number, number]; dark: boolean }> = [];
    for (const file of FILES) {
      for (let rank = 1; rank <= 8; rank += 1) {
        const square = `${file}${rank}`;
        const dark = (FILES.indexOf(file) + rank) % 2 === 0;
        list.push({ square, pos: squareToPosition(square), dark });
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
      <mesh geometry={rimGeo} material={rimMat} position={[0, -0.07, 0]} receiveShadow />
      <mesh geometry={railGeo} material={railMat} position={[0, 0.03, 4.31]} castShadow />
      <mesh geometry={railGeo} material={railMat} position={[0, 0.03, -4.31]} castShadow />
      <mesh geometry={railSideGeo} material={railMat} position={[4.31, 0.03, 0]} castShadow />
      <mesh geometry={railSideGeo} material={railMat} position={[-4.31, 0.03, 0]} castShadow />
      {[[-4.31, 4.31], [4.31, 4.31], [-4.31, -4.31], [4.31, -4.31]].map(([x, z]) => (
        <mesh key={`${x}-${z}`} geometry={cornerGeo} material={railMat} position={[x, 0.04, z]} castShadow />
      ))}

      {squares.map(({ square, pos, dark }) => (
        <mesh
          key={square}
          name={`square-${square}`}
          geometry={squareGeo}
          material={dark ? darkSquareMat : lightSquareMat}
          position={[pos[0], -0.05, pos[2]]}
          receiveShadow
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
          geometry={haloGeo}
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
            geometry={capture ? captureRingGeo : ringGeo}
            material={capture ? captureMat : legalMat}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[pos[0], 0.013, pos[2]]}
          />
        );
      })}
      {highlights.checkSquare ? (
        <mesh
          ref={checkRef}
          geometry={haloGeo}
          material={checkMat}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[squareToPosition(highlights.checkSquare)[0], 0.016, squareToPosition(highlights.checkSquare)[2]]}
        />
      ) : null}
    </group>
  );
}
