import { Canvas, useThree } from '@react-three/fiber';
import { Suspense, useEffect } from 'react';
import { registerCaptureState } from './captureApi';
import { ProportionGuides } from './ProportionGuides';
import * as THREE from 'three';
import { DEFAULT_FRAME } from '../registry/types';
import { useAppStore, useCurrentModel, type Background } from '../state/store';
import { CameraRig } from './CameraRig';
import { CAMERA_FOV } from './cameraPresets';
import { ValuesEffect } from './effects/ValuesEffect';
import { HeadModel } from './HeadModel';
import { Lighting } from './Lighting';
import { PartLabel } from './PartLabel';
import { useLabelDict } from './partLabels';

export const BACKGROUNDS: Record<Background, string> = {
  dark: '#1b1c1f',
  mid: '#7a7a7a',
  light: '#e9e7e3',
};

export function Viewer() {
  const entry = useCurrentModel();
  const background = useAppStore((s) => s.background);
  const valuesEnabled = useAppStore((s) => s.valuesEnabled);
  const target = (entry?.frame ?? DEFAULT_FRAME).target;
  const dict = useLabelDict(entry?.labels);

  return (
    <Canvas
      className="viewer-canvas"
      onPointerMissed={() => useAppStore.getState().setSelectedPart(null)}
      shadows={{ type: THREE.PCFSoftShadowMap }}
      dpr={[1, 2]}
      camera={{ fov: CAMERA_FOV, near: 0.01, far: 20, position: [0, 0, 0.7] }}
      gl={{ antialias: true }}
    >
      <color attach="background" args={[BACKGROUNDS[background]]} />
      <Lighting target={target} />
      {entry && (
        <Suspense fallback={null}>
          <HeadModel key={entry.id} entry={entry} />
        </Suspense>
      )}
      {entry && (
        <Suspense fallback={null}>
          <ProportionGuides key={entry.id} entry={entry} />
        </Suspense>
      )}
      <PartLabel dict={dict} />
      <CameraRig frame={entry?.frame} />
      {valuesEnabled && <ValuesEffect />}
      <CaptureBridge />
    </Canvas>
  );
}

/** Da a la captura PNG acceso al renderer y a la escena; avisa si se pierde el contexto WebGL. */
function CaptureBridge() {
  const get = useThree((s) => s.get);
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    registerCaptureState(get);
    return () => registerCaptureState(null);
  }, [get]);

  useEffect(() => {
    const el = gl.domElement;
    const lost = () => useAppStore.getState().setGlContextLost(true);
    const restored = () => useAppStore.getState().setGlContextLost(false);
    el.addEventListener('webglcontextlost', lost);
    el.addEventListener('webglcontextrestored', restored);
    return () => {
      el.removeEventListener('webglcontextlost', lost);
      el.removeEventListener('webglcontextrestored', restored);
    };
  }, [gl]);
  return null;
}
