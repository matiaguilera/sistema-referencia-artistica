import { useGLTF } from '@react-three/drei';
import { useEffect, useMemo } from 'react';
import { animateDepth, availableLayers, stopDepthAnimation } from '../scene/layers';
import { useAppStore, useCurrentModel } from '../state/store';

export function LayerControls() {
  const entry = useCurrentModel();
  const depth = useAppStore((s) => s.depth);
  const setDepth = useAppStore((s) => s.setDepth);
  const skinTone = useAppStore((s) => s.skinTone);
  const setSkinTone = useAppStore((s) => s.setSkinTone);
  const layers = useMemo(() => (entry ? availableLayers(entry) : []), [entry]);
  const max = Math.max(0, layers.length - 1);

  // Si el modelo nuevo tiene menos capas, ajusta la profundidad.
  useEffect(() => {
    if (depth > max) setDepth(max);
  }, [depth, max, setDepth]);

  /** Precarga las capas interiores cuando el usuario se acerca a los controles. */
  const prefetch = () => layers.slice(1).forEach((l) => useGLTF.preload(l.url, false, true));

  if (!entry) return null;

  return (
    <div className="layer-controls" onPointerEnter={prefetch} onFocus={prefetch}>
      <div className="segmented" role="radiogroup" aria-label="Capa" style={{ gridTemplateColumns: `repeat(${layers.length}, 1fr)` }}>
        {layers.map((l, i) => {
          const active = Math.abs(depth - i) < 0.02;
          return (
            <button
              key={l.id}
              role="radio"
              aria-checked={active}
              className={active ? 'is-active' : ''}
              onClick={() => animateDepth(i)}
              title={`${l.label} (tecla ${l.label[0]})`}
            >
              {l.label}
            </button>
          );
        })}
      </div>

      {layers.length > 1 && (
        <label className="slider">
          <span className="slider-label">Profundidad</span>
          <input
            type="range"
            min={0}
            max={max}
            step={0.01}
            value={depth}
            onPointerDown={stopDepthAnimation}
            onChange={(e) => {
              stopDepthAnimation();
              setDepth(Number(e.target.value));
            }}
            aria-valuetext={describeDepth(depth, layers.map((l) => l.label))}
          />
          <span className="slider-ticks" aria-hidden="true">
            {layers.map((l) => (
              <span key={l.id}>{l.label}</span>
            ))}
          </span>
        </label>
      )}

      <div className="row">
        <span className="row-label">Superficie</span>
        <div className="segmented compact" role="radiogroup" aria-label="Material de la piel">
          <button role="radio" aria-checked={skinTone === 'clay'} className={skinTone === 'clay' ? 'is-active' : ''} onClick={() => setSkinTone('clay')}>
            Arcilla
          </button>
          <button role="radio" aria-checked={skinTone === 'skin'} className={skinTone === 'skin' ? 'is-active' : ''} onClick={() => setSkinTone('skin')}>
            Tono piel
          </button>
        </div>
      </div>
    </div>
  );
}

function describeDepth(d: number, labels: string[]) {
  const i = Math.floor(d);
  const t = d - i;
  if (t < 0.02 || i >= labels.length - 1) return labels[Math.round(d)] ?? '';
  return `${labels[i]} → ${labels[i + 1]} (${Math.round(t * 100)} %)`;
}
