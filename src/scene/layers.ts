import { useAppStore } from '../state/store';
import type { LayerId, ModelEntry } from '../registry/types';

export interface LayerInfo {
  id: LayerId;
  label: string;
  url: string;
}

const ORDER: { id: LayerId; label: string }[] = [
  { id: 'skin', label: 'Piel' },
  { id: 'muscle', label: 'Músculo' },
  { id: 'skull', label: 'Cráneo' },
];

/** Capas que tiene el modelo, de afuera hacia adentro. Su índice es su "profundidad". */
export function availableLayers(entry: ModelEntry): LayerInfo[] {
  return ORDER.flatMap(({ id, label }) => {
    const url = entry.layers[id];
    return url ? [{ id, label, url }] : [];
  });
}

/**
 * Opacidad de la capa i para una profundidad d.
 * Entre i e i+1 la capa i se desvanece y deja ver la siguiente.
 */
export function layerOpacity(index: number, depth: number) {
  return 1 - Math.min(1, Math.max(0, depth - index));
}

/**
 * Las capas interiores solo se dibujan cuando la de afuera deja de estar opaca.
 * El cráneo también se ve en la vista muscular, entre los músculos.
 */
export function layerVisible(index: number, depth: number) {
  if (layerOpacity(index, depth) <= 0.001) return false;
  return index === 0 || depth > 0.001;
}

// ------------------------------------------------ animación de la profundidad
let raf = 0;

export function stopDepthAnimation() {
  cancelAnimationFrame(raf);
}

/** Transición suave hacia una capa (los botones Piel / Músculo / Cráneo). */
export function animateDepth(target: number, duration = 450) {
  stopDepthAnimation();
  const { depth: from, setDepth } = useAppStore.getState();
  if (Math.abs(from - target) < 1e-3) return setDepth(target);
  const t0 = performance.now();
  const step = (now: number) => {
    const t = Math.min(1, (now - t0) / duration);
    const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
    setDepth(from + (target - from) * e);
    if (t < 1) raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
}
