// Genera modelos PROVISIONALES (piel, músculos y cráneo) como GLB comprimidos con
// Meshopt, siguiendo las mismas convenciones que los modelos reales:
//   - unidades en metros, Y hacia arriba, la cara mira hacia +Z
//   - el lado izquierdo DEL MODELO está en +X
//   - un nodo/mesh por estructura, con id estable (p. ej. "masseter_L")
//   - las tres capas comparten el mismo espacio de coordenadas
//
// Uso: npm run placeholders
// Son formas geométricas simples: solo sirven para que la interfaz funcione
// mientras se procesan los modelos reales (ver pipeline/).

import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import fs from 'node:fs/promises';
import path from 'node:path';

const OUT_DIR = path.resolve('public/models');

// ---------------------------------------------------------------- utilidades
const clamp01 = (x) => Math.min(1, Math.max(0, x));
/** smoothstep que también acepta e0 > e1 (rampa descendente). */
const smooth = (e0, e1, x) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
const gauss = (d2, s) => Math.exp(-d2 / s);
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

const PARAMS = {
  male: { a: 0.076, b: 0.115, c: 0.097, jaw: 0.3, nose: 0.022, brow: 0.006, chin: 0.008, cheek: 0.006, neckR: 0.056 },
  female: { a: 0.071, b: 0.108, c: 0.092, jaw: 0.36, nose: 0.017, brow: 0.002, chin: 0.005, cheek: 0.005, neckR: 0.047 },
};

/**
 * Punto de la superficie de la cabeza provisional en la dirección unitaria d.
 * kind: 'skin' (con nariz y labios) | 'skull' (órbitas más hondas, sin cartílago).
 */
function headPoint(d, P, kind = 'skin') {
  const { x: dx, y: dy, z: dz } = d;
  let x = P.a * dx;
  let y = P.b * dy;
  let z = P.c * dz;

  // Mandíbula más estrecha que el cráneo y nuca que se retira hacia el cuello.
  const low = smooth(0.1, -0.9, dy);
  x *= 1 - P.jaw * low;
  if (dz < 0) z *= 1 - 0.45 * low;
  else z *= 1 + 0.14 * low * smooth(0.3, 0.8, dz); // adelanta mandíbula y mentón

  const front = smooth(0.2, 0.7, dz);
  const side = Math.abs(dx);
  let bump = 0;

  // Arco superciliar
  bump += P.brow * gauss((dy - 0.13) ** 2, 0.004) * gauss(dx * dx, 0.12) * front;
  // Órbitas
  bump -= (kind === 'skull' ? 0.022 : 0.008) * gauss((side - 0.33) ** 2, 0.012) * gauss((dy - 0.02) ** 2, 0.006) * front;
  // Pómulos
  bump += P.cheek * gauss((side - 0.55) ** 2, 0.02) * gauss((dy + 0.12) ** 2, 0.01) * smooth(0, 0.5, dz);
  // Mentón
  bump += P.chin * gauss(dx * dx, 0.03) * gauss((dy + 0.88) ** 2, 0.01) * front;

  if (kind === 'skin') {
    // Nariz: de la raíz (dy≈0.05) a la base (dy≈-0.44), más ancha y prominente abajo.
    const down = smooth(0.05, -0.4, dy);
    const span = smooth(0.12, 0.02, dy) * smooth(-0.5, -0.4, dy);
    bump += P.nose * (0.25 + 0.75 * down) * span * gauss(dx * dx, 0.003 + 0.012 * down) * front;
    // Labios
    bump += 0.004 * gauss(dx * dx, 0.03) * gauss((dy + 0.6) ** 2, 0.002) * front;
    bump += 0.003 * gauss(dx * dx, 0.025) * gauss((dy + 0.67) ** 2, 0.002) * front;
  }

  const p = v3(x, y, z);
  p.addScaledVector(d, bump);
  if (kind === 'skull') p.multiplyScalar(0.93); // ~grosor de tejido blando
  return p;
}

