// Agrega o actualiza una entrada de public/models/models.json con el encuadre y las líneas
// de proporción que calculó assemble.py (meta.json).
// Uso: node pipeline/scripts/register_model.mjs <id> <meta.json> "<nombre>" <male|female> [--default]
import fs from 'node:fs/promises';

const [id, metaPath, name, sex, flag] = process.argv.slice(2);
if (!id || !metaPath || !name) {
  console.error('Uso: node register_model.mjs <id> <meta.json> "<nombre>" <male|female> [--default]');
  process.exit(1);
}
const REGISTRY = 'public/models/models.json';
const registry = JSON.parse(await fs.readFile(REGISTRY, 'utf8'));
const meta = JSON.parse(await fs.readFile(metaPath, 'utf8'));

const entry = {
  id,
  name,
  description:
    sex === 'female'
      ? 'Piel: MPFB2 (CC0). Músculos y cráneo: Z-Anatomy (CC BY-SA 4.0), adaptados de la anatomía masculina a esta cabeza.'
      : 'Piel: MPFB2 (CC0). Músculos y cráneo: Z-Anatomy (CC BY-SA 4.0), ajustados a esta cabeza.',
  sex,
  age: 25,
  layers: { skin: `${id}/skin.glb`, muscle: `${id}/muscle.glb`, skull: `${id}/skull.glb` },
  labels: 'labels/anatomy.es.json',
  frame: meta.frame,
  landmarks: meta.landmarks,
  credits: ['Piel: MakeHuman / MPFB2 (CC0)', 'Anatomía: Z-Anatomy, a partir de BodyParts3D © DBCLS (CC BY-SA 4.0)'],
};

const i = registry.models.findIndex((m) => m.id === id);
if (i >= 0) registry.models[i] = entry;
else registry.models.push(entry);
if (flag === '--default') registry.defaultModel = id;
await fs.writeFile(REGISTRY, JSON.stringify(registry, null, 2) + '\n');
console.log(`${i >= 0 ? 'Actualizado' : 'Agregado'} "${id}" en ${REGISTRY}`);
