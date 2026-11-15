import { useAppStore } from '../state/store';
import { LIGHT_PRESETS, wrapDegrees, type LightPresetId, type LightSettings } from './lightPresets';

let raf = 0;

export function stopLightAnimation() {
  cancelAnimationFrame(raf);
}

/** Aplica un preset de luz con una transición suave (el azimut toma el camino más corto). */
export function applyLightPreset(id: LightPresetId, duration = 500) {
  const preset = LIGHT_PRESETS.find((p) => p.id === id);
  if (!preset) return;
  stopLightAnimation();
  const from = useAppStore.getState().light;
  const to = preset.settings;
  const dAz = wrapDegrees(to.azimuth - from.azimuth);
  const t0 = performance.now();
  useAppStore.setState({ lightPreset: id });

  const step = (now: number) => {
    const t = Math.min(1, (now - t0) / duration);
    const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
    const lerp = (a: number, b: number) => a + (b - a) * e;
    const light: LightSettings = {
      azimuth: wrapDegrees(from.azimuth + dAz * e),
      elevation: lerp(from.elevation, to.elevation),
      intensity: lerp(from.intensity, to.intensity),
      // El relleno se apaga al final de la transición y se enciende al principio.
      fillEnabled: to.fillEnabled || (from.fillEnabled && t < 1),
      fillIntensity: to.fillEnabled
        ? lerp(from.fillEnabled ? from.fillIntensity : 0, to.fillIntensity)
        : lerp(from.fillIntensity, 0),
      ambient: lerp(from.ambient, to.ambient),
    };
    if (t === 1) light.fillIntensity = to.fillIntensity;
    useAppStore.setState({ light });
    if (t < 1) raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
}

/** Ajuste manual (sliders, Shift+arrastrar): cancela cualquier transición en curso. */
export function setLightManual(patch: Partial<LightSettings>) {
  stopLightAnimation();
  useAppStore.getState().setLight(patch);
}