/** Punto sobre la piel, hundido un poco hacia el centro (para los músculos). */
const hp = (P, dx, dy, dz, inset = 0.975) => headPoint(v3(dx, dy, dz).normalize(), P).multiplyScalar(inset);

function finalize(geo) {
  geo.deleteAttribute('uv');
  geo.deleteAttribute('normal');
  const merged = mergeVertices(geo, 1e-6);
  merged.computeVertexNormals();
  return merged;
}

/** Esfera deformada; keepTri(dirA, dirB, dirC) permite recortar triángulos. */
function deformedSphere(P, kind, keepTri) {
  const sphere = new THREE.SphereGeometry(1, 180, 130);
  const pos = sphere.getAttribute('position');
  const dirs = [];
  const d = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    d.fromBufferAttribute(pos, i).normalize();
    dirs.push(d.clone());
    const p = headPoint(d, P, kind);
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  if (keepTri) {
    const idx = sphere.index.array;
    const kept = [];
    for (let i = 0; i < idx.length; i += 3) {
      if (keepTri(dirs[idx[i]], dirs[idx[i + 1]], dirs[idx[i + 2]])) kept.push(idx[i], idx[i + 1], idx[i + 2]);
    }
    sphere.setIndex(kept);
  }
  return finalize(sphere);
}

/** Matriz que orienta: Y local → 'along', Z local → 'out' (ortogonalizado). */
function basis(along, out, center) {
  const Y = along.clone().normalize();
  const Z = out.clone().addScaledVector(Y, -out.dot(Y)).normalize();
  const X = new THREE.Vector3().crossVectors(Y, Z).normalize();
  return new THREE.Matrix4().makeBasis(X, Y, Z).setPosition(center);
}

/** Banda muscular (cápsula aplanada) entre los puntos A y B. */
function band(A, B, width, flat = 0.45) {
  const len = A.distanceTo(B);
  const g = new THREE.CapsuleGeometry(width, Math.max(1e-4, len - width), 6, 16);
  g.scale(1, 1, flat);
  const mid = A.clone().add(B).multiplyScalar(0.5);
  g.applyMatrix4(basis(B.clone().sub(A), mid.clone(), mid));
  return finalize(g);
}


/**
 * Lámina muscular curva que sigue la superficie de la cabeza (frontal, temporal…).
 * Coordenadas esféricas de three.js: phi = π/2 es el frente (+Z), phi = π es el lado izquierdo (+X);
 * theta = 0 arriba, π abajo. Es una cáscara con grosor (cara exterior + interior).
 */
function patch(P, phiC, phiHalf, thC, thHalf, outer = 0.99, inner = 0.955) {
  const make = (inset, flip) => {
    const g = new THREE.SphereGeometry(1, 28, 20, phiC - phiHalf, 2 * phiHalf, thC - thHalf, 2 * thHalf);
    const pos = g.getAttribute('position');
    const d = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      d.fromBufferAttribute(pos, i).normalize();
      // Bordes más delgados: la lámina se afina hacia el contorno.
      const u = (Math.atan2(d.z, -d.x) - phiC + Math.PI * 3) % (Math.PI * 2) - Math.PI;
      const v = Math.acos(THREE.MathUtils.clamp(d.y, -1, 1)) - thC;
      const edge = 1 - Math.min(1, Math.hypot(u / phiHalf, v / thHalf));
      // (grosor mínimo del 35 % para que las dos caras no coincidan en el borde)
      const k = flip ? outer - (outer - inner) * (0.35 + 0.65 * Math.sqrt(Math.max(0, edge))) : outer;
      const p = headPoint(d, P).multiplyScalar(k);
      pos.setXYZ(i, p.x, p.y, p.z);
    }
    if (flip) {
      const idx = g.index.array;
      for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
    }
    g.deleteAttribute('uv');
    g.deleteAttribute('normal');
    return g;
  };
  return finalize(mergeGeometries([make(outer, false), make(inner, true)]));
}

