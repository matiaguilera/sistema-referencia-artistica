export type Vec3 = [number, number, number];

export type LayerId = 'skin' | 'muscle' | 'skull';

/** Una entrada de public/models/models.json. Las rutas son relativas a ese archivo. */
export interface ModelEntry {
  id: string;
  name: string;
  description?: string;
  sex?: 'male' | 'female' | 'other';
  age?: number;
  /** true si es un modelo geométrico provisional. */
  placeholder?: boolean;
  /** Rutas a los GLB de cada capa. Solo 'skin' es obligatoria. */
  layers: { skin: string; muscle?: string; skull?: string };
  /** JSON con los nombres de los músculos (es / latín). */
  labels?: string;
  /** Encuadre de la cámara: punto al que mira y radio aproximado de la cabeza con cuello (m). */
  frame?: { target: Vec3; radius: number };
  /** Alturas Y (m) de referencias de proporción, para las guías. */
  landmarks?: Partial<Record<'top' | 'browLine' | 'eyeLine' | 'noseBase' | 'mouthLine' | 'chin', number>>;
  credits?: string[];
}

export interface Registry {
  version: number;
  defaultModel?: string;
  models: ModelEntry[];
}

export const DEFAULT_FRAME: NonNullable<ModelEntry['frame']> = { target: [0, -0.035, 0], radius: 0.17 };
