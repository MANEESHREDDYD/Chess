import { useMemo, useRef } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import {
  squareToPosition,
  type BattlefieldPieceInstance,
  type PieceColor,
  type PieceType,
} from './battlefieldTypes';
import { CAPTURE_EFFECT_MS } from './useBattlefieldAnimations';

const ASSET_ROOT = '/assets/3d/kurukshetra-realism-v1';

type UnitAsset = {
  url: string;
  width: number;
  height: number;
  y: number;
  base: number;
};

const UNIT_ASSETS: Record<PieceType, UnitAsset> = {
  p: { url: `${ASSET_ROOT}/pawn-foot-archer.png`, width: 0.7, height: 1.55, y: 0.78, base: 0.34 },
  n: { url: `${ASSET_ROOT}/knight-horse-archer.png`, width: 1.14, height: 1.62, y: 0.82, base: 0.45 },
  b: { url: `${ASSET_ROOT}/bishop-advisor-standard.png`, width: 0.82, height: 1.7, y: 0.86, base: 0.36 },
  r: { url: `${ASSET_ROOT}/rook-war-chariot.png`, width: 1.22, height: 1.42, y: 0.72, base: 0.5 },
  q: { url: `${ASSET_ROOT}/queen-war-elephant.png`, width: 1.35, height: 1.72, y: 0.88, base: 0.54 },
  k: { url: `${ASSET_ROOT}/king-royal-commander.png`, width: 0.82, height: 1.74, y: 0.88, base: 0.38 },
};

const MOVE_SPEED = 6;

const baseGeo = new THREE.CylinderGeometry(0.36, 0.4, 0.07, 32);
const shadowGeo = new THREE.CircleGeometry(0.42, 32);
const dustGeo = new THREE.SphereGeometry(0.045, 6, 6);
const impactGeo = new THREE.TorusGeometry(0.28, 0.018, 8, 28);
const sparkGeo = new THREE.ConeGeometry(0.025, 0.12, 6);

const baseMaterials: Record<PieceColor, THREE.MeshStandardMaterial> = {
  w: new THREE.MeshStandardMaterial({ color: '#d2c8b4', roughness: 0.78, metalness: 0.15 }),
  b: new THREE.MeshStandardMaterial({ color: '#272522', roughness: 0.82, metalness: 0.18 }),
};

const ringMaterials: Record<PieceColor, THREE.MeshStandardMaterial> = {
  w: new THREE.MeshStandardMaterial({ color: '#1f6feb', roughness: 0.55, metalness: 0.35 }),
  b: new THREE.MeshStandardMaterial({ color: '#7a2020', roughness: 0.62, metalness: 0.32 }),
};

const shadowMat = new THREE.MeshBasicMaterial({
  color: '#000000',
  transparent: true,
  opacity: 0.25,
  depthWrite: false,
});

const dustMat = new THREE.MeshBasicMaterial({
  color: '#d8bd8b',
  transparent: true,
  opacity: 0.68,
  depthWrite: false,
});

const sparkMat = new THREE.MeshBasicMaterial({
  color: '#ffd27a',
  transparent: true,
  opacity: 0.78,
  depthWrite: false,
});

const impactMat = new THREE.MeshBasicMaterial({
  color: '#fff2c7',
  transparent: true,
  opacity: 0.62,
  depthWrite: false,
});

function RealisticUnit({ type, color }: { type: PieceType; color: PieceColor }) {
  const asset = UNIT_ASSETS[type];
  const texture = useLoader(THREE.TextureLoader, asset.url);

  useMemo(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    texture.needsUpdate = true;
  }, [texture]);

  const sideShift = color === 'w' ? -0.02 : 0.02;

  return (
    <group name={`realistic-${color}${type}`}>
      <mesh
        geometry={shadowGeo}
        material={shadowMat}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.012, 0]}
        scale={[asset.base * 1.55, asset.base * 1.08, 1]}
      />
      <mesh geometry={baseGeo} material={baseMaterials[color]} position={[0, 0.045, 0]} castShadow receiveShadow scale={[asset.base, 1, asset.base]} />
      <mesh geometry={baseGeo} material={ringMaterials[color]} position={[0, 0.092, 0]} scale={[asset.base * 0.82, 0.36, asset.base * 0.82]} />
      <sprite position={[sideShift, asset.y + 0.04, 0]} scale={[asset.width, asset.height, 1]}>
        <spriteMaterial
          attach="material"
          map={texture}
          transparent
          depthWrite={false}
          alphaTest={0.08}
          toneMapped
        />
      </sprite>
    </group>
  );
}

