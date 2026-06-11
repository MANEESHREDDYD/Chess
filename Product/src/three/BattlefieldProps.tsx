import { useMemo } from 'react';
import * as THREE from 'three';

/* ----------------------------------------------------------------------------
   Battlefield scenery — ALL procedural (see assetManifest.ts). Props live
   outside the board so they never occlude squares or pieces.
   ------------------------------------------------------------------------- */

const groundMat = new THREE.MeshStandardMaterial({ color: '#c2a06e', roughness: 1 });
const rockMat = new THREE.MeshStandardMaterial({ color: '#8d8378', roughness: 0.95 });
const trunkMat = new THREE.MeshStandardMaterial({ color: '#6e5236', roughness: 0.95 });
const canopyMat = new THREE.MeshStandardMaterial({ color: '#5d6b3f', roughness: 0.95 });
const poleMat = new THREE.MeshStandardMaterial({ color: '#5b4a38', roughness: 0.9 });
const pandavaCloth = new THREE.MeshStandardMaterial({ color: '#3f7fd4', roughness: 0.85, side: THREE.DoubleSide });
const kauravaCloth = new THREE.MeshStandardMaterial({ color: '#7e2d26', roughness: 0.85, side: THREE.DoubleSide });
const tentMat = new THREE.MeshStandardMaterial({ color: '#7b6a52', roughness: 1 });
const elephantMat = new THREE.MeshStandardMaterial({ color: '#7d7468', roughness: 0.9 });

const groundGeo = new THREE.CylinderGeometry(16, 16, 0.2, 36);
const rockGeo = new THREE.IcosahedronGeometry(0.32, 0);
const trunkGeo = new THREE.CylinderGeometry(0.08, 0.12, 0.9, 8);
const canopyGeo = new THREE.ConeGeometry(0.55, 1.0, 8);
const poleGeo = new THREE.CylinderGeometry(0.04, 0.04, 3.4, 8);
const bannerGeo = new THREE.PlaneGeometry(0.7, 0.45);
const tentGeo = new THREE.ConeGeometry(0.9, 1.0, 6);
const elephantBodyGeo = new THREE.CapsuleGeometry(0.5, 0.7, 4, 10);
const elephantHeadGeo = new THREE.SphereGeometry(0.34, 10, 10);
const trunkCurveGeo = new THREE.CylinderGeometry(0.07, 0.1, 0.7, 8);
const horseBodyGeo = new THREE.CapsuleGeometry(0.28, 0.6, 4, 10);
const horseNeckGeo = new THREE.ConeGeometry(0.16, 0.5, 8);

function Tree({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh geometry={trunkGeo} material={trunkMat} position={[0, 0.45, 0]} castShadow />
      <mesh geometry={canopyGeo} material={canopyMat} position={[0, 1.3, 0]} castShadow />
    </group>
  );
}

function Banner({ position, side }: { position: [number, number, number]; side: 'pandava' | 'kaurava' }) {
  return (
    <group position={position}>
      <mesh geometry={poleGeo} material={poleMat} position={[0, 1.7, 0]} castShadow />
      <mesh
        geometry={bannerGeo}
        material={side === 'pandava' ? pandavaCloth : kauravaCloth}
        position={[0.36, 3.0, 0]}
        castShadow
      />
    </group>
  );
}

function WarElephant({ position, rotationY }: { position: [number, number, number]; rotationY: number }) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh geometry={elephantBodyGeo} material={elephantMat} rotation={[0, 0, Math.PI / 2]} position={[0, 0.62, 0]} castShadow />
      <mesh geometry={elephantHeadGeo} material={elephantMat} position={[0.72, 0.74, 0]} castShadow />
      <mesh geometry={trunkCurveGeo} material={elephantMat} rotation={[0, 0, -0.7]} position={[1.02, 0.45, 0]} castShadow />
    </group>
  );
}

function Horse({ position, rotationY }: { position: [number, number, number]; rotationY: number }) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh geometry={horseBodyGeo} material={elephantMat} rotation={[0, 0, Math.PI / 2]} position={[0, 0.42, 0]} castShadow />
      <mesh geometry={horseNeckGeo} material={elephantMat} rotation={[0.6, 0, 0]} position={[0.42, 0.72, 0]} castShadow />
    </group>
  );
}

export function BattlefieldProps() {
  // Deterministic scatter (no Math.random — stable screenshots).
  const rocks = useMemo(
    () =>
      [
        [-5.4, 0, 4.6, 1.1],
        [5.2, 0, -4.4, 0.8],
        [-4.9, 0, -5.1, 1.3],
        [5.6, 0, 4.9, 0.9],
        [-6.3, 0, 0.8, 0.7],
        [6.4, 0, -1.2, 1.0],
      ] as const,
    []
  );

  return (
    <group name="battlefield-props">
      {/* Sand ground disc with a soft fog horizon. */}
      <mesh geometry={groundGeo} material={groundMat} position={[0, -0.21, 0]} receiveShadow />

      {rocks.map(([x, y, z, s], i) => (
        <mesh key={i} geometry={rockGeo} material={rockMat} position={[x, y + 0.16 * s, z]} scale={s} castShadow />
      ))}

      <Tree position={[-7.2, 0, -2.4]} />
      <Tree position={[7.4, 0, 2.1]} />
      <Tree position={[-6.6, 0, 6.4]} />

      {/* Side banners: Pandava (white side, +z) and Kaurava (black side, -z). */}
      <Banner position={[-5.4, 0, 6.2]} side="pandava" />
      <Banner position={[5.4, 0, 6.2]} side="pandava" />
      <Banner position={[-5.4, 0, -6.2]} side="kaurava" />
      <Banner position={[5.4, 0, -6.2]} side="kaurava" />

      {/* Distant camp silhouettes, softened by fog. */}
      <mesh geometry={tentGeo} material={tentMat} position={[-9.5, 0.5, -9]} castShadow />
      <mesh geometry={tentGeo} material={tentMat} position={[-7.8, 0.5, -10]} castShadow />
      <mesh geometry={tentGeo} material={tentMat} position={[9.6, 0.5, 9.2]} castShadow />
      <mesh geometry={tentGeo} material={tentMat} position={[8.0, 0.5, 10.1]} castShadow />

      {/* Edge fauna props — never on the board. */}
      <WarElephant position={[-8.6, 0, 3.6]} rotationY={0.6} />
      <WarElephant position={[8.8, 0, -3.2]} rotationY={-2.4} />
      <Horse position={[-8.2, 0, -4.6]} rotationY={1.2} />
      <Horse position={[8.4, 0, 5.0]} rotationY={-1.8} />
    </group>
  );
}