/** Anillo (músculos orbiculares). */
function ring(c, r, tube, sx = 1) {
  const g = new THREE.TorusGeometry(r, tube, 12, 40);
  g.scale(sx, 1, 0.5);
  const out = c.clone().normalize();
  g.applyMatrix4(basis(v3(0, 1, 0), out, c));
  return finalize(g);
}

/** Tubo a lo largo de una curva (mandíbula). */
function tube(points, radius) {
  const curve = new THREE.CatmullRomCurve3(points);
  const g = new THREE.TubeGeometry(curve, 80, radius, 14, false);
  return finalize(g);
}

const mirror = (p) => v3(-p.x, p.y, p.z);

// ------------------------------------------------------------------ capas
function buildSkin(P) {
  const head = deformedSphere(P, 'skin');
  // Cuello: cilindro elíptico inclinado hacia delante; el extremo superior queda dentro del cráneo.
  const neck = new THREE.CylinderGeometry(P.neckR * 0.95, P.neckR * 1.1, 0.21, 64, 1, false);
  neck.scale(1, 1, 0.92);
  neck.rotateX(-0.2);
  neck.translate(0, -0.13, -0.004);
  const ears = [1, -1].map((s) => {
    const e = new THREE.SphereGeometry(1, 24, 16);
    e.scale(0.006, 0.03, 0.017);
    e.rotateX(-0.2);
    e.translate(s * P.a * 0.98, -0.005, -0.012);
    return e;
  });
  const parts = [head, finalize(neck), ...ears.map(finalize)];
  return [{ name: 'skin', geometry: finalize(mergeGeometries(parts)) }];
}

function buildSkull(P) {
  const cranium = deformedSphere(P, 'skull', (...ds) =>
    ds.every((d) => {
      const vault = d.y > -0.3;
      const maxilla = d.z > 0.55 && d.y > -0.62 && Math.abs(d.x) < 0.5;
      const nasalAperture = d.z > 0.8 && Math.abs(d.x) < 0.09 && d.y < -0.15 && d.y > -0.45;
      return (vault || maxilla) && !nasalAperture;
    }),
  );
  const s = 0.9;
  const condyle = hp(P, 0.95, -0.08, 0.05, s);
  const gonion = hp(P, 0.72, -0.66, 0.0, s);
  const body = hp(P, 0.42, -0.82, 0.42, 0.92);
  const chin = hp(P, 0, -0.9, 0.44, 0.93);
  const mandible = tube([condyle, gonion, body, chin, mirror(body), mirror(gonion), mirror(condyle)], 0.0065);

  const vertebrae = [];
  for (let i = 0; i < 7; i++) {
    const v = new THREE.CylinderGeometry(0.013, 0.013, 0.014, 20);
    v.translate(0, -0.075 - i * 0.02, -0.03);
    vertebrae.push(v);
  }
  return [
    { name: 'cranium', geometry: cranium },
    { name: 'mandible', geometry: mandible },
    { name: 'cervical_vertebrae', geometry: finalize(mergeGeometries(vertebrae)) },
  ];
}

