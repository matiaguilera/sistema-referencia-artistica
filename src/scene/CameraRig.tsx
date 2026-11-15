import { CameraControls } from '@react-three/drei';
import { useEffect, useRef, type ComponentRef } from 'react';
import { DEFAULT_FRAME, type ModelEntry } from '../registry/types';
import { goToPreset, onUserCameraMove, registerCamera } from './cameraApi';
import { framingDistance } from './cameraPresets';
import { useAppStore } from '../state/store';

/**
 * Cámara orbital: arrastrar = rotar, rueda / pellizco = zoom,
 * clic derecho / dos dedos = desplazar. Transiciones suaves entre vistas.
 */
export function CameraRig({ frame = DEFAULT_FRAME }: { frame?: ModelEntry['frame'] }) {
  const ref = useRef<ComponentRef<typeof CameraControls>>(null);
  const f = frame ?? DEFAULT_FRAME;
  const base = framingDistance(f.radius);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    registerCamera(c, f);
    // Al cambiar de modelo se conserva el ángulo del preset activo (o se vuelve al frontal).
    goToPreset(useAppStore.getState().activePreset ?? 'front', false);
    c.addEventListener('controlstart', onUserCameraMove);
    return () => {
      c.removeEventListener('controlstart', onUserCameraMove);
      registerCamera(null, f);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.target[0], f.target[1], f.target[2], f.radius]);

  return (
    <CameraControls
      ref={ref}
      makeDefault
      smoothTime={0.35}
      draggingSmoothTime={0.08}
      minDistance={base * 0.3}
      maxDistance={base * 4}
      dollyToCursor
      // Evita que el pan se aleje demasiado de la cabeza.
      infinityDolly={false}
    />
  );
}
