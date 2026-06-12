import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  squareToPosition,
  type BattlefieldPieceInstance,
  type PieceColor,
  type PieceType,
} from './battlefieldTypes';
import { ATTACK_LUNGE_MS, CAPTURE_EFFECT_MS } from './useBattlefieldAnimations';

// Volumetric board units. These are real Three.js meshes, not sprites or
// camera-facing image planes. Final PUBG/GTA/Harry-Potter-chess fidelity still
// requires authored rigged GLB characters and animation clips.

const MOVE_SPEED = 3.35;

const geo = {
  shadow: new THREE.CircleGeometry(0.58, 36),
  body: new THREE.CapsuleGeometry(0.105, 0.34, 5, 12),
  head: new THREE.SphereGeometry(0.085, 16, 12),
  hair: new THREE.SphereGeometry(0.088, 12, 8),
  torsoArmor: new THREE.BoxGeometry(0.24, 0.24, 0.12),
  arm: new THREE.CylinderGeometry(0.022, 0.028, 0.42, 8),
  leg: new THREE.CylinderGeometry(0.03, 0.036, 0.34, 8),
  skirt: new THREE.ConeGeometry(0.13, 0.28, 16),
  sash: new THREE.BoxGeometry(0.22, 0.055, 0.13),
  crown: new THREE.ConeGeometry(0.08, 0.14, 12),
  shield: new THREE.CylinderGeometry(0.12, 0.12, 0.035, 20),
  staff: new THREE.CylinderGeometry(0.012, 0.014, 0.9, 8),
  spearHead: new THREE.ConeGeometry(0.035, 0.1, 8),
  swordBlade: new THREE.BoxGeometry(0.028, 0.42, 0.012),
  swordGrip: new THREE.CylinderGeometry(0.016, 0.016, 0.16, 8),
  bow: new THREE.TorusGeometry(0.23, 0.009, 6, 28, Math.PI),
  bowString: new THREE.CylinderGeometry(0.004, 0.004, 0.46, 6),
  arrow: new THREE.CylinderGeometry(0.006, 0.006, 0.42, 6),
  quiver: new THREE.CylinderGeometry(0.04, 0.05, 0.32, 10),
  banner: new THREE.BoxGeometry(0.24, 0.18, 0.018),
  horseBody: new THREE.CapsuleGeometry(0.18, 0.52, 5, 14),
  horseNeck: new THREE.CylinderGeometry(0.065, 0.105, 0.34, 10),
  horseHead: new THREE.SphereGeometry(0.115, 14, 10),
  horseLeg: new THREE.CylinderGeometry(0.026, 0.033, 0.42, 8),
  horseTail: new THREE.CylinderGeometry(0.018, 0.03, 0.28, 8),
  saddle: new THREE.BoxGeometry(0.34, 0.06, 0.28),
  elephantBody: new THREE.CapsuleGeometry(0.32, 0.58, 5, 16),
  elephantHead: new THREE.SphereGeometry(0.22, 16, 12),
  elephantLeg: new THREE.CylinderGeometry(0.07, 0.09, 0.42, 10),
  elephantEar: new THREE.SphereGeometry(0.12, 12, 8),
  elephantTrunk: new THREE.CylinderGeometry(0.04, 0.07, 0.46, 10),
  tusk: new THREE.ConeGeometry(0.025, 0.28, 8),
  howdah: new THREE.BoxGeometry(0.42, 0.32, 0.34),
  caparison: new THREE.BoxGeometry(0.5, 0.04, 0.7),
  chariotCabin: new THREE.BoxGeometry(0.5, 0.28, 0.42),
  chariotPanel: new THREE.BoxGeometry(0.54, 0.32, 0.055),
  axle: new THREE.CylinderGeometry(0.025, 0.025, 0.75, 10),
  wheel: new THREE.TorusGeometry(0.17, 0.025, 8, 24),
  yoke: new THREE.CylinderGeometry(0.018, 0.018, 0.56, 8),
  dust: new THREE.SphereGeometry(0.045, 6, 6),
  impact: new THREE.TorusGeometry(0.3, 0.018, 8, 32),
  shock: new THREE.RingGeometry(0.16, 0.34, 32),
  spark: new THREE.ConeGeometry(0.025, 0.12, 6),
};

