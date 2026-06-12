import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { BattlefieldModelAnimationRole, BattlefieldModelSlot } from './battlefieldModelSlots';

type BattlefieldProductionUnitProps = {
  slot: BattlefieldModelSlot;
  animationRole: BattlefieldModelAnimationRole;
  reducedMotion: boolean;
};

export function BattlefieldProductionUnit({
  slot,
  animationRole,
  reducedMotion,
}: BattlefieldProductionUnitProps) {
  const gltf = useGLTF(slot.url);
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  const mixer = useMemo(() => new THREE.AnimationMixer(scene), [scene]);
  const activeActionRef = useRef<THREE.AnimationAction | null>(null);
  const clipsByName = useMemo(() => {
    const entries = gltf.animations.map((clip) => [clip.name, clip] as const);
    return new Map(entries);
  }, [gltf.animations]);

  useEffect(() => {
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
        if (object.material instanceof THREE.MeshStandardMaterial) {
          object.material.roughness = Math.max(object.material.roughness, 0.55);
          object.material.needsUpdate = true;
        }
      }
    });
  }, [scene]);

  useEffect(() => {
    if (reducedMotion) {
      mixer.stopAllAction();
      activeActionRef.current = null;
      return;
    }

    const requestedClip = clipForRole(clipsByName, animationRole);
    if (!requestedClip) return;

    const nextAction = mixer.clipAction(requestedClip, scene);
    if (activeActionRef.current === nextAction) return;

    if (activeActionRef.current) {
      activeActionRef.current.fadeOut(0.12);
    }

    nextAction.enabled = true;
    nextAction.clampWhenFinished = animationRole === 'attack' || animationRole === 'hit';
    nextAction.loop =
      animationRole === 'attack' || animationRole === 'hit'
        ? THREE.LoopOnce
        : THREE.LoopRepeat;
    nextAction.reset().fadeIn(0.12).play();
    activeActionRef.current = nextAction;

    return () => {
      nextAction.fadeOut(0.08);
    };
  }, [animationRole, clipsByName, mixer, reducedMotion, scene]);

  useEffect(() => {
    return () => {
      mixer.stopAllAction();
    };
  }, [mixer]);

  useFrame((_, delta) => {
    if (!reducedMotion) mixer.update(delta);
  });

  return (
    <group
      name={`production-glb-${slot.id}`}
      position={[0, slot.yOffset, 0]}
      rotation={[0, slot.yawOffset, 0]}
      scale={slot.scale}
    >
      <primitive object={scene} />
    </group>
  );
}

function clipForRole(
  clipsByName: ReadonlyMap<string, THREE.AnimationClip>,
  role: BattlefieldModelAnimationRole
): THREE.AnimationClip | null {
  if (role === 'capture') return clipsByName.get('hit') ?? clipsByName.get('idle') ?? null;
  return clipsByName.get(role) ?? clipsByName.get('idle') ?? null;
}
