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

/*
  Reference-guided procedural units.

  These are still code-authored primitives, not final licensed character models.
  The goal is to make each chess role read like a Kurukshetra battlefield unit:
  archer/soldier, horse cavalry, advisor, chariot, elephant commander, and king.
*/
const geo = {
  base: new THREE.CylinderGeometry(0.32, 0.37, 0.08, 24),
  foot: new THREE.CapsuleGeometry(0.045, 0.18, 4, 8),
  leg: new THREE.CylinderGeometry(0.035, 0.045, 0.32, 8),
  arm: new THREE.CylinderGeometry(0.025, 0.035, 0.32, 8),
  torso: new THREE.CapsuleGeometry(0.14, 0.28, 5, 12),
  tallTorso: new THREE.CapsuleGeometry(0.15, 0.42, 5, 12),
  head: new THREE.SphereGeometry(0.105, 14, 12),
  hair: new THREE.SphereGeometry(0.112, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
  headband: new THREE.TorusGeometry(0.105, 0.012, 6, 18),
  armor: new THREE.BoxGeometry(0.32, 0.24, 0.08),
  belt: new THREE.BoxGeometry(0.34, 0.045, 0.065),
  dhoti: new THREE.ConeGeometry(0.22, 0.32, 14),
  clothPanel: new THREE.PlaneGeometry(0.18, 0.34),
  shoulderPad: new THREE.SphereGeometry(0.06, 8, 8),
  armorStud: new THREE.SphereGeometry(0.016, 6, 6),
  shield: new THREE.CylinderGeometry(0.15, 0.15, 0.035, 22),
  bow: new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.32, 0),
      new THREE.Vector3(0.08, -0.12, 0),
      new THREE.Vector3(0.1, 0.12, 0),
      new THREE.Vector3(0, 0.34, 0),
    ]),
    16,
    0.012,
    8
  ),
  bowString: new THREE.CylinderGeometry(0.005, 0.005, 0.66, 6),
  arrowShaft: new THREE.CylinderGeometry(0.008, 0.008, 0.5, 6),
  arrowHead: new THREE.ConeGeometry(0.03, 0.07, 8),
  quiver: new THREE.CylinderGeometry(0.055, 0.065, 0.4, 10),
  spear: new THREE.CylinderGeometry(0.014, 0.014, 0.76, 8),
  spearHead: new THREE.ConeGeometry(0.04, 0.11, 8),
  sword: new THREE.BoxGeometry(0.025, 0.56, 0.018),
  maceHandle: new THREE.CylinderGeometry(0.018, 0.018, 0.46, 8),
  maceHead: new THREE.SphereGeometry(0.075, 10, 10),
  horseBody: new THREE.CapsuleGeometry(0.17, 0.56, 5, 12),
  horseNeck: new THREE.CylinderGeometry(0.07, 0.12, 0.36, 10),
  horseHead: new THREE.SphereGeometry(0.11, 12, 10),
  horseLeg: new THREE.CylinderGeometry(0.025, 0.035, 0.42, 8),
  saddle: new THREE.BoxGeometry(0.36, 0.055, 0.28),
  reins: new THREE.TorusGeometry(0.13, 0.007, 6, 18),
  chariotHull: new THREE.BoxGeometry(0.56, 0.26, 0.5),
  chariotPanel: new THREE.BoxGeometry(0.62, 0.36, 0.055),
  chariotRail: new THREE.CylinderGeometry(0.025, 0.025, 0.62, 8),
  wheel: new THREE.TorusGeometry(0.17, 0.025, 8, 18),
  wheelHub: new THREE.CylinderGeometry(0.04, 0.04, 0.065, 10),
  wheelSpoke: new THREE.BoxGeometry(0.28, 0.018, 0.018),
  elephantBody: new THREE.CapsuleGeometry(0.24, 0.56, 5, 14),
  elephantHead: new THREE.SphereGeometry(0.16, 14, 12),
  elephantLeg: new THREE.CylinderGeometry(0.055, 0.07, 0.36, 10),
  elephantEar: new THREE.PlaneGeometry(0.2, 0.18),
  trunk: new THREE.CylinderGeometry(0.035, 0.055, 0.45, 10),
  tusk: new THREE.ConeGeometry(0.025, 0.22, 8),
  howdah: new THREE.BoxGeometry(0.32, 0.24, 0.3),
  crown: new THREE.ConeGeometry(0.11, 0.16, 12),
  crownRing: new THREE.TorusGeometry(0.09, 0.02, 8, 18),
  standard: new THREE.PlaneGeometry(0.24, 0.16),
  impactRing: new THREE.TorusGeometry(0.28, 0.018, 8, 24),
  dustMote: new THREE.SphereGeometry(0.045, 6, 6),
  spark: new THREE.ConeGeometry(0.025, 0.12, 6),
};

