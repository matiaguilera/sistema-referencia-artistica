import { create } from 'zustand';
import type { ModelEntry } from '../registry/types';
import type { CameraPresetId } from '../scene/cameraPresets';
import { DEFAULT_LIGHT, type LightPresetId, type LightSettings } from '../scene/lightPresets';

export type Background = 'dark' | 'mid' | 'light';
export type SkinTone = 'clay' | 'skin';
/** 0 = escala de grises continua; 3–5 = número de tonos del posterizado. */
export type ValueLevels = 0 | 3 | 4 | 5;

interface AppState {
  models: ModelEntry[];
  modelId: string | null;
  registryError: string | null;
  panelOpen: boolean;
  /** Último preset de cámara aplicado; se borra cuando el usuario mueve la cámara. */
  activePreset: CameraPresetId | null;
  background: Background;
  /** Profundidad continua: 0 = piel, 1 = músculo, 2 = cráneo (según las capas disponibles). */
  depth: number;
  skinTone: SkinTone;

  light: LightSettings;
  /** Preset de luz activo; null si el usuario la ajustó a mano. */
  lightPreset: LightPresetId | null;
  showLightGizmo: boolean;
  valuesEnabled: boolean;
  valueLevels: ValueLevels;
  /** Exponente aplicado a la luminancia antes de posterizar: <1 aclara, >1 oscurece. */
  valueBias: number;

  /** Estructura bajo el cursor y estructura fijada con clic / toque. */
  hoveredPart: PartRef | null;
  selectedPart: PartRef | null;
  showLabels: boolean;
  showLatin: boolean;
  /** Nombres de los meshes de cada capa cargada (índice de capa → nombres). */
  layerParts: Record<number, string[]>;

  showGuides: boolean;
  showMidline: boolean;
  captureScale: 1 | 2;

  setRegistry: (models: ModelEntry[], defaultId?: string) => void;
  setRegistryError: (msg: string) => void;
  setModelId: (id: string) => void;
  togglePanel: () => void;
  setActivePreset: (id: CameraPresetId | null) => void;
  setBackground: (bg: Background) => void;
  setDepth: (d: number) => void;
  setSkinTone: (t: SkinTone) => void;
  /** Ajuste manual de la luz (borra el preset activo). */
  setLight: (patch: Partial<LightSettings>) => void;
  setShowLightGizmo: (v: boolean) => void;
  setValuesEnabled: (v: boolean) => void;
  setValueLevels: (n: ValueLevels) => void;
  setValueBias: (b: number) => void;
  setHoveredPart: (p: PartRef | null) => void;
  setSelectedPart: (p: PartRef | null) => void;
  setShowLabels: (v: boolean) => void;
  setShowLatin: (v: boolean) => void;
  setLayerParts: (layer: number, names: string[] | null) => void;
  setShowGuides: (v: boolean) => void;
  setShowMidline: (v: boolean) => void;
  setCaptureScale: (v: 1 | 2) => void;
}

export interface PartRef {
  /** Nombre del mesh, p. ej. "masseter_L". */
  name: string;
  /** Índice de la capa (1 = músculo, 2 = cráneo). */
  layer: number;
  /** Punto donde se ancla la etiqueta. */
  point: [number, number, number];
}

export const useAppStore = create<AppState>((set) => ({
  models: [],
  modelId: null,
  registryError: null,
  panelOpen: typeof window === 'undefined' ? true : window.innerWidth >= 720,
  activePreset: 'front',
  background: 'dark',
  depth: 0,
  skinTone: 'clay',
  light: { ...DEFAULT_LIGHT },
  lightPreset: 'rembrandt',
  showLightGizmo: true,
  valuesEnabled: false,
  valueLevels: 3,
  valueBias: 1,
  hoveredPart: null,
  selectedPart: null,
  showLabels: true,
  showLatin: false,
  layerParts: {},
  showGuides: false,
  showMidline: true,
  captureScale: 2,

  setRegistry: (models, defaultId) =>
    set({
      models,
      modelId: models.find((m) => m.id === defaultId)?.id ?? models[0]?.id ?? null,
      registryError: null,
    }),
  setRegistryError: (registryError) => set({ registryError }),
  setModelId: (modelId) => set({ modelId, hoveredPart: null, selectedPart: null }),
  togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),
  setActivePreset: (activePreset) => set({ activePreset }),
  setBackground: (background) => set({ background }),
  setDepth: (depth) => set({ depth }),
  setSkinTone: (skinTone) => set({ skinTone }),
  setLight: (patch) => set((s) => ({ light: { ...s.light, ...patch }, lightPreset: null })),
  setShowLightGizmo: (showLightGizmo) => set({ showLightGizmo }),
  setValuesEnabled: (valuesEnabled) => set({ valuesEnabled }),
  setValueLevels: (valueLevels) => set({ valueLevels }),
  setValueBias: (valueBias) => set({ valueBias }),
  setHoveredPart: (hoveredPart) => set({ hoveredPart }),
  setSelectedPart: (selectedPart) => set({ selectedPart }),
  setShowLabels: (showLabels) => set({ showLabels }),
  setShowLatin: (showLatin) => set({ showLatin }),
  setLayerParts: (layer, names) =>
    set((s) => {
      const layerParts = { ...s.layerParts };
      if (names) layerParts[layer] = names;
      else delete layerParts[layer];
      return { layerParts };
    }),
  setShowGuides: (showGuides) => set({ showGuides }),
  setShowMidline: (showMidline) => set({ showMidline }),
  setCaptureScale: (captureScale) => set({ captureScale }),
}));

export const useCurrentModel = () =>
  useAppStore((s) => s.models.find((m) => m.id === s.modelId) ?? null);
