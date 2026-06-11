import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  squareToPosition,
  type BattlefieldPieceInstance,
  type PieceColor,
  type PieceType,
} from './battlefieldTypes';
import { CAPTURE_EFFECT_MS } from './useBattlefieldAnimations';

/* ----------------------------------------------------------------------------
   Shared geometries/materials (module-level caches — created once, reused by
   every piece, never recreated on re-render; required by the perf budget).
   ------------------------------------------------------------------------- */
const geo = {
  base: new THREE.CylinderGeometry(0.32, 0.36, 0.08, 20),
  body: new THREE.CapsuleGeometry(0.16, 0.3, 4, 12),
  head: new THREE.SphereGeometry(0.11, 14, 12),
  shield: new THREE.CylinderGeometry(0.13, 0.13, 0.03, 16),
  horseNeck: new THREE.ConeGeometry(0.2, 0.62, 10),
  horseMuzzle: new THREE.BoxGeometry(0.14, 0.14, 0.3),
  robe: new THREE.ConeGeometry(0.24, 0.62, 14),
  staff: new THREE.CylinderGeometry(0.02, 0.02, 0.72, 8),
  pennant: new THREE.PlaneGeometry(0.18, 0.12),
  hull: new THREE.BoxGeometry(0.52, 0.2, 0.44),
  wheel: new THREE.CylinderGeometry(0.11, 0.11, 0.04, 14),
  tower: new THREE.BoxGeometry(0.3, 0.34, 0.3),
  mantle: new THREE.ConeGeometry(0.27, 0.3, 14),
  crownRing: new THREE.TorusGeometry(0.09, 0.025, 8, 16),
  standard: new THREE.PlaneGeometry(0.24, 0.16),
  tallBody: new THREE.CylinderGeometry(0.14, 0.22, 0.74, 14),
};

type Palette = {
  primary: THREE.MeshStandardMaterial;
  metal: THREE.MeshStandardMaterial;
  cloth: THREE.MeshStandardMaterial;
};

/* Pandava: ivory + steel + blue cloth. Kaurava: graphite + dark metal + maroon. */
const palettes: Record<PieceColor, Palette> = {
  w: {
    primary: new THREE.MeshStandardMaterial({ color: '#e9e3d3', roughness: 0.55, metalness: 0.12 }),
    metal: new THREE.MeshStandardMaterial({ color: '#c8ccd2', roughness: 0.35, metalness: 0.65 }),
    cloth: new THREE.MeshStandardMaterial({ color: '#3f7fd4', roughness: 0.85, side: THREE.DoubleSide }),
  },
  b: {
    primary: new THREE.MeshStandardMaterial({ color: '#34312f', roughness: 0.6, metalness: 0.22 }),
    metal: new THREE.MeshStandardMaterial({ color: '#4d4a47', roughness: 0.4, metalness: 0.7 }),
    cloth: new THREE.MeshStandardMaterial({ color: '#7e2d26', roughness: 0.85, side: THREE.DoubleSide }),
  },
};

const dustMaterial = new THREE.MeshBasicMaterial({
  color: '#cdb185',
  transparent: true,
  opacity: 0.7,
  depthWrite: false,
});
const dustGeo = new THREE.SphereGeometry(0.05, 6, 6);

const MOVE_SPEED = 6; // board units / second (≈180–250ms per move)