const mats = {
  skin: new THREE.MeshStandardMaterial({ color: '#a8744e', roughness: 0.72, metalness: 0.02 }),
  darkHair: new THREE.MeshStandardMaterial({ color: '#14120f', roughness: 0.95 }),
  leather: new THREE.MeshStandardMaterial({ color: '#5b3f2f', roughness: 0.82, metalness: 0.08 }),
  darkLeather: new THREE.MeshStandardMaterial({ color: '#2d2925', roughness: 0.84, metalness: 0.1 }),
  bronze: new THREE.MeshStandardMaterial({ color: '#a6773e', roughness: 0.42, metalness: 0.68 }),
  agedBronze: new THREE.MeshStandardMaterial({ color: '#725536', roughness: 0.54, metalness: 0.52 }),
  steel: new THREE.MeshStandardMaterial({ color: '#c9c4b8', roughness: 0.36, metalness: 0.72 }),
  darkSteel: new THREE.MeshStandardMaterial({ color: '#54514b', roughness: 0.42, metalness: 0.72 }),
  wood: new THREE.MeshStandardMaterial({ color: '#7b5634', roughness: 0.88 }),
  bowWood: new THREE.MeshStandardMaterial({ color: '#a06f3e', roughness: 0.76 }),
  horseBay: new THREE.MeshStandardMaterial({ color: '#6f4a2f', roughness: 0.82 }),
  horseDark: new THREE.MeshStandardMaterial({ color: '#3c3028', roughness: 0.84 }),
  elephant: new THREE.MeshStandardMaterial({ color: '#736d64', roughness: 0.9 }),
  elephantDark: new THREE.MeshStandardMaterial({ color: '#56514a', roughness: 0.92 }),
  ivory: new THREE.MeshStandardMaterial({ color: '#e7dcc8', roughness: 0.55 }),
  dust: new THREE.MeshBasicMaterial({ color: '#d8bd8b', transparent: true, opacity: 0.68, depthWrite: false }),
  spark: new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: 0.78, depthWrite: false }),
  impact: new THREE.MeshBasicMaterial({ color: '#fff2c7', transparent: true, opacity: 0.62, depthWrite: false }),
};

const faction = {
  w: {
    cloth: new THREE.MeshStandardMaterial({ color: '#284f8f', roughness: 0.88, side: THREE.DoubleSide }),
    sash: new THREE.MeshStandardMaterial({ color: '#c78333', roughness: 0.86, side: THREE.DoubleSide }),
    metal: mats.steel,
    animal: mats.horseBay,
  },
  b: {
    cloth: new THREE.MeshStandardMaterial({ color: '#6f2a26', roughness: 0.88, side: THREE.DoubleSide }),
    sash: new THREE.MeshStandardMaterial({ color: '#2d3442', roughness: 0.86, side: THREE.DoubleSide }),
    metal: mats.darkSteel,
    animal: mats.horseDark,
  },
} satisfies Record<PieceColor, {
  cloth: THREE.MeshStandardMaterial;
  sash: THREE.MeshStandardMaterial;
  metal: THREE.MeshStandardMaterial;
  animal: THREE.MeshStandardMaterial;
}>;

const MOVE_SPEED = 6;

function ArmorStuds({ material }: { material: THREE.Material }) {
  return (
    <group>
      {[-0.105, -0.035, 0.035, 0.105].map((x) => (
        <mesh key={x} geometry={geo.armorStud} material={material} position={[x, 0.48, 0.051]} castShadow />
      ))}
      {[-0.07, 0.07].map((x) => (
        <mesh key={`low-${x}`} geometry={geo.armorStud} material={material} position={[x, 0.39, 0.051]} castShadow />
      ))}
    </group>
  );
}

