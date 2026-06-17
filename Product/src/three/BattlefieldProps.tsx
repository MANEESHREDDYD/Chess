import { useMemo } from 'react';
import * as THREE from 'three';

/*
  Reference-guided battlefield scenery. All assets are procedural and live
  outside the playable grid so raycasts and board readability stay clean.
*/
const mat = {
  ground: new THREE.MeshStandardMaterial({ color: '#b8905f', roughness: 1 }),
  groundDark: new THREE.MeshStandardMaterial({ color: '#8e6d49', roughness: 1 }),
  rock: new THREE.MeshStandardMaterial({ color: '#7f7770', roughness: 0.95 }),
  trunk: new THREE.MeshStandardMaterial({ color: '#5e4630', roughness: 0.95 }),
  leaf: new THREE.MeshStandardMaterial({ color: '#536340', roughness: 0.96 }),
  dryLeaf: new THREE.MeshStandardMaterial({ color: '#6f6a47', roughness: 0.98 }),
  pole: new THREE.MeshStandardMaterial({ color: '#4f3e2d', roughness: 0.92 }),
  blueCloth: new THREE.MeshStandardMaterial({ color: '#284f8f', roughness: 0.88, side: THREE.DoubleSide }),
  redCloth: new THREE.MeshStandardMaterial({ color: '#6f2a26', roughness: 0.88, side: THREE.DoubleSide }),
  saffronCloth: new THREE.MeshStandardMaterial({ color: '#bd7b34', roughness: 0.9, side: THREE.DoubleSide }),
  tent: new THREE.MeshStandardMaterial({ color: '#776852', roughness: 1 }),
  wall: new THREE.MeshStandardMaterial({ color: '#9a8161', roughness: 0.95 }),
  leather: new THREE.MeshStandardMaterial({ color: '#5d4330', roughness: 0.84 }),
  bronze: new THREE.MeshStandardMaterial({ color: '#9a6f3a', roughness: 0.48, metalness: 0.58 }),
  steel: new THREE.MeshStandardMaterial({ color: '#bcb6aa', roughness: 0.42, metalness: 0.66 }),
  elephant: new THREE.MeshStandardMaterial({ color: '#736d64', roughness: 0.92 }),
  horse: new THREE.MeshStandardMaterial({ color: '#61412b', roughness: 0.86 }),
  skin: new THREE.MeshStandardMaterial({ color: '#9d6c4d', roughness: 0.76 }),
  hair: new THREE.MeshStandardMaterial({ color: '#14120f', roughness: 0.95 }),
  ivory: new THREE.MeshStandardMaterial({ color: '#e5d9c5', roughness: 0.58 }),
};

const geo = {
  ground: new THREE.CylinderGeometry(17, 17, 0.2, 48),
  patch: new THREE.CircleGeometry(5.2, 32),
  rock: new THREE.IcosahedronGeometry(0.34, 0),
  trunk: new THREE.CylinderGeometry(0.06, 0.12, 0.95, 8),
  canopy: new THREE.ConeGeometry(0.54, 0.95, 8),
  branch: new THREE.CylinderGeometry(0.025, 0.035, 0.72, 6),
  pole: new THREE.CylinderGeometry(0.035, 0.04, 3.1, 8),
  banner: new THREE.PlaneGeometry(0.72, 0.44),
  smallBanner: new THREE.PlaneGeometry(0.44, 0.28),
  tent: new THREE.ConeGeometry(0.78, 0.86, 6),
  wallBlock: new THREE.BoxGeometry(1.1, 0.44, 0.36),
  tower: new THREE.CylinderGeometry(0.36, 0.46, 0.9, 8),
  parapet: new THREE.BoxGeometry(0.24, 0.18, 0.18),
  soldierBody: new THREE.CapsuleGeometry(0.08, 0.22, 4, 8),
  soldierHead: new THREE.SphereGeometry(0.055, 10, 8),
  spear: new THREE.CylinderGeometry(0.011, 0.011, 0.72, 6),
  spearHead: new THREE.ConeGeometry(0.032, 0.08, 7),
  shield: new THREE.CylinderGeometry(0.08, 0.08, 0.02, 16),
  elephantBody: new THREE.CapsuleGeometry(0.52, 0.82, 5, 14),
  elephantHead: new THREE.SphereGeometry(0.34, 14, 12),
  elephantLeg: new THREE.CylinderGeometry(0.1, 0.13, 0.56, 10),
  elephantEar: new THREE.PlaneGeometry(0.42, 0.36),
  elephantTrunk: new THREE.CylinderGeometry(0.07, 0.11, 0.75, 10),
  tusk: new THREE.ConeGeometry(0.04, 0.34, 8),
  howdah: new THREE.BoxGeometry(0.58, 0.45, 0.54),
  caparison: new THREE.BoxGeometry(0.78, 0.045, 0.96),
  horseBody: new THREE.CapsuleGeometry(0.26, 0.72, 5, 12),
  horseNeck: new THREE.CylinderGeometry(0.09, 0.15, 0.48, 10),
  horseHead: new THREE.SphereGeometry(0.15, 12, 10),
  horseLeg: new THREE.CylinderGeometry(0.035, 0.045, 0.55, 8),
  saddle: new THREE.BoxGeometry(0.52, 0.07, 0.36),
  wheel: new THREE.TorusGeometry(0.24, 0.035, 8, 18),
  chariot: new THREE.BoxGeometry(0.86, 0.34, 0.62),
  chariotPanel: new THREE.BoxGeometry(0.9, 0.42, 0.06),
};

