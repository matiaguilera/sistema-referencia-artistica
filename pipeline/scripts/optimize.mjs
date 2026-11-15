// Comprime los GLB exportados por assemble.py (Meshopt + cuantización) y los copia a public/models/<id>/.
// Uso: node pipeline/scripts/optimize.mjs pipeline/build/male public/models/male
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, weld } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import fs from 'node:fs/promises';
import path from 'node:path';

const [inDir, outDir] = process.argv.slice(2);
if (!inDir || !outDir) {
  console.error('Uso: node optimize.mjs <carpeta-de-entrada> <carpeta-de-salida>');
  process.exit(1);
}

await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
await fs.mkdir(outDir, { recursive: true });

for (const layer of ['skin', 'muscle', 'skull']) {
  const src = path.join(inDir, `${layer}.glb`);
  try {
    await fs.access(src);
  } catch {
    continue;
  }
  const doc = await io.read(src);
  // Sin UV ni texturas: solo posición y normal.
  for (const mesh of doc.getRoot().listMeshes())
    for (const prim of mesh.listPrimitives())
      for (const sem of prim.listSemantics()) if (!['POSITION', 'NORMAL'].includes(sem)) prim.setAttribute(sem, null);
  await doc.transform(weld(), dedup(), prune(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  const dst = path.join(outDir, `${layer}.glb`);
  await io.write(dst, doc);
  const [a, b] = await Promise.all([fs.stat(src), fs.stat(dst)]);
  console.log(`${layer}: ${(a.size / 1e6).toFixed(1)} MB → ${(b.size / 1e6).toFixed(2)} MB  (${dst})`);
}
