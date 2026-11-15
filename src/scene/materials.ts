import * as THREE from 'three';
import type { SkinTone } from '../state/store';

/** Material neutro tipo arcilla / yeso: mate, sin brillo, para leer la forma. */
export function createClayMaterial() {
  const m = new THREE.MeshStandardMaterial({ metalness: 0 });
  applySkinTone(m, 'clay');
  return m;
}

const TONES: Record<SkinTone, { color: string; roughness: number }> = {
  clay: { color: '#d8d2c8', roughness: 0.88 },
  skin: { color: '#d7a98f', roughness: 0.62 },
};

export function applySkinTone(m: THREE.MeshStandardMaterial, tone: SkinTone) {
  m.color.set(TONES[tone].color);
  m.roughness = TONES[tone].roughness;
}

export function createMuscleMaterial(color = '#a5534a') {
  // DoubleSide: muchos músculos son láminas abiertas (o quedan abiertas tras el recorte del cuello).
  return new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0, side: THREE.DoubleSide });
}

export function createBoneMaterial(color = '#e6dfd0') {
  // DoubleSide: el cráneo tiene aberturas (órbitas, abertura nasal) por las que se ve el interior.
  return new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0, side: THREE.DoubleSide });
}
