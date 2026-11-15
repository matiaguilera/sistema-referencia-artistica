import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { layerOpacity, layerVisible } from './layers';

export interface LabelEntry {
  es: string;
  la?: string;
}
export type LabelDict = Record<string, LabelEntry>;

// ------------------------------------------------------------ diccionario
const cache = new Map<string, Promise<LabelDict>>();

function loadDict(url: string) {
  let p = cache.get(url);
  if (!p) {
    p = fetch(url)
      .then((r) => (r.ok ? r.json() : {}))
      .then((json: Record<string, unknown>) => {
        const dict: LabelDict = {};
        for (const [k, v] of Object.entries(json)) {
          if (k.startsWith('_') || !v || typeof v !== 'object') continue;
          const e = v as Partial<LabelEntry>;
          if (typeof e.es === 'string') dict[k] = { es: e.es, la: typeof e.la === 'string' ? e.la : undefined };
        }
        return dict;
      })
      .catch(() => ({}));
    cache.set(url, p);
  }
  return p;
}

/** Diccionario id → nombres (es / latín) del modelo actual. */
export function useLabelDict(url?: string) {
  const [dict, setDict] = useState<LabelDict>({});
  useEffect(() => {
    if (!url) return setDict({});
    let alive = true;
    void loadDict(url).then((d) => alive && setDict(d));
    return () => {
      alive = false;
    };
  }, [url]);
  return dict;
}

// ------------------------------------------------------------ nombres
/** "masseter_L" → { base: "masseter", side: "L" }. */
export function splitSide(name: string): { base: string; side: 'L' | 'R' | null } {
  const m = /^(.*?)[_.-]([LR])$/i.exec(name);
  if (!m) return { base: name, side: null };
  return { base: m[1], side: m[2].toUpperCase() as 'L' | 'R' };
}

export interface PartText {
  es: string;
  la?: string;
  /** "izq." / "der." (lado del modelo). */
  side?: string;
}

export function describePart(name: string, dict: LabelDict): PartText {
  const { base, side } = splitSide(name);
  const entry = dict[base] ?? dict[name];
  const es = entry?.es ?? prettify(base);
  return { es, la: entry?.la, side: side === 'L' ? 'izq.' : side === 'R' ? 'der.' : undefined };
}

function prettify(id: string) {
  const s = id.replace(/[_.-]+/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ------------------------------------------------------------ interacción
/**
 * Una capa interior responde al cursor cuando la piel ya está casi transparente
 * y la propia capa todavía se ve lo suficiente.
 */
export function isLayerInteractive(index: number, depth: number) {
  return index > 0 && depth >= 0.5 && layerVisible(index, depth) && layerOpacity(index, depth) >= 0.5;
}

/** Registro de meshes por nombre (para seleccionar desde la lista del panel). */
export const partMeshes = new Map<string, { mesh: THREE.Mesh; layer: number }>();

/** Punto para anclar la etiqueta de una estructura elegida desde la lista. */
export function partAnchor(name: string): [number, number, number] | null {
  const entry = partMeshes.get(name);
  if (!entry) return null;
  const box = new THREE.Box3().setFromObject(entry.mesh);
  const c = box.getCenter(new THREE.Vector3());
  return [c.x, c.y, c.z];
}