function Tree({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh geometry={geo.trunk} material={mat.trunk} position={[0, 0.48, 0]} castShadow />
      <mesh geometry={geo.branch} material={mat.trunk} rotation={[0.7, 0, -0.7]} position={[-0.22, 0.94, 0]} castShadow />
      <mesh geometry={geo.branch} material={mat.trunk} rotation={[0.7, 0, 0.72]} position={[0.22, 0.9, 0]} castShadow />
      <mesh geometry={geo.canopy} material={mat.leaf} position={[0, 1.34, 0]} castShadow />
      <mesh geometry={geo.canopy} material={mat.dryLeaf} position={[0.22, 1.16, 0.06]} scale={[0.62, 0.62, 0.62]} castShadow />
    </group>
  );
}

function Banner({ position, side }: { position: [number, number, number]; side: 'pandava' | 'kaurava' }) {
  const cloth = side === 'pandava' ? mat.blueCloth : mat.redCloth;
  return (
    <group position={position}>
      <mesh geometry={geo.pole} material={mat.pole} position={[0, 1.55, 0]} castShadow />
      <mesh geometry={geo.banner} material={cloth} position={[0.38, 2.72, 0]} castShadow />
      <mesh geometry={geo.smallBanner} material={mat.saffronCloth} position={[0.22, 2.25, 0]} castShadow />
    </group>
  );
}

function BattleLineSoldier({
  position,
  side,
  rotationY,
}: {
  position: [number, number, number];
  side: 'pandava' | 'kaurava';
  rotationY: number;
}) {
  const cloth = side === 'pandava' ? mat.blueCloth : mat.redCloth;
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh geometry={geo.soldierBody} material={mat.skin} position={[0, 0.36, 0]} castShadow />
      <mesh geometry={geo.soldierHead} material={mat.skin} position={[0, 0.58, 0]} castShadow />
      <mesh geometry={geo.soldierHead} material={mat.hair} position={[0, 0.61, -0.01]} scale={[1.05, 0.55, 1.05]} castShadow />
      <mesh geometry={geo.smallBanner} material={cloth} position={[0, 0.28, 0.05]} scale={[0.36, 0.6, 0.36]} castShadow />
      <mesh geometry={geo.spear} material={mat.pole} position={[0.13, 0.52, 0]} castShadow />
      <mesh geometry={geo.spearHead} material={mat.steel} position={[0.13, 0.91, 0]} castShadow />
      <mesh geometry={geo.shield} material={mat.bronze} rotation={[Math.PI / 2, 0, 0]} position={[-0.1, 0.42, 0.04]} castShadow />
    </group>
  );
}

