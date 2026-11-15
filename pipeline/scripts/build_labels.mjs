// Genera public/models/labels/anatomy.es.json (id → nombre en español y latín) a partir de
// config/parts.json y la Terminologia Anatomica de Z-Anatomy (sources/TA2.csv, CC BY-SA 4.0).
// Uso: node pipeline/scripts/build_labels.mjs
import fs from 'node:fs/promises';

const parts = JSON.parse(await fs.readFile('pipeline/config/parts.json', 'utf8'));
const csv = (await fs.readFile('pipeline/sources/TA2.csv', 'utf8')).replace(/^﻿/, '');

// TA2.csv: cada línea es "TA2ID;English;Latin;Français;Español;…" entre comillas.
const byEnglish = new Map();
for (const line of csv.split(/\r?\n/)) {
  const cols = line.replace(/^"|"$/g, '').split(';');
  if (cols.length < 5 || cols[0] === 'TA2ID') continue;
  const [, en, la, , es] = cols;
  if (en && !byEnglish.has(en.toLowerCase())) byEnglish.set(en.toLowerCase(), { la, es });
}

// Término TA (inglés) por id base. Si falta, se usa el primer objeto de Z-Anatomy sin el sufijo .l/.r.
const TERM = {
  orbicularis_oculi: 'Orbicularis oculi muscle',
  masseter: 'Masseter',
  trapezius: 'Trapezius muscle',
  digastric: 'Digastric muscle',
  eyeball: 'Eyeball',
  nasal_cartilages: 'Nasal cartilages',
  upper_teeth: 'Teeth',
  lower_teeth: 'Teeth',
  atlas: 'Atlas',
  axis: 'Axis',
  orbicularis_oris: 'Orbicularis oris muscle',
};
// Correcciones y aclaraciones en español (prioridad sobre TA2).
const OVERRIDE = {
  eyeball: { es: 'Globo ocular' },
  upper_teeth: { es: 'Dientes superiores', la: 'Dentes maxillares' },
  lower_teeth: { es: 'Dientes inferiores', la: 'Dentes mandibulares' },
  atlas: { es: 'Atlas (C1)', la: 'Atlas' },
  axis: { es: 'Axis (C2)', la: 'Axis' },
  vertebra_c3: { es: 'Vértebra C3' },
  mentalis: { es: 'Mentoniano' },
  masseter: { es: 'Masetero' }, // TA2 trae "Masétero"
};

const tidy = (s) =>
  s
    .replace(/^Músculo\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (c) => c.toUpperCase());

const labels = { _comment: 'Generado por pipeline/scripts/build_labels.mjs a partir de TA2.csv (Z-Anatomy, CC BY-SA 4.0). No editar a mano.' };
const missing = [];
for (const layer of ['muscle', 'skull']) {
  for (const [key, names] of Object.entries(parts[layer])) {
    const id = key.replace(/_\{S\}$/, '');
    const term = TERM[id] ?? names[0].replace(/\{s\}/, 'l').replace(/\.[lr]$/, '');
    const hit = byEnglish.get(term.toLowerCase());
    if (!hit) missing.push(`${id} (${term})`);
    const o = OVERRIDE[id] ?? {};
    labels[id] = {
      es: o.es ?? (hit ? tidy(hit.es) : term),
      la: o.la ?? hit?.la ?? undefined,
    };
  }
}
await fs.writeFile('public/models/labels/anatomy.es.json', JSON.stringify(labels, null, 2) + '\n');
console.log(`${Object.keys(labels).length - 1} etiquetas`);
if (missing.length) console.log('Sin término en TA2 (se usa el nombre en inglés):', missing.join(', '));