const mat = {
  shadow: new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.32, depthWrite: false }),
  skin: new THREE.MeshStandardMaterial({ color: '#9f6b4a', roughness: 0.72 }),
  hair: new THREE.MeshStandardMaterial({ color: '#14110f', roughness: 0.95 }),
  leather: new THREE.MeshStandardMaterial({ color: '#5b3c27', roughness: 0.78 }),
  darkLeather: new THREE.MeshStandardMaterial({ color: '#2a2018', roughness: 0.82 }),
  wood: new THREE.MeshStandardMaterial({ color: '#6d492c', roughness: 0.86 }),
  bronze: new THREE.MeshStandardMaterial({ color: '#a57538', roughness: 0.42, metalness: 0.52 }),
  brightBronze: new THREE.MeshStandardMaterial({ color: '#d1a85a', roughness: 0.36, metalness: 0.62 }),
  steel: new THREE.MeshStandardMaterial({ color: '#c9c3b8', roughness: 0.32, metalness: 0.68 }),
  horse: new THREE.MeshStandardMaterial({ color: '#62422c', roughness: 0.84 }),
  horseDark: new THREE.MeshStandardMaterial({ color: '#34251a', roughness: 0.88 }),
  elephant: new THREE.MeshStandardMaterial({ color: '#756f66', roughness: 0.92 }),
  ivory: new THREE.MeshStandardMaterial({ color: '#e6dbc8', roughness: 0.56 }),
  dust: new THREE.MeshBasicMaterial({ color: '#d8bd8b', transparent: true, opacity: 0.68, depthWrite: false }),
  spark: new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: 0.78, depthWrite: false }),
  impact: new THREE.MeshBasicMaterial({ color: '#fff2c7', transparent: true, opacity: 0.62, depthWrite: false }),
  shock: new THREE.MeshBasicMaterial({ color: '#f2d38e', transparent: true, opacity: 0.42, depthWrite: false, side: THREE.DoubleSide }),
};

const sideMat: Record<PieceColor, { cloth: THREE.MeshStandardMaterial; accent: THREE.MeshStandardMaterial }> = {
  w: {
    cloth: new THREE.MeshStandardMaterial({ color: '#1f4f86', roughness: 0.84 }),
    accent: new THREE.MeshStandardMaterial({ color: '#c98235', roughness: 0.8 }),
  },
  b: {
    cloth: new THREE.MeshStandardMaterial({ color: '#6b2823', roughness: 0.86 }),
    accent: new THREE.MeshStandardMaterial({ color: '#252a30', roughness: 0.82 }),
  },
};

function ContactShadow({ scale = [0.46, 0.34, 1] as [number, number, number] }) {
  return (
    <mesh
      geometry={geo.shadow}
      material={mat.shadow}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.012, 0]}
      scale={scale}
    />
  );
}

