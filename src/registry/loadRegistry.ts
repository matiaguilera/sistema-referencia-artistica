import type { ModelEntry, Registry } from './types';

const REGISTRY_PATH = 'models/models.json';

/**
 * Lee el registro de modelos y convierte las rutas relativas en URLs absolutas.
 * Agregar un modelo = agregar una entrada a models.json (no hace falta tocar el código).
 */
export async function loadRegistry(): Promise<Registry> {
  const registryUrl = new URL(REGISTRY_PATH, document.baseURI);
  const res = await fetch(registryUrl);
  if (!res.ok) throw new Error(`No se pudo leer ${REGISTRY_PATH} (HTTP ${res.status})`);
  const raw = (await res.json()) as Registry;

  if (!raw || !Array.isArray(raw.models)) throw new Error(`${REGISTRY_PATH}: falta el arreglo "models"`);

  const seen = new Set<string>();
  const models: ModelEntry[] = [];
  for (const [i, m] of raw.models.entries()) {
    const where = `${REGISTRY_PATH} → models[${i}]`;
    if (!m?.id || !m?.name) {
      console.warn(`${where}: falta "id" o "name"; se omite`);
      continue;
    }
    if (seen.has(m.id)) {
      console.warn(`${where}: id repetido "${m.id}"; se omite`);
      continue;
    }
    if (!m.layers?.skin) {
      console.warn(`${where}: falta layers.skin; se omite`);
      continue;
    }
    seen.add(m.id);
    const resolve = (p?: string) => (p ? new URL(p, registryUrl).href : undefined);
    models.push({
      ...m,
      layers: {
        skin: resolve(m.layers.skin)!,
        muscle: resolve(m.layers.muscle),
        skull: resolve(m.layers.skull),
      },
      labels: resolve(m.labels),
    });
  }
  if (models.length === 0) throw new Error(`${REGISTRY_PATH} no tiene ningún modelo válido`);
  return { ...raw, models };
}
