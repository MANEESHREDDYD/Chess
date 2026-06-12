import { OrbitControls, PerspectiveCamera } from '@react-three/drei';

type BattlefieldCameraProps = {
  /** Flip the default view so the player's side is at the bottom. */
  playerColor: 'white' | 'black';
};

/**
 * Tilted strategy camera with a slightly lower, closer reference-style angle.
 * Orbit remains constrained so the board cannot be lost or viewed from below.
 */
export function BattlefieldCamera({ playerColor }: BattlefieldCameraProps) {
  const zSign = playerColor === 'white' ? 1 : -1;
  return (
    <>
      <PerspectiveCamera makeDefault fov={38} position={[0, 6.6, 8.8 * zSign]} />
      <OrbitControls
        enablePan={false}
        minDistance={5.2}
        maxDistance={11.5}
        minPolarAngle={0.5}
        maxPolarAngle={1.08}
        target={[0, 0.3, 0]}
        makeDefault
      />
    </>
  );
}