function DistantFort() {
  return (
    <group position={[0, 0, -12.5]}>
      {[-4.4, -3.25, -2.1, -0.95, 0.2, 1.35, 2.5, 3.65, 4.8].map((x) => (
        <mesh key={x} geometry={geo.wallBlock} material={mat.wall} position={[x, 0.34, 0]} castShadow />
      ))}
      {[-5.2, 5.55].map((x) => (
        <group key={x} position={[x, 0.6, 0]}>
          <mesh geometry={geo.tower} material={mat.wall} castShadow />
          {[-0.24, 0, 0.24].map((dx) => (
            <mesh key={dx} geometry={geo.parapet} material={mat.wall} position={[dx, 0.52, 0]} castShadow />
          ))}
        </group>
      ))}
    </group>
  );
}

export function BattlefieldProps() {
  const showPrototypeDressing = false;

  const rocks = useMemo(
    () =>
      [
        [-5.4, 0, 4.6, 1.1],
        [5.2, 0, -4.4, 0.8],
        [-4.9, 0, -5.1, 1.3],
        [5.6, 0, 4.9, 0.9],
        [-6.3, 0, 0.8, 0.7],
        [6.4, 0, -1.2, 1.0],
        [-2.2, 0, 7.1, 0.6],
        [2.6, 0, -7.2, 0.62],
      ] as const,
    []
  );

  const soldiers = useMemo(
    () =>
      [
        [-6.4, 0, 5.4, 'pandava', -0.5],
        [-5.75, 0, 5.9, 'pandava', -0.35],
        [6.25, 0, 5.1, 'pandava', 0.45],
        [5.55, 0, 5.7, 'pandava', 0.3],
        [-6.2, 0, -5.35, 'kaurava', 2.7],
        [-5.45, 0, -5.95, 'kaurava', 2.8],
        [6.35, 0, -5.1, 'kaurava', -2.65],
        [5.62, 0, -5.76, 'kaurava', -2.8],
      ] as const,
    []
  );

  return (
    <group name="battlefield-props">
      <mesh geometry={geo.ground} material={mat.ground} position={[0, -0.21, 0]} receiveShadow />
      <mesh geometry={geo.patch} material={mat.groundDark} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.095, 0]} receiveShadow />

      <DistantFort />

      {rocks.map(([x, y, z, s], i) => (
        <mesh key={i} geometry={geo.rock} material={mat.rock} position={[x, y + 0.16 * s, z]} scale={s} castShadow />
      ))}

      {showPrototypeDressing ? (
        <>
          <Tree position={[-7.3, 0, -2.4]} scale={1.1} />
          <Tree position={[7.4, 0, 2.1]} scale={0.96} />
          <Tree position={[-6.8, 0, 6.55]} scale={0.82} />
          <Tree position={[6.9, 0, -6.25]} scale={0.74} />

          <Banner position={[-5.4, 0, 6.2]} side="pandava" />
          <Banner position={[5.4, 0, 6.2]} side="pandava" />
          <Banner position={[-5.4, 0, -6.2]} side="kaurava" />
          <Banner position={[5.4, 0, -6.2]} side="kaurava" />

          {soldiers.map(([x, y, z, side, rot], i) => (
            <BattleLineSoldier
              key={i}
              position={[x, y, z]}
              side={side}
              rotationY={rot}
            />
          ))}

          <mesh geometry={geo.tent} material={mat.tent} position={[-9.5, 0.43, -9]} castShadow />
          <mesh geometry={geo.tent} material={mat.tent} position={[-7.8, 0.43, -10]} castShadow />
          <mesh geometry={geo.tent} material={mat.tent} position={[9.6, 0.43, 9.2]} castShadow />
          <mesh geometry={geo.tent} material={mat.tent} position={[8.0, 0.43, 10.1]} castShadow />
        </>
      ) : null}

      {/*
        The previous off-board entourage used procedural horse/elephant/chariot
        meshes. At close zoom they read as floating toy props, so they stay out
        of the live scene until replaced by approved realistic rigged assets.
        Trees, tents, banners, and side-line soldiers are similarly withheld
        from close review until they are upgraded from prototype geometry.
      */}
    </group>
  );
}