function PieceMeshes({ type, color }: { type: PieceType; color: PieceColor }) {
  const p = palettes[color];
  switch (type) {
    case 'p': // foot soldier: body + head + round shield
      return (
        <group>
          <mesh geometry={geo.base} material={p.metal} position={[0, 0.04, 0]} castShadow />
          <mesh geometry={geo.body} material={p.primary} position={[0, 0.34, 0]} castShadow />
          <mesh geometry={geo.head} material={p.primary} position={[0, 0.62, 0]} castShadow />
          <mesh geometry={geo.shield} material={p.metal} rotation={[Math.PI / 2, 0, 0]} position={[0.16, 0.36, 0.1]} castShadow />
        </group>
      );
    case 'n': // horse cavalry: arched neck + muzzle
      return (
        <group>
          <mesh geometry={geo.base} material={p.metal} position={[0, 0.04, 0]} castShadow />
          <mesh geometry={geo.horseNeck} material={p.primary} rotation={[0.5, 0, 0]} position={[0, 0.42, -0.04]} castShadow />
          <mesh geometry={geo.horseMuzzle} material={p.primary} position={[0, 0.66, 0.16]} castShadow />
          <mesh geometry={geo.pennant} material={p.cloth} position={[0, 0.34, -0.18]} castShadow />
        </group>
      );
    case 'b': // advisor / standard bearer: robe + staff + pennant
      return (
        <group>
          <mesh geometry={geo.base} material={p.metal} position={[0, 0.04, 0]} castShadow />
          <mesh geometry={geo.robe} material={p.primary} position={[0, 0.4, 0]} castShadow />
          <mesh geometry={geo.head} material={p.primary} position={[0, 0.76, 0]} castShadow />
          <mesh geometry={geo.staff} material={p.metal} position={[0.18, 0.45, 0]} castShadow />
          <mesh geometry={geo.pennant} material={p.cloth} position={[0.28, 0.74, 0]} castShadow />
        </group>
      );
    case 'r': // war chariot: hull + wheels + tower
      return (
        <group>
          <mesh geometry={geo.hull} material={p.primary} position={[0, 0.2, 0]} castShadow />
          <mesh geometry={geo.wheel} material={p.metal} rotation={[0, 0, Math.PI / 2]} position={[-0.28, 0.11, 0.16]} castShadow />
          <mesh geometry={geo.wheel} material={p.metal} rotation={[0, 0, Math.PI / 2]} position={[0.28, 0.11, 0.16]} castShadow />
          <mesh geometry={geo.wheel} material={p.metal} rotation={[0, 0, Math.PI / 2]} position={[-0.28, 0.11, -0.16]} castShadow />
          <mesh geometry={geo.wheel} material={p.metal} rotation={[0, 0, Math.PI / 2]} position={[0.28, 0.11, -0.16]} castShadow />
          <mesh geometry={geo.tower} material={p.primary} position={[0, 0.47, 0]} castShadow />
        </group>
      );
    case 'q': // commander: tall robe + mantle + crown ring
      return (
        <group>
          <mesh geometry={geo.base} material={p.metal} position={[0, 0.04, 0]} castShadow />
          <mesh geometry={geo.tallBody} material={p.primary} position={[0, 0.45, 0]} castShadow />
          <mesh geometry={geo.mantle} material={p.cloth} position={[0, 0.78, 0]} castShadow />
          <mesh geometry={geo.head} material={p.primary} position={[0, 0.95, 0]} castShadow />
          <mesh geometry={geo.crownRing} material={p.metal} rotation={[Math.PI / 2, 0, 0]} position={[0, 1.04, 0]} castShadow />
        </group>
      );
    case 'k': // royal commander: tallest + crown + standard flag
      return (
        <group>
          <mesh geometry={geo.base} material={p.metal} position={[0, 0.04, 0]} castShadow />
          <mesh geometry={geo.tallBody} material={p.primary} position={[0, 0.5, 0]} scale={[1, 1.12, 1]} castShadow />
          <mesh geometry={geo.head} material={p.primary} position={[0, 1.06, 0]} castShadow />
          <mesh geometry={geo.crownRing} material={p.metal} rotation={[Math.PI / 2, 0, 0]} position={[0, 1.16, 0]} castShadow />
          <mesh geometry={geo.staff} material={p.metal} position={[0.2, 0.78, 0]} castShadow />
          <mesh geometry={geo.standard} material={p.cloth} position={[0.33, 1.06, 0]} castShadow />
        </group>
      );
    default:
      return null;
  }
}

type BattlefieldPieceProps = {
  piece: BattlefieldPieceInstance;
  reducedMotion: boolean;
  /** Click on a piece counts as a click on its square (select own piece /
   *  capture enemy piece) — without this, piece meshes swallow the raycast
   *  and the 3D board is unplayable. */
  onSquareClick?: (square: string) => void;
};

export function BattlefieldPiece({ piece, reducedMotion, onSquareClick }: BattlefieldPieceProps) {
  const groupRef = useRef<THREE.Group>(null);
  const dustRef = useRef<THREE.Group>(null);
  const target = useMemo(() => squareToPosition(piece.square), [piece.square]);
  const started = useRef(false);
  const animKeyRef = useRef('');

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;

    // Re-seed the start position whenever this instance begins a new move.
    const animKey = `${piece.fromSquare ?? ''}>${piece.square}`;
    if (animKeyRef.current !== animKey) {
      animKeyRef.current = animKey;
      started.current = false;
    }

    if (!started.current) {
      const from = piece.fromSquare ? squareToPosition(piece.fromSquare) : target;
      if (reducedMotion) {
        group.position.set(target[0], 0, target[2]);
      } else {
        group.position.set(from[0], 0, from[2]);
      }
      started.current = true;
    }

    // Capture: dissolve into dust (shrink + sink), then the reconciler culls us.
    if (piece.capturedAt !== null) {
      const t = Math.min(1, (Date.now() - piece.capturedAt) / CAPTURE_EFFECT_MS);
      const s = reducedMotion ? 0 : Math.max(0.001, 1 - t);
      group.scale.setScalar(s);
      group.position.y = -t * 0.2;
      if (dustRef.current) {
        dustRef.current.visible = !reducedMotion && t < 1;
        dustRef.current.scale.setScalar(0.5 + t * 1.6);
      }
      return;
    }

    // Glide toward the target square. Knights take a small leap arc.
    const dx = target[0] - group.position.x;
    const dz = target[2] - group.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 0.005) {
      const step = Math.min(dist, MOVE_SPEED * delta * (piece.type === 'k' ? 0.7 : 1));
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
        group.position.y = Math.sin(Math.PI * Math.min(1, Math.max(0, progress))) * 0.35;
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
      <PieceMeshes type={piece.type} color={piece.color} />
      {piece.capturedAt !== null ? (
        <group ref={dustRef}>
          {/* simple dust burst: a handful of fading motes */}
          {[0, 1, 2, 3, 4].map((i) => (
            <mesh
              key={i}
              geometry={dustGeo}
              material={dustMaterial}
              position={[Math.cos(i * 1.3) * 0.18, 0.2 + i * 0.06, Math.sin(i * 1.7) * 0.18]}
            />
          ))}
        </group>
      ) : null}
    </group>
  );
}