function WarriorCore({
  color,
  tall = false,
  shield = false,
}: {
  color: PieceColor;
  tall?: boolean;
  shield?: boolean;
}) {
  const f = faction[color];
  return (
    <group>
      <mesh geometry={geo.base} material={f.metal} position={[0, 0.04, 0]} castShadow />
      <mesh geometry={geo.leg} material={mats.skin} position={[-0.07, 0.22, 0]} castShadow />
      <mesh geometry={geo.leg} material={mats.skin} position={[0.07, 0.22, 0]} castShadow />
      <mesh geometry={geo.dhoti} material={f.sash} position={[0, 0.31, 0]} castShadow />
      <mesh geometry={tall ? geo.tallTorso : geo.torso} material={mats.skin} position={[0, tall ? 0.58 : 0.5, 0]} castShadow />
      <mesh geometry={geo.armor} material={mats.leather} position={[0, tall ? 0.61 : 0.51, 0.045]} castShadow />
      <ArmorStuds material={f.metal} />
      <mesh geometry={geo.belt} material={f.metal} position={[0, 0.36, 0.048]} castShadow />
      <mesh geometry={geo.head} material={mats.skin} position={[0, tall ? 0.95 : 0.78, 0]} castShadow />
      <mesh geometry={geo.hair} material={mats.darkHair} position={[0, tall ? 0.99 : 0.82, -0.012]} castShadow />
      <mesh geometry={geo.headband} material={f.cloth} rotation={[Math.PI / 2, 0, 0]} position={[0, tall ? 0.95 : 0.78, 0]} castShadow />
      <mesh geometry={geo.arm} material={mats.skin} rotation={[0.2, 0, -0.65]} position={[-0.18, tall ? 0.63 : 0.54, 0.02]} castShadow />
      <mesh geometry={geo.arm} material={mats.skin} rotation={[-0.1, 0, 0.65]} position={[0.18, tall ? 0.63 : 0.54, 0.02]} castShadow />
      <mesh geometry={geo.clothPanel} material={f.cloth} rotation={[0.08, 0, 0]} position={[0.02, 0.26, 0.13]} castShadow />
      {shield ? (
        <mesh
          geometry={geo.shield}
          material={f.metal}
          rotation={[Math.PI / 2, 0.15, 0]}
          position={[-0.22, 0.52, 0.1]}
          castShadow
        />
      ) : null}
    </group>
  );
}

function BowAndQuiver({ color, drawn = false }: { color: PieceColor; drawn?: boolean }) {
  const f = faction[color];
  return (
    <group>
      <mesh geometry={geo.bow} material={mats.bowWood} position={[0.24, 0.6, 0.06]} rotation={[0, 0, -0.08]} castShadow />
      <mesh geometry={geo.bowString} material={mats.steel} position={[0.28, 0.6, 0.06]} castShadow />
      <mesh geometry={geo.arrowShaft} material={mats.wood} rotation={[Math.PI / 2, 0, Math.PI / 2]} position={[drawn ? 0.07 : 0.21, 0.61, 0.12]} castShadow />
      <mesh geometry={geo.arrowHead} material={f.metal} rotation={[0, 0, -Math.PI / 2]} position={[drawn ? -0.18 : -0.04, 0.61, 0.12]} castShadow />
      <mesh geometry={geo.quiver} material={mats.darkLeather} rotation={[0.25, 0, -0.35]} position={[-0.2, 0.58, -0.16]} castShadow />
      {[0, 1, 2].map((i) => (
        <mesh
          key={i}
          geometry={geo.arrowShaft}
          material={mats.wood}
          rotation={[0.18, 0, -0.35]}
          position={[-0.24 + i * 0.035, 0.74, -0.18]}
          scale={[0.7, 0.7, 0.7]}
          castShadow
        />
      ))}
    </group>
  );
}

function SpearAndBanner({ color }: { color: PieceColor }) {
  const f = faction[color];
  return (
    <group>
      <mesh geometry={geo.spear} material={mats.wood} position={[0.25, 0.66, -0.02]} castShadow />
      <mesh geometry={geo.spearHead} material={f.metal} position={[0.25, 1.08, -0.02]} castShadow />
      <mesh geometry={geo.standard} material={f.cloth} position={[0.34, 0.92, -0.02]} castShadow />
    </group>
  );
}

function SwordAndMace({ color, mace = false }: { color: PieceColor; mace?: boolean }) {
  const f = faction[color];
  if (mace) {
    return (
      <group rotation={[0, 0, -0.75]} position={[0.27, 0.73, 0.02]}>
        <mesh geometry={geo.maceHandle} material={mats.wood} castShadow />
        <mesh geometry={geo.maceHead} material={f.metal} position={[0, 0.28, 0]} castShadow />
      </group>
    );
  }
  return (
    <group rotation={[0, 0, -0.55]} position={[0.26, 0.72, 0.02]}>
      <mesh geometry={geo.sword} material={f.metal} castShadow />
      <mesh geometry={geo.belt} material={mats.bronze} position={[0, -0.26, 0]} scale={[0.42, 0.55, 0.7]} castShadow />
    </group>
  );
}

