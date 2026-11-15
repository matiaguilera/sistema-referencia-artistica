import { Suspense, useEffect, useMemo, useState } from 'react';
import type { LayerId, ModelEntry } from '../registry/types';
import { useAppStore } from '../state/store';
import { Layer } from './Layer';
import { availableLayers } from './layers';
import { applySkinTone, createBoneMaterial, createClayMaterial, createMuscleMaterial } from './materials';

/**
 * Las capas del modelo, alineadas en el mismo espacio de coordenadas.
 * Carga perezosa: la piel se carga al abrir el modelo; músculo y cráneo,
 * la primera vez que el usuario se mete por debajo de la piel (o al acercarse a los controles).
 */
export function HeadModel({ entry }: { entry: ModelEntry }) {
  const layers = useMemo(() => availableLayers(entry), [entry]);
  const skinTone = useAppStore((s) => s.skinTone);

  const materials = useMemo<Record<LayerId, ReturnType<typeof createClayMaterial>>>(
    () => ({ skin: createClayMaterial(), muscle: createMuscleMaterial(), skull: createBoneMaterial() }),
    [],
  );
  useEffect(() => () => Object.values(materials).forEach((m) => m.dispose()), [materials]);
  useEffect(() => applySkinTone(materials.skin, skinTone), [materials, skinTone]);

  const [deepNeeded, setDeepNeeded] = useState(() => useAppStore.getState().depth > 0);
  useEffect(() => {
    if (deepNeeded) return;
    return useAppStore.subscribe((s) => {
      if (s.depth > 0) setDeepNeeded(true);
    });
  }, [deepNeeded]);

  return (
    <>
      {layers.map((l, i) =>
        i === 0 || deepNeeded ? (
          // Cada capa en su propio Suspense: la piel sigue visible mientras carga el resto.
          <Suspense key={l.id} fallback={null}>
            <Layer url={l.url} material={materials[l.id]} index={i} />
          </Suspense>
        ) : null,
      )}
    </>
  );
}
