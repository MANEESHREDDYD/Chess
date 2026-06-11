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
      <PerspectiveCamera makeDefault fov={45} position={[0, 8.2, 10.6 * zSign]} />
      <OrbitControls
        enablePan={false}
        minDistance={6}
        maxDistance={14}
        minPolarAngle={0.38}
        maxPolarAngle={1.16}
        target={[0, 0.12, 0]}
        makeDefault
      />
    </>
  );
}