function buildMuscles(P) {
  const list = [];
  const both = (id, make) => {
    list.push({ name: `${id}_L`, geometry: make(1) });
    list.push({ name: `${id}_R`, geometry: make(-1) });
  };

  const PI = Math.PI;
  list.push({ name: 'frontalis', geometry: patch(P, PI / 2, 0.75, 0.95, 0.42) });
  list.push({ name: 'occipitalis', geometry: patch(P, (3 * PI) / 2, 0.55, 1.15, 0.25) });
  list.push({ name: 'procerus', geometry: band(hp(P, 0, 0.16, 0.98), hp(P, 0, 0.04, 1), 0.004) });
  list.push({ name: 'orbicularis_oris', geometry: ring(hp(P, 0, -0.63, 0.78), 0.016, 0.0055, 1.35) });
  list.push({ name: 'mentalis', geometry: patch(P, PI / 2, 0.16, 2.55, 0.12, 0.99, 0.96) });

  // phi del lado izquierdo (+X) = π − φ, del derecho = φ.
  const side = (s, phiFromFront) => (s > 0 ? PI - phiFromFront : phiFromFront);
  both('temporalis', (s) => patch(P, side(s, 0.3), 0.42, 1.12, 0.42, 0.995, 0.955));
  both('orbicularis_oculi', (s) => ring(hp(P, s * 0.33, 0.02, 0.94), 0.017, 0.005));
  both('zygomaticus_major', (s) => band(hp(P, s * 0.7, -0.12, 0.7), hp(P, s * 0.22, -0.6, 0.78), 0.005));
  both('zygomaticus_minor', (s) => band(hp(P, s * 0.5, -0.15, 0.85), hp(P, s * 0.14, -0.54, 0.86), 0.0038));
  both('levator_labii_superioris', (s) => band(hp(P, s * 0.3, -0.12, 0.95), hp(P, s * 0.1, -0.52, 0.92), 0.0045));
  both('masseter', (s) => band(hp(P, s * 0.86, -0.22, 0.35), hp(P, s * 0.72, -0.7, 0.18), 0.013, 0.4));
  both('buccinator', (s) => patch(P, side(s, 0.95), 0.22, 2.08, 0.16, 0.96, 0.93));
  both('depressor_anguli_oris', (s) => band(hp(P, s * 0.24, -0.66, 0.74), hp(P, s * 0.28, -0.9, 0.42), 0.005));
  both('sternocleidomastoid', (s) => {
    const mastoid = hp(P, s * 0.8, -0.3, -0.35);
    const sternum = v3(s * 0.012, -0.225, P.neckR - 0.02);
    return band(mastoid, sternum, 0.011, 0.5);
  });
  return list;
}

// ------------------------------------------------------------------ export
async function writeGLB(file, meshes, materialName, color) {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const material = doc.createMaterial(materialName).setBaseColorFactor([...color, 1]).setRoughnessFactor(0.85);
  const scene = doc.createScene('Scene');
  for (const { name, geometry } of meshes) {
    const pos = geometry.getAttribute('position');
    const nor = geometry.getAttribute('normal');
    const prim = doc
      .createPrimitive()
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(pos.array)).setBuffer(buffer))
      .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(new Float32Array(nor.array)).setBuffer(buffer))
      .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(geometry.index.array)).setBuffer(buffer))
      .setMaterial(material);
    const mesh = doc.createMesh(name).addPrimitive(prim);
    scene.addChild(doc.createNode(name).setMesh(mesh));
  }
  await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
  await fs.mkdir(path.dirname(file), { recursive: true });
  await io.write(file, doc);
  const { size } = await fs.stat(file);
  console.log(`  ${path.relative(process.cwd(), file)}  (${meshes.length} mesh, ${(size / 1024).toFixed(0)} KB)`);
}

/** Alturas (Y) de referencias de proporción en la línea media de la cara. */
function landmarks(P) {
  const at = (dy) => +headPoint(v3(0, dy, Math.sqrt(1 - dy * dy)), P).y.toFixed(4);
  return { top: +P.b.toFixed(4), browLine: at(0.13), eyeLine: at(0.02), noseBase: at(-0.44), mouthLine: at(-0.635), chin: at(-1) };
}

await MeshoptEncoder.ready;
for (const sex of ['male', 'female']) {
  const P = PARAMS[sex];
  const dir = path.join(OUT_DIR, `placeholder-${sex}`);
  console.log(`placeholder-${sex}`);
  await writeGLB(path.join(dir, 'skin.glb'), buildSkin(P), 'skin', [0.85, 0.83, 0.8]);
  await writeGLB(path.join(dir, 'muscle.glb'), buildMuscles(P), 'muscle', [0.65, 0.3, 0.27]);
  await writeGLB(path.join(dir, 'skull.glb'), buildSkull(P), 'bone', [0.9, 0.87, 0.8]);
  console.log('  landmarks:', JSON.stringify(landmarks(P)));
}