function FootArcher({ color }: { color: PieceColor }) {
  return (
    <group>
      <WarriorCore color={color} />
      <BowAndQuiver color={color} drawn />
    </group>
  );
}

function HorseArcher({ color }: { color: PieceColor }) {
  const f = faction[color];
  return (
    <group>
      <mesh geometry={geo.base} material={f.metal} position={[0, 0.04, 0]} castShadow />
      <mesh geometry={geo.horseBody} material={f.animal} rotation={[0, 0, Math.PI / 2]} position={[0, 0.34, 0]} castShadow />
      <mesh geometry={geo.horseNeck} material={f.animal} rotation={[0.82, 0, 0]} position={[0, 0.55, 0.26]} castShadow />
      <mesh geometry={geo.horseHead} material={f.animal} position={[0, 0.73, 0.43]} castShadow />
      {[[-0.17, 0.2], [0.17, 0.2], [-0.17, -0.22], [0.17, -0.22]].map(([x, z], i) => (
        <mesh key={i} geometry={geo.horseLeg} material={f.animal} position={[x, 0.13, z]} castShadow />
      ))}
      <mesh geometry={geo.saddle} material={f.cloth} position={[0, 0.52, -0.02]} castShadow />
      <mesh geometry={geo.reins} material={mats.leather} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.7, 0.36]} castShadow />
      <group position={[0, 0.72, -0.02]} scale={[0.62, 0.62, 0.62]}>
        <WarriorCore color={color} />
        <BowAndQuiver color={color} />
      </group>
    </group>
  );
}

function Advisor({ color }: { color: PieceColor }) {
  return (
    <group>
      <WarriorCore color={color} tall shield />
      <SpearAndBanner color={color} />
    </group>
  );
}

function Chariot({ color }: { color: PieceColor }) {
  const f = faction[color];
  return (
    <group>
      <mesh geometry={geo.chariotHull} material={mats.wood} position={[0, 0.25, -0.04]} castShadow />
      <mesh geometry={geo.chariotPanel} material={mats.agedBronze} position={[0, 0.44, 0.25]} castShadow />
      <mesh geometry={geo.chariotPanel} material={f.cloth} position={[0, 0.43, -0.31]} castShadow />
      <mesh geometry={geo.chariotRail} material={mats.bronze} rotation={[0, 0, Math.PI / 2]} position={[0, 0.64, 0.25]} castShadow />
      {[-0.34, 0.34].map((x) => (
        <group key={x} position={[x, 0.18, 0.24]} rotation={[0, Math.PI / 2, 0]}>
          <mesh geometry={geo.wheel} material={f.metal} castShadow />
          <mesh geometry={geo.wheelHub} material={mats.bronze} rotation={[Math.PI / 2, 0, 0]} castShadow />
          <mesh geometry={geo.wheelSpoke} material={mats.bronze} castShadow />
          <mesh geometry={geo.wheelSpoke} material={mats.bronze} rotation={[0, 0, Math.PI / 2]} castShadow />
        </group>
      ))}
      <group position={[0, 0.5, 0.03]} scale={[0.66, 0.66, 0.66]}>
        <WarriorCore color={color} tall />
        <SpearAndBanner color={color} />
      </group>
      <mesh geometry={geo.spear} material={mats.wood} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.32, 0.52]} castShadow />
    </group>
  );
}

