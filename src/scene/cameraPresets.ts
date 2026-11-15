import type { Vec3 } from '../registry/types';

export type CameraPresetId =
  | 'front'
  | 'threeQuarterLeft'
  | 'threeQuarterRight'
  | 'profileLeft'
  | 'profileRight'
  | 'back'
  | 'low'
  | 'high';

export interface CameraPreset {
  id: CameraPresetId;
  label: string;
  hint: string;
  /** Azimut en grados alrededor del eje Y. 0 = de frente; positivo = hacia el lado izquierdo del modelo (+X). */
  azimuth: number;
  /** Elevación en grados. Positivo = la cámara está arriba (picado). */
  elevation: number;
  /** Tecla de atajo. */
  key: string;
}

export const CAMERA_PRESETS: CameraPreset[] = [
  { id: 'front', label: 'Frontal', hint: 'Vista de frente', azimuth: 0, elevation: 0, key: '1' },
  { id: 'threeQuarterLeft', label: '3/4 izq.', hint: 'Tres cuartos: se ve el lado izquierdo del modelo', azimuth: 45, elevation: 0, key: '2' },
  { id: 'threeQuarterRight', label: '3/4 der.', hint: 'Tres cuartos: se ve el lado derecho del modelo', azimuth: -45, elevation: 0, key: '3' },
  { id: 'profileLeft', label: 'Perfil izq.', hint: 'Perfil izquierdo del modelo', azimuth: 90, elevation: 0, key: '4' },
  { id: 'profileRight', label: 'Perfil der.', hint: 'Perfil derecho del modelo', azimuth: -90, elevation: 0, key: '5' },
  { id: 'back', label: 'Posterior', hint: 'Vista de espaldas', azimuth: 180, elevation: 0, key: '6' },
  { id: 'low', label: 'Contrapicado', hint: 'Vista desde abajo', azimuth: 0, elevation: -35, key: '7' },
  { id: 'high', label: 'Picado', hint: 'Vista desde arriba', azimuth: 0, elevation: 40, key: '8' },
];

const DEG = Math.PI / 180;

/** Posición de cámara para un preset, a 'distance' del objetivo. */
export function presetPosition(p: CameraPreset, target: Vec3, distance: number): Vec3 {
  const az = p.azimuth * DEG;
  const el = p.elevation * DEG;
  return [
    target[0] + distance * Math.cos(el) * Math.sin(az),
    target[1] + distance * Math.sin(el),
    target[2] + distance * Math.cos(el) * Math.cos(az),
  ];
}

/** FOV vertical estrecho (≈ teleobjetivo de retrato) para minimizar la distorsión de perspectiva. */
export const CAMERA_FOV = 30;

/**
 * Distancia que encuadra una esfera de radio r con el FOV vertical dado.
 * Con pantallas verticales (aspect < 1) manda el FOV horizontal, que es más estrecho.
 */
export function framingDistance(radius: number, aspect = 1, fovDeg = CAMERA_FOV) {
  const halfV = (fovDeg * DEG) / 2;
  const halfH = Math.atan(Math.tan(halfV) * aspect);
  return (radius / Math.sin(Math.min(halfV, halfH))) * 1.25;
}
