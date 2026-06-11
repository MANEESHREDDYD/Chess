import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const DUST_COUNT = 120;

/**
 * Ambient drifting dust motes. Cheap: one Points object, positions mutated in
 * place each frame, no allocations. Skipped entirely under reduced motion.
 */
export function BattlefieldDust({ reducedMotion }: { reducedMotion: boolean }) {
  const pointsRef = useRef<THREE.Points>(null);

  const { geometry, speeds } = useMemo(() => {
    const positions = new Float32Array(DUST_COUNT * 3);
    const speedArr = new Float32Array(DUST_COUNT);
    for (let i = 0; i < DUST_COUNT; i += 1) {
      // Deterministic pseudo-scatter for stable screenshots.
      const a = (i * 2.399963) % (Math.PI * 2);
      const r = 3 + ((i * 37) % 100) / 10;
      positions[i * 3] = Math.cos(a) * r;
      positions[i * 3 + 1] = 0.2 + ((i * 13) % 30) / 12;
      positions[i * 3 + 2] = Math.sin(a) * r;
      speedArr[i] = 0.08 + ((i * 7) % 10) / 60;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return { geometry: g, speeds: speedArr };
  }, []);

  const material = useMemo(
    () =>
      new THREE.PointsMaterial({
        color: '#d8c19a',
        size: 0.05,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
      }),
    []
  );

  useFrame((_, delta) => {
    if (reducedMotion || !pointsRef.current) return;
    const pos = pointsRef.current.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < DUST_COUNT; i += 1) {
      let x = pos.getX(i) + speeds[i] * delta;
      if (x > 14) x = -14;
      pos.setX(i, x);
    }
    pos.needsUpdate = true;
  });

  return <points ref={pointsRef} geometry={geometry} material={material} />;
}
