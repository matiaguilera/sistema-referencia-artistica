import { Html, useGLTF } from '@react-three/drei';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { ModelEntry } from '../registry/types';
import { useAppStore } from '../state/store';

type LandmarkKey = keyof NonNullable<ModelEntry['landmarks']>;

const GUIDES: { key: LandmarkKey; label: string }[] = [
  { key: 'top', label: 'Vértice' },
  { key: 'browLine', label: 'Cejas' },
  { key: 'eyeLine', label: 'Ojos' },
  { key: 'noseBase', label: 'Base de la nariz' },
  { key: 'mouthLine', label: 'Boca' },
  { key: 'chin', label: 'Mentón' },
];

const OFFSET = 0.0009; // separa la línea de la superficie para que no parpadee

/**
 * Corta la superficie de la piel con un plano y devuelve los segmentos de la intersección
 * (una curva que "envuelve" la cabeza, como las líneas de construcción del dibujo).
 */
function sliceSkin(meshes: THREE.Mesh[], plane: THREE.Plane): number[] {
  const out: number[] = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const n = new THREE.Vector3();
  const tri = [a, b, c];
  const d = [0, 0, 0];
  const hit: THREE.Vector3[] = [];

  for (const mesh of meshes) {
    const geo = mesh.geometry;
    const pos = geo.getAttribute('position');
    const index = geo.getIndex();
    const count = index ? index.count : pos.count;
    const m = mesh.matrixWorld;
    for (let i = 0; i < count; i += 3) {
      for (let k = 0; k < 3; k++) {
        const vi = index ? index.getX(i + k) : i + k;
        tri[k].fromBufferAttribute(pos, vi).applyMatrix4(m);
        d[k] = plane.distanceToPoint(tri[k]);
      }
      if ((d[0] > 0 && d[1] > 0 && d[2] > 0) || (d[0] < 0 && d[1] < 0 && d[2] < 0)) continue;
      hit.length = 0;
      for (let k = 0; k < 3; k++) {
        const k2 = (k + 1) % 3;
        if ((d[k] <= 0 && d[k2] > 0) || (d[k] > 0 && d[k2] <= 0)) {
          const t = d[k] / (d[k] - d[k2]);
          hit.push(tri[k].clone().lerp(tri[k2], t));
        }
      }
      if (hit.length !== 2) continue;
      n.subVectors(b, a).cross(c.clone().sub(a)).normalize();
      for (const p of hit) {
        p.addScaledVector(n, OFFSET);
        out.push(p.x, p.y, p.z);
      }
    }
  }
  return out;
}

function makeLines(points: number[], color: string, opacity: number) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity, toneMapped: false });
  const lines = new THREE.LineSegments(geo, mat);
  lines.raycast = () => {};
  lines.renderOrder = 20;
  return lines;
}

/** Punto de la curva más a la izquierda del modelo (+X), para anclar el nombre de la guía. */
function labelAnchor(points: number[]): [number, number, number] | null {
  let best = -1;
  for (let i = 0; i < points.length; i += 3) if (best < 0 || points[i] > points[best]) best = i;
  return best < 0 ? null : [points[best] + 0.006, points[best + 1], points[best + 2]];
}

/**
 * Guías de proporción: curvas de nivel sobre la piel a la altura de las referencias del modelo
 * (models.json → landmarks) y la línea media.
 */
export function ProportionGuides({ entry }: { entry: ModelEntry }) {
  const showGuides = useAppStore((s) => s.showGuides);
  const showMidline = useAppStore((s) => s.showMidline);
  const gltf = useGLTF(entry.layers.skin, false, true);

  const { guides, midline } = useMemo(() => {
    const root = gltf.scene;
    root.updateMatrixWorld(true);
    const meshes: THREE.Mesh[] = [];
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      // Solo la piel (los ojos son esferas aparte).
      if (m.isMesh && !/^eye/i.test(m.name)) meshes.push(m);
    });
    const marks = entry.landmarks ?? {};
    const guides = GUIDES.flatMap(({ key, label }) => {
      const y = marks[key];
      if (y === undefined) return [];
      // El vértice es un punto: se dibuja la curva unos milímetros por debajo.
      const h = key === 'top' ? y - 0.004 : key === 'chin' ? y + 0.003 : y;
      const pts = sliceSkin(meshes, new THREE.Plane(new THREE.Vector3(0, 1, 0), -h));
      if (pts.length === 0) return [];
      return [{ key, label, lines: makeLines(pts, '#ffcf7a', 0.95), anchor: labelAnchor(pts) }];
    });
    const midPts = sliceSkin(meshes, new THREE.Plane(new THREE.Vector3(1, 0, 0), 0));
    return { guides, midline: makeLines(midPts, '#7ad0ff', 0.8) };
  }, [gltf, entry.landmarks]);

  useEffect(
    () => () => {
      for (const g of [...guides.map((x) => x.lines), midline]) {
        g.geometry.dispose();
        (g.material as THREE.Material).dispose();
      }
    },
    [guides, midline],
  );

  if (!showGuides) return null;
  return (
    <group>
      {guides.map((g) => (
        <group key={g.key}>
          <primitive object={g.lines} />
          {g.anchor && (
            <Html position={g.anchor} zIndexRange={[15, 0]} style={{ pointerEvents: 'none' }}>
              <span className="guide-label">{g.label}</span>
            </Html>
          )}
        </group>
      ))}
      {showMidline && <primitive object={midline} />}
    </group>
  );
}
