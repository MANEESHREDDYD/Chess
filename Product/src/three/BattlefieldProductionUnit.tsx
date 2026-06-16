import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { clone as cloneSkinnedScene } from 'three/examples/jsm/utils/SkeletonUtils.js';
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
  // SkeletonUtils.clone rebinds SkinnedMesh instances to a freshly cloned
  // skeleton; a plain Object3D.clone would leave every rigged unit sharing the
  // original armature, so the new skeletal GLBs would not deform per instance.
  const scene = useMemo(() => {
    const clonedScene = cloneSkinnedScene(gltf.scene);
    prepareProductionScene(clonedScene);
    return clonedScene;
  }, [gltf.scene]);
  const mixer = useMemo(() => new THREE.AnimationMixer(scene), [scene]);
  const activeActionsRef = useRef<THREE.AnimationAction[]>([]);
  const activeActionKeyRef = useRef('');
  const clipsByName = useMemo(() => {
    const entries = gltf.animations.map((clip) => [clip.name, clip] as const);
    return new Map(entries);
  }, [gltf.animations]);

  useEffect(() => {
    if (reducedMotion) {
      mixer.stopAllAction();
      activeActionsRef.current = [];
      activeActionKeyRef.current = '';
      return;
    }

    const requestedClips = clipsForRole(clipsByName, animationRole);
    if (requestedClips.length === 0) return;

    const nextActionKey = requestedClips.map((clip) => clip.name).join('|');
    if (activeActionKeyRef.current === nextActionKey) return;

    for (const action of activeActionsRef.current) {
      action.fadeOut(0.12);
    }

    const nextActions = requestedClips.map((clip) => {
      const action = mixer.clipAction(clip, scene);
      action.enabled = true;
      action.clampWhenFinished = animationRole === 'attack' || animationRole === 'hit';
      action.loop =
        animationRole === 'attack' || animationRole === 'hit'
          ? THREE.LoopOnce
          : THREE.LoopRepeat;
      action.reset().fadeIn(0.12).play();
      return action;
    });
    activeActionsRef.current = nextActions;
    activeActionKeyRef.current = nextActionKey;

    return () => {
      for (const action of nextActions) {
        action.fadeOut(0.08);
      }
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

function asMaterialList(material: THREE.Material | THREE.Material[]): THREE.Material[] {
  return Array.isArray(material) ? material : [material];
}

function prepareProductionScene(scene: THREE.Object3D) {
  scene.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.castShadow = true;
      object.receiveShadow = true;
      for (const material of asMaterialList(object.material)) {
        if (isStandardLikeMaterial(material)) {
          normalizeTextureChannels(material);
          if (typeof material.roughness === 'number') {
            material.roughness = Math.max(material.roughness, 0.55);
          }
          material.needsUpdate = true;
        }
      }
    }
  });
}

type StandardLikeMaterial = THREE.Material & {
  roughness?: number;
  [key: string]: unknown;
};

function isStandardLikeMaterial(material: THREE.Material): material is StandardLikeMaterial {
  const flags = material as THREE.Material & {
    isMeshStandardMaterial?: boolean;
    isMeshPhysicalMaterial?: boolean;
  };
  return Boolean(
    flags.isMeshStandardMaterial ||
      flags.isMeshPhysicalMaterial ||
      material instanceof THREE.MeshStandardMaterial ||
      material instanceof THREE.MeshPhysicalMaterial
  );
}

function normalizeTextureChannels(material: StandardLikeMaterial) {
  const textureKeys = [
    'map',
    'alphaMap',
    'aoMap',
    'bumpMap',
    'displacementMap',
    'emissiveMap',
    'envMap',
    'lightMap',
    'metalnessMap',
    'normalMap',
    'roughnessMap',
  ] as const;

  for (const key of textureKeys) {
    const texture = material[key] as THREE.Texture | null | undefined;
    if (texture && texture.channel !== 0) {
      texture.channel = 0;
      texture.needsUpdate = true;
    }
  }

  if (
    (material as { isMeshPhysicalMaterial?: boolean }).isMeshPhysicalMaterial ||
    material instanceof THREE.MeshPhysicalMaterial
  ) {
    const physicalTextureKeys = [
      'anisotropyMap',
      'clearcoatMap',
      'clearcoatNormalMap',
      'clearcoatRoughnessMap',
      'iridescenceMap',
      'iridescenceThicknessMap',
      'sheenColorMap',
      'sheenRoughnessMap',
      'specularColorMap',
      'specularIntensityMap',
      'thicknessMap',
      'transmissionMap',
    ] as const;

    for (const key of physicalTextureKeys) {
      const texture = material[key] as THREE.Texture | null | undefined;
      if (texture && texture.channel !== 0) {
        texture.channel = 0;
        texture.needsUpdate = true;
      }
    }
  }
}

function clipsForRole(
  clipsByName: ReadonlyMap<string, THREE.AnimationClip>,
  role: BattlefieldModelAnimationRole
): THREE.AnimationClip[] {
  const baseRole = role === 'capture' ? 'hit' : role;
  const primary = clipsByName.get(baseRole) ?? clipsByName.get('idle') ?? null;
  const rider = clipsByName.get(`rider_${baseRole}`) ?? clipsByName.get('rider_idle') ?? null;
  return [primary, rider].filter((clip): clip is THREE.AnimationClip => Boolean(clip));
}
