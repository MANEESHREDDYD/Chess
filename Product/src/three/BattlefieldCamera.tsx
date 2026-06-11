import { OrbitControls, PerspectiveCamera } from '@react-three/drei';

type BattlefieldCameraProps = {
  /** Flip the default view so the player's side is at the bottom. */
  playerColor: 'white' | 'black';
};

/**
 * Default cinematic angle: slightly raised behind the player's side. Orbit is
 * constrained so users can never look under the ground or lose the board.
 */
export function BattlefieldCamera({ playerColor }: BattlefieldCameraProps) {
  const zSign = playerColor === 'white' ? 1 : -1;
  return (
    <>
      <PerspectiveCamera makeDefault fov={42} position={[0, 7.4, 8.6 * zSign]} />
      <OrbitControls
        enablePan={false}
        minDistance={6}
        maxDistance={16}
        minPolarAngle={0.35}
        maxPolarAngle={1.25}
        target={[0, 0, 0]}
        makeDefault
      />
    </>
  );
}