function Humanoid({
  color,
  variant,
  scale = 1,
  position = [0, 0, 0],
}: {
  color: PieceColor;
  variant: 'archer' | 'standard' | 'commander' | 'guard';
  scale?: number;
  position?: [number, number, number];
}) {
  const cloth = sideMat[color].cloth;
  const accent = sideMat[color].accent;
  const royal = variant === 'commander';
  return (
    <group position={position} scale={scale}>
      <mesh geometry={geo.leg} material={mat.skin} position={[-0.055, 0.17, 0]} castShadow />
      <mesh geometry={geo.leg} material={mat.skin} position={[0.055, 0.17, 0]} castShadow />
      <mesh geometry={geo.skirt} material={accent} position={[0, 0.32, 0]} castShadow />
      <mesh geometry={geo.body} material={mat.skin} position={[0, 0.55, 0]} castShadow />
      <mesh geometry={geo.torsoArmor} material={royal ? mat.brightBronze : mat.leather} position={[0, 0.61, 0.035]} castShadow />
      <mesh geometry={geo.sash} material={cloth} position={[0, 0.43, 0.046]} rotation={[0, 0, -0.22]} castShadow />
      <mesh geometry={geo.head} material={mat.skin} position={[0, 0.86, 0.01]} castShadow />
      <mesh geometry={geo.hair} material={mat.hair} position={[0, 0.91, -0.015]} scale={[1.08, 0.58, 1.02]} castShadow />
      {royal ? <mesh geometry={geo.crown} material={mat.brightBronze} position={[0, 1.005, 0.004]} castShadow /> : null}

      <mesh geometry={geo.arm} material={mat.skin} position={[-0.16, 0.59, 0.04]} rotation={[0.2, 0, -0.82]} castShadow />
      <mesh geometry={geo.arm} material={mat.skin} position={[0.16, 0.59, 0.04]} rotation={[0.2, 0, 0.82]} castShadow />

      {variant === 'archer' ? (
        <>
          <mesh geometry={geo.bow} material={mat.wood} position={[0.25, 0.63, 0.12]} rotation={[0, Math.PI / 2, Math.PI / 2]} castShadow />
          <mesh geometry={geo.bowString} material={mat.steel} position={[0.25, 0.63, 0.12]} rotation={[0, 0, 0]} castShadow />
          <mesh geometry={geo.arrow} material={mat.wood} position={[0.02, 0.63, 0.2]} rotation={[Math.PI / 2, 0, Math.PI / 2]} castShadow />
          <mesh geometry={geo.spearHead} material={mat.steel} position={[0.24, 0.63, 0.42]} rotation={[Math.PI / 2, 0, 0]} castShadow />
          <mesh geometry={geo.quiver} material={mat.darkLeather} position={[-0.15, 0.64, -0.12]} rotation={[0.28, 0, -0.28]} castShadow />
        </>
      ) : null}

      {variant === 'standard' ? (
        <>
          <mesh geometry={geo.staff} material={mat.wood} position={[0.2, 0.7, 0.08]} castShadow />
          <mesh geometry={geo.spearHead} material={mat.steel} position={[0.2, 1.18, 0.08]} castShadow />
          <mesh geometry={geo.banner} material={cloth} position={[0.32, 0.94, 0.08]} castShadow />
        </>
      ) : null}

      {variant === 'commander' || variant === 'guard' ? (
        <>
          <mesh geometry={geo.shield} material={mat.bronze} position={[-0.2, 0.58, 0.16]} rotation={[Math.PI / 2, 0, 0.25]} castShadow />
          <mesh geometry={geo.swordBlade} material={mat.steel} position={[0.2, 0.66, 0.18]} rotation={[-0.28, 0, -0.28]} castShadow />
          <mesh geometry={geo.swordGrip} material={mat.wood} position={[0.15, 0.47, 0.12]} rotation={[-0.28, 0, -0.28]} castShadow />
        </>
      ) : null}
    </group>
  );
}