function ElephantCommander({ color }: { color: PieceColor }) {
  const f = faction[color];
  return (
    <group>
      <mesh geometry={geo.base} material={f.metal} position={[0, 0.04, 0]} castShadow />
      <mesh geometry={geo.elephantBody} material={color === 'w' ? mats.elephant : mats.elephantDark} rotation={[0, 0, Math.PI / 2]} position={[0, 0.38, 0]} castShadow />
      <mesh geometry={geo.elephantHead} material={color === 'w' ? mats.elephant : mats.elephantDark} position={[0, 0.48, 0.43]} castShadow />
      <mesh geometry={geo.trunk} material={color === 'w' ? mats.elephant : mats.elephantDark} rotation={[0.58, 0, 0]} position={[0, 0.28, 0.58]} castShadow />
      <mesh geometry={geo.tusk} material={mats.ivory} rotation={[Math.PI / 2, 0.2, 0]} position={[-0.08, 0.42, 0.6]} castShadow />
      <mesh geometry={geo.tusk} material={mats.ivory} rotation={[Math.PI / 2, -0.2, 0]} position={[0.08, 0.42, 0.6]} castShadow />
      <mesh geometry={geo.elephantEar} material={f.cloth} rotation={[0.05, 0.75, 0]} position={[-0.17, 0.52, 0.36]} castShadow />
      <mesh geometry={geo.elephantEar} material={f.cloth} rotation={[0.05, -0.75, 0]} position={[0.17, 0.52, 0.36]} castShadow />
      {[[-0.16, 0.18], [0.16, 0.18], [-0.16, -0.2], [0.16, -0.2]].map(([x, z], i) => (
        <mesh key={i} geometry={geo.elephantLeg} material={color === 'w' ? mats.elephant : mats.elephantDark} position={[x, 0.15, z]} castShadow />
      ))}
      <mesh geometry={geo.saddle} material={f.cloth} position={[0, 0.61, -0.02]} scale={[1.15, 1.2, 1.15]} castShadow />
      <mesh geometry={geo.howdah} material={mats.agedBronze} position={[0, 0.79, -0.02]} castShadow />
      <group position={[0, 0.82, -0.02]} scale={[0.58, 0.58, 0.58]}>
        <WarriorCore color={color} tall />
        <SwordAndMace color={color} mace />
      </group>
    </group>
  );
}

function RoyalCommander({ color }: { color: PieceColor }) {
  const f = faction[color];
  return (
    <group>
      <WarriorCore color={color} tall shield />
      <mesh geometry={geo.crownRing} material={f.metal} rotation={[Math.PI / 2, 0, 0]} position={[0, 1.05, 0]} castShadow />
      <mesh geometry={geo.crown} material={f.metal} position={[0, 1.15, 0]} castShadow />
      <SwordAndMace color={color} />
      <mesh geometry={geo.spear} material={mats.wood} position={[-0.27, 0.72, -0.02]} castShadow />
      <mesh geometry={geo.standard} material={f.cloth} position={[-0.36, 1.02, -0.02]} castShadow />
    </group>
  );
}

function PieceMeshes({ type, color }: { type: PieceType; color: PieceColor }) {
  const facing = color === 'w' ? Math.PI : 0;
  return (
    <group rotation={[0, facing, 0]} scale={0.78}>
      {type === 'p' ? <FootArcher color={color} /> : null}
      {type === 'n' ? <HorseArcher color={color} /> : null}
      {type === 'b' ? <Advisor color={color} /> : null}
      {type === 'r' ? <Chariot color={color} /> : null}
      {type === 'q' ? <ElephantCommander color={color} /> : null}
      {type === 'k' ? <RoyalCommander color={color} /> : null}
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
      group.position.y = -t * 0.22;
      if (dustRef.current) {
        dustRef.current.visible = !reducedMotion && t < 1;
        dustRef.current.scale.setScalar(0.6 + t * 1.75);
        dustRef.current.rotation.y += delta * 2.2;
      }
      return;
    }

    group.scale.setScalar(1);
    const dx = target[0] - group.position.x;
    const dz = target[2] - group.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 0.005) {
      const speed = piece.type === 'r' || piece.type === 'q' ? MOVE_SPEED * 0.84 : MOVE_SPEED;
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
        group.position.y = Math.sin(Math.PI * Math.min(1, Math.max(0, progress))) * 0.38;
      } else {
        group.position.y = Math.sin(clock.elapsedTime * 18) * 0.015;
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
          <mesh geometry={geo.impactRing} material={mats.impact} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.16, 0]} />
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <mesh
              key={`dust-${i}`}
              geometry={geo.dustMote}
              material={mats.dust}
              position={[Math.cos(i * 1.35) * 0.2, 0.18 + i * 0.045, Math.sin(i * 1.65) * 0.2]}
            />
          ))}
          {[0, 1, 2].map((i) => (
            <mesh
              key={`spark-${i}`}
              geometry={geo.spark}
              material={mats.spark}
              rotation={[0.8, i * 2.1, 0.3]}
              position={[Math.cos(i * 2.1) * 0.16, 0.26 + i * 0.035, Math.sin(i * 2.1) * 0.16]}
            />
          ))}
        </group>
      ) : null}
    </group>
  );
}