type BattlefieldPieceProps = {
  piece: BattlefieldPieceInstance;
  reducedMotion: boolean;
  onSquareClick?: (square: string) => void;
};

export function BattlefieldPiece({ piece, reducedMotion, onSquareClick }: BattlefieldPieceProps) {
  const groupRef = useRef<THREE.Group>(null);
  const dustRef = useRef<THREE.Group>(null);
  const target = useMemo(() => squareToPosition(piece.square), [piece.square]);
  const started = useRef(false);
  const animKeyRef = useRef('');

  useFrame(({ clock }, delta) => {
    const group = groupRef.current;
    if (!group) return;

    const animKey = `${piece.fromSquare ?? ''}>${piece.square}`;
    if (animKeyRef.current !== animKey) {
      animKeyRef.current = animKey;
      started.current = false;
    }

    if (!started.current) {
      const from = piece.fromSquare ? squareToPosition(piece.fromSquare) : target;
      group.position.set(from[0], reducedMotion ? 0 : group.position.y, from[2]);
      if (reducedMotion) group.position.set(target[0], 0, target[2]);
      started.current = true;
    }

    if (piece.capturedAt !== null) {
      const t = Math.min(1, (Date.now() - piece.capturedAt) / CAPTURE_EFFECT_MS);
      const s = reducedMotion ? 0 : Math.max(0.001, 1 - t);
      group.scale.setScalar(s);
      group.position.y = -t * 0.2;
      if (dustRef.current) {
        dustRef.current.visible = !reducedMotion && t < 1;
        dustRef.current.scale.setScalar(0.7 + t * 1.85);
        dustRef.current.rotation.y += delta * 2.2;
      }
      return;
    }

    group.scale.setScalar(1);
    const dx = target[0] - group.position.x;
    const dz = target[2] - group.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 0.005) {
      const speed = piece.type === 'r' || piece.type === 'q' ? MOVE_SPEED * 0.82 : MOVE_SPEED;
      const step = Math.min(dist, speed * delta);
      group.position.x += (dx / dist) * step;
      group.position.z += (dz / dist) * step;
      if (piece.type === 'n') {
        const total = piece.fromSquare
          ? Math.hypot(
              target[0] - squareToPosition(piece.fromSquare)[0],
              target[2] - squareToPosition(piece.fromSquare)[2]
            )
          : 1;
        const progress = 1 - dist / Math.max(total, 0.001);
        group.position.y = Math.sin(Math.PI * Math.min(1, Math.max(0, progress))) * 0.34;
      } else {
        group.position.y = Math.sin(clock.elapsedTime * 18) * 0.01;
      }
    } else {
      group.position.x = target[0];
      group.position.z = target[2];
      group.position.y = 0;
    }
  });

  return (
    <group
      ref={groupRef}
      name={`piece-${piece.color}${piece.type}-${piece.square}`}
      onClick={(event) => {
        if (piece.capturedAt !== null || !onSquareClick) return;
        event.stopPropagation();
        onSquareClick(piece.square);
      }}
    >
      <RealisticUnit type={piece.type} color={piece.color} />
      {piece.capturedAt !== null ? (
        <group ref={dustRef}>
          <mesh geometry={impactGeo} material={impactMat} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.16, 0]} />
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <mesh
              key={`dust-${i}`}
              geometry={dustGeo}
              material={dustMat}
              position={[Math.cos(i * 1.35) * 0.2, 0.18 + i * 0.045, Math.sin(i * 1.65) * 0.2]}
            />
          ))}
          {[0, 1, 2].map((i) => (
            <mesh
              key={`spark-${i}`}
              geometry={sparkGeo}
              material={sparkMat}
              rotation={[0.8, i * 2.1, 0.3]}
              position={[Math.cos(i * 2.1) * 0.16, 0.26 + i * 0.035, Math.sin(i * 2.1) * 0.16]}
            />
          ))}
        </group>
      ) : null}
    </group>
  );
}