function HorseArcher({ color }: { color: PieceColor }) {
  const cloth = sideMat[color].cloth;
  return (
    <group scale={0.86}>
      <mesh geometry={geo.horseBody} material={mat.horse} position={[0, 0.42, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow />
      <mesh geometry={geo.horseNeck} material={mat.horse} position={[0, 0.63, 0.34]} rotation={[-0.62, 0, 0]} castShadow />
      <mesh geometry={geo.horseHead} material={mat.horse} position={[0, 0.76, 0.5]} castShadow />
      <mesh geometry={geo.horseTail} material={mat.horseDark} position={[0, 0.5, -0.46]} rotation={[0.78, 0, 0]} castShadow />
      {[[-0.14, 0.21, 0.2], [0.14, 0.21, 0.2], [-0.14, 0.21, -0.2], [0.14, 0.21, -0.2]].map(([x, y, z], i) => (
        <mesh key={`horse-leg-${i}`} geometry={geo.horseLeg} material={mat.horse} position={[x, y, z]} castShadow />
      ))}
      <mesh geometry={geo.saddle} material={cloth} position={[0, 0.64, -0.03]} castShadow />
      <Humanoid color={color} variant="archer" scale={0.56} position={[0, 0.61, -0.03]} />
    </group>
  );
}

function WarElephant({ color }: { color: PieceColor }) {
  const cloth = sideMat[color].cloth;
  const accent = sideMat[color].accent;
  return (
    <group scale={0.78}>
      <mesh geometry={geo.elephantBody} material={mat.elephant} position={[0, 0.58, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow />
      <mesh geometry={geo.caparison} material={cloth} position={[0, 0.8, 0]} castShadow />
      <mesh geometry={geo.elephantHead} material={mat.elephant} position={[0, 0.74, 0.48]} castShadow />
      <mesh geometry={geo.elephantTrunk} material={mat.elephant} position={[0, 0.46, 0.7]} rotation={[0.45, 0, 0]} castShadow />
      <mesh geometry={geo.elephantEar} material={mat.elephant} position={[-0.22, 0.76, 0.42]} scale={[0.8, 1.05, 0.38]} castShadow />
      <mesh geometry={geo.elephantEar} material={mat.elephant} position={[0.22, 0.76, 0.42]} scale={[0.8, 1.05, 0.38]} castShadow />
      <mesh geometry={geo.tusk} material={mat.ivory} position={[-0.09, 0.65, 0.68]} rotation={[-1.0, 0.16, 0]} castShadow />
      <mesh geometry={geo.tusk} material={mat.ivory} position={[0.09, 0.65, 0.68]} rotation={[-1.0, -0.16, 0]} castShadow />
      {[[-0.2, 0.22, 0.22], [0.2, 0.22, 0.22], [-0.2, 0.22, -0.24], [0.2, 0.22, -0.24]].map(([x, y, z], i) => (
        <mesh key={`elephant-leg-${i}`} geometry={geo.elephantLeg} material={mat.elephant} position={[x, y, z]} castShadow />
      ))}
      <mesh geometry={geo.howdah} material={mat.bronze} position={[0, 1.05, -0.04]} castShadow />
      <mesh geometry={geo.banner} material={accent} position={[0, 1.2, 0.16]} scale={[0.9, 0.8, 1]} castShadow />
      <Humanoid color={color} variant="commander" scale={0.46} position={[0, 1.04, -0.03]} />
    </group>
  );
}

function WarChariot({ color }: { color: PieceColor }) {
  const cloth = sideMat[color].cloth;
  return (
    <group scale={0.82}>
      <mesh geometry={geo.chariotCabin} material={mat.leather} position={[0, 0.34, -0.12]} castShadow />
      <mesh geometry={geo.chariotPanel} material={cloth} position={[0, 0.48, 0.11]} castShadow />
      <mesh geometry={geo.axle} material={mat.wood} position={[0, 0.25, 0.06]} rotation={[0, 0, Math.PI / 2]} castShadow />
      <mesh geometry={geo.wheel} material={mat.bronze} position={[-0.4, 0.25, 0.06]} rotation={[0, Math.PI / 2, 0]} castShadow />
      <mesh geometry={geo.wheel} material={mat.bronze} position={[0.4, 0.25, 0.06]} rotation={[0, Math.PI / 2, 0]} castShadow />
      <mesh geometry={geo.yoke} material={mat.wood} position={[0, 0.34, 0.42]} rotation={[0, 0, Math.PI / 2]} castShadow />
      <mesh geometry={geo.horseBody} material={mat.horse} position={[-0.16, 0.32, 0.55]} rotation={[Math.PI / 2, 0, 0]} scale={0.55} castShadow />
      <mesh geometry={geo.horseHead} material={mat.horse} position={[-0.16, 0.51, 0.74]} scale={0.62} castShadow />
      <mesh geometry={geo.horseBody} material={mat.horseDark} position={[0.16, 0.32, 0.55]} rotation={[Math.PI / 2, 0, 0]} scale={0.55} castShadow />
      <mesh geometry={geo.horseHead} material={mat.horseDark} position={[0.16, 0.51, 0.74]} scale={0.62} castShadow />
      <Humanoid color={color} variant="standard" scale={0.58} position={[0, 0.42, -0.13]} />
    </group>
  );
}

function RealisticUnit({
  type,
  color,
  figureRef,
}: {
  type: PieceType;
  color: PieceColor;
  figureRef: { current: THREE.Group | null };
}) {
  const shadowScale: Record<PieceType, [number, number, number]> = {
    p: [0.34, 0.25, 1],
    n: [0.56, 0.4, 1],
    b: [0.38, 0.28, 1],
    r: [0.58, 0.42, 1],
    q: [0.62, 0.46, 1],
    k: [0.42, 0.3, 1],
  };

  return (
    <group name={`volumetric-${color}${type}`}>
      <ContactShadow scale={shadowScale[type]} />
      <group ref={(node) => { figureRef.current = node; }} position={[0, 0, 0]}>
        {type === 'p' ? <Humanoid color={color} variant="archer" scale={0.86} /> : null}
        {type === 'n' ? <HorseArcher color={color} /> : null}
        {type === 'b' ? <Humanoid color={color} variant="standard" scale={0.9} /> : null}
        {type === 'r' ? <WarChariot color={color} /> : null}
        {type === 'q' ? <WarElephant color={color} /> : null}
        {type === 'k' ? <Humanoid color={color} variant="commander" scale={0.98} /> : null}
      </group>
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
  const figureRef = useRef<THREE.Group>(null);
  const dustRef = useRef<THREE.Group>(null);
  const attackRef = useRef<THREE.Group>(null);
  const target = squareToPosition(piece.square);
  const started = useRef(false);
  const animKeyRef = useRef('');

  useFrame(({ clock }, delta) => {
    const group = groupRef.current;
    const figure = figureRef.current;
    const attack = attackRef.current;
    if (!group) return;

    const animKey = `${piece.fromSquare ?? ''}>${piece.square}:${piece.capturedAt ?? ''}`;
    if (animKeyRef.current !== animKey) {
      animKeyRef.current = animKey;
      started.current = false;
    }

    const idleYaw = piece.color === 'w' ? Math.PI : 0;
    const from = piece.fromSquare ? squareToPosition(piece.fromSquare) : target;
    const moveYaw = piece.fromSquare ? yawFromTo(from, target) : idleYaw;

    if (!started.current) {
      group.position.set(from[0], 0, from[2]);
      group.rotation.set(0, piece.fromSquare ? moveYaw : idleYaw, 0);
      group.scale.setScalar(1);
      if (figure) resetFigure(figure);
      if (reducedMotion) group.position.set(target[0], 0, target[2]);
      started.current = true;
    }

    const now = Date.now();
    const attackAge = piece.attackStartedAt === null ? Infinity : now - piece.attackStartedAt;
    const attackActive = attackAge < ATTACK_LUNGE_MS && !reducedMotion;

    if (piece.capturedAt !== null) {
      const t = reducedMotion ? 1 : Math.min(1, (now - piece.capturedAt) / CAPTURE_EFFECT_MS);
      const eased = easeOutCubic(t);
      const fallYaw = piece.capturedFromSquare
        ? yawFromTo(squareToPosition(piece.square), squareToPosition(piece.capturedFromSquare))
        : idleYaw;

      group.position.set(target[0], -eased * 0.035, target[2]);
      group.rotation.y = fallYaw;
      group.scale.setScalar(Math.max(0.001, 1 - eased * 0.82));
      if (figure) {
        figure.position.set(0, -eased * 0.04, -Math.sin(Math.PI * t) * 0.12);
        figure.rotation.x = -eased * 0.58;
        figure.rotation.z = (piece.color === 'w' ? 1 : -1) * eased * 0.42;
      }
      if (dustRef.current) {
        dustRef.current.visible = !reducedMotion && t < 1;
        dustRef.current.scale.setScalar(0.72 + eased * 2.05);
        dustRef.current.rotation.y += delta * 2.4;
      }
      if (attack) attack.visible = false;
      return;
    }

    group.scale.setScalar(1);
    const dx = target[0] - group.position.x;
    const dz = target[2] - group.position.z;
    const dist = Math.hypot(dx, dz);

    if (dist > 0.005) {
      const total = Math.max(Math.hypot(target[0] - from[0], target[2] - from[2]), 0.001);
      const progress = Math.min(1, Math.max(0, 1 - dist / total));
      const speed = piece.type === 'r' || piece.type === 'q' ? MOVE_SPEED * 0.82 : MOVE_SPEED;
      const step = Math.min(dist, speed * delta);
      group.position.x += (dx / dist) * step;
      group.position.z += (dz / dist) * step;
      group.rotation.y = yawFromTo([group.position.x, 0, group.position.z], target);
      group.position.y = piece.type === 'n' ? Math.sin(Math.PI * progress) * 0.24 : 0;

      if (figure) {
        const heavy = piece.type === 'q' || piece.type === 'r';
        const stride = Math.sin(clock.elapsedTime * (heavy ? 9 : 13));
        figure.position.y = Math.abs(stride) * (heavy ? 0.012 : 0.024);
        figure.position.z = Math.max(0, Math.sin(Math.PI * progress)) * (heavy ? 0.04 : 0.065);
        figure.rotation.x = heavy ? -0.05 : -0.09;
        figure.rotation.z = stride * (heavy ? 0.018 : 0.035);
      }
    } else {
      group.position.set(target[0], 0, target[2]);
      group.rotation.y = attackActive ? moveYaw : idleYaw;
      if (figure) {
        const attackT = attackActive ? Math.min(1, attackAge / ATTACK_LUNGE_MS) : 0;
        const lunge = Math.sin(Math.PI * attackT);
        figure.position.y = lunge * 0.018;
        figure.position.z = lunge * 0.18;
        figure.rotation.x = -lunge * 0.18;
        figure.rotation.z = Math.sin(clock.elapsedTime * 2.2) * 0.006;
      }
    }

    if (attack) {
      const attackT = attackActive ? Math.min(1, attackAge / ATTACK_LUNGE_MS) : 1;
      attack.visible = attackActive;
      attack.scale.setScalar(0.7 + attackT * 1.4);
      attack.rotation.y += delta * 3.6;
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
      <RealisticUnit type={piece.type} color={piece.color} figureRef={figureRef} />
      <group ref={attackRef} visible={false}>
        <mesh geometry={geo.shock} material={mat.shock} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.08, 0.18]} />
        <mesh geometry={geo.spark} material={mat.spark} rotation={[0.9, 0.1, -0.35]} position={[0.13, 0.28, 0.18]} />
        <mesh geometry={geo.spark} material={mat.spark} rotation={[0.7, 2.2, 0.42]} position={[-0.12, 0.24, 0.16]} />
      </group>
      {piece.capturedAt !== null ? (
        <group ref={dustRef}>
          <mesh geometry={geo.impact} material={mat.impact} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.12, 0]} />
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <mesh
              key={`dust-${i}`}
              geometry={geo.dust}
              material={mat.dust}
              position={[Math.cos(i * 1.35) * 0.2, 0.14 + i * 0.04, Math.sin(i * 1.65) * 0.2]}
            />
          ))}
          {[0, 1, 2, 3].map((i) => (
            <mesh
              key={`spark-${i}`}
              geometry={geo.spark}
              material={mat.spark}
              rotation={[0.8, i * 1.6, 0.3]}
              position={[Math.cos(i * 1.6) * 0.16, 0.23 + i * 0.035, Math.sin(i * 1.6) * 0.16]}
            />
          ))}
        </group>
      ) : null}
    </group>
  );
}

function yawFromTo(from: [number, number, number], to: [number, number, number]): number {
  return Math.atan2(to[0] - from[0], to[2] - from[2]);
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function resetFigure(figure: THREE.Group): void {
  figure.position.set(0, 0, 0);
  figure.rotation.set(0, 0, 0);
  figure.scale.setScalar(1);
}
