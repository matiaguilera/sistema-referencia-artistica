export interface LightSettings {
  /** Grados alrededor del eje Y. 0 = de frente; positivo = lado izquierdo del modelo (+X). */
  azimuth: number;
  /** Grados. Positivo = desde arriba; negativo = desde abajo. */
  elevation: number;
  intensity: number;
  fillEnabled: boolean;
  fillIntensity: number;
  /** Luz ambiente (hemisférica): cuánto se aclaran las sombras. */
  ambient: number;
}

export type LightPresetId = 'rembrandt' | 'butterfly' | 'split' | 'rim' | 'below';

export interface LightPreset {
  id: LightPresetId;
  label: string;
  hint: string;
  settings: LightSettings;
}

export const LIGHT_PRESETS: LightPreset[] = [
  {
    id: 'rembrandt',
    label: 'Rembrandt',
    hint: 'Luz a ~45° de lado y ~40° arriba: triángulo de luz en la mejilla en sombra',
    settings: { azimuth: 45, elevation: 40, intensity: 3.2, fillEnabled: true, fillIntensity: 0.25, ambient: 0.15 },
  },
  {
    id: 'butterfly',
    label: 'Mariposa',
    hint: 'Paramount: luz frontal y alta; sombra en forma de mariposa bajo la nariz',
    settings: { azimuth: 0, elevation: 50, intensity: 3.2, fillEnabled: true, fillIntensity: 0.2, ambient: 0.15 },
  },
  {
    id: 'split',
    label: 'Split',
    hint: 'Luz lateral a 90°: la cara queda dividida en mitad luz, mitad sombra',
    settings: { azimuth: 90, elevation: 5, intensity: 3.2, fillEnabled: false, fillIntensity: 0.2, ambient: 0.12 },
  },
  {
    id: 'rim',
    label: 'Borde',
    hint: 'Contraluz: la luz viene de atrás y dibuja el contorno',
    settings: { azimuth: 150, elevation: 20, intensity: 4, fillEnabled: true, fillIntensity: 0.3, ambient: 0.15 },
  },
  {
    id: 'below',
    label: 'Desde abajo',
    hint: 'Luz desde abajo: invierte las sombras habituales de la cara',
    settings: { azimuth: 0, elevation: -50, intensity: 3.2, fillEnabled: false, fillIntensity: 0.2, ambient: 0.12 },
  },
];

export const DEFAULT_LIGHT: LightSettings = { ...LIGHT_PRESETS[0].settings };

/** Dirección unitaria desde el objetivo hacia la luz, con la misma convención que la cámara. */
export function lightDirection(azimuthDeg: number, elevationDeg: number): [number, number, number] {
  const az = (azimuthDeg * Math.PI) / 180;
  const el = (elevationDeg * Math.PI) / 180;
  return [Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)];
}

/**
 * Azimut de la luz de relleno: del lado opuesto a la principal,
 * siempre en el hemisferio frontal (para aclarar la cara, no la nuca).
 */
export function fillAzimuth(keyAzimuth: number) {
  const a = wrapDegrees(keyAzimuth);
  return -Math.max(-90, Math.min(90, a)) * 0.8;
}

export function wrapDegrees(a: number) {
  return ((((a + 180) % 360) + 360) % 360) - 180;
}
