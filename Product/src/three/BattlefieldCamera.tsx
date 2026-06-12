import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

type BattlefieldCameraProps = {
  /** Flip the default view so the player's side is at the bottom. */
  playerColor: 'white' | 'black';
};

declare global {
  interface Window {
    __BATTLEFIELD_CAMERA_TEST__?: {
      state: () => {
        position: [number, number, number];
        target: [number, number, number] | null;
      };
    };
  }
}

/**
 * Tilted strategy camera with full inspection controls.
 * Users can orbit, pan, and zoom into any area of the battlefield.
 */
export function BattlefieldCamera({ playerColor }: BattlefieldCameraProps) {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const { camera } = useThree();
  const zSign = playerColor === 'white' ? 1 : -1;

  useEffect(() => {
    window.__BATTLEFIELD_CAMERA_TEST__ = {
      state: () => ({
        position: [camera.position.x, camera.position.y, camera.position.z],
        target: controlsRef.current
          ? [
              controlsRef.current.target.x,
              controlsRef.current.target.y,
              controlsRef.current.target.z,
            ]
          : null,
      }),
    };
    return () => {
      delete window.__BATTLEFIELD_CAMERA_TEST__;
    };
  }, [camera]);

  return (
    <>
      <PerspectiveCamera makeDefault fov={38} position={[0, 6.75, 8.95 * zSign]} />
      <OrbitControls
        ref={controlsRef}
        enablePan
        enableZoom
        enableRotate
        panSpeed={0.8}
        zoomSpeed={0.82}
        minDistance={2.2}
        maxDistance={15}
        minPolarAngle={0.42}
        maxPolarAngle={1.22}
        screenSpacePanning
        target={[0, 0.3, 0]}
        zoomToCursor
        makeDefault
      />
    </>
  );
}
