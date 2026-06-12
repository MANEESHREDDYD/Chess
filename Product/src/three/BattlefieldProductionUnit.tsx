import { Clone, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { BattlefieldModelSlot } from './battlefieldModelSlots';

type BattlefieldProductionUnitProps = {
  slot: BattlefieldModelSlot;
};

export function BattlefieldProductionUnit({ slot }: BattlefieldProductionUnitProps) {
  const gltf = useGLTF(slot.url);

  gltf.scene.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.castShadow = true;
      object.receiveShadow = true;
      if (object.material instanceof THREE.MeshStandardMaterial) {
        object.material.roughness = Math.max(object.material.roughness, 0.55);
        object.material.needsUpdate = true;
      }
    }
  });

  return (
    <group
      name={`production-glb-${slot.id}`}
      position={[0, slot.yOffset, 0]}
      rotation={[0, slot.yawOffset, 0]}
      scale={slot.scale}
    >
      <Clone object={gltf.scene} castShadow receiveShadow />
    </group>
  );
}
