import { useEffect } from 'react';
import { goToPreset, resetView } from '../scene/cameraApi';
import { CAMERA_PRESETS } from '../scene/cameraPresets';
import { animateDepth, availableLayers } from '../scene/layers';
import { useAppStore } from '../state/store';
import type { LayerId } from '../registry/types';
import { takeScreenshot } from './ReferenceControls';

const LAYER_KEYS: Record<string, LayerId> = { p: 'skin', m: 'muscle', c: 'skull' };

export function useKeyboardShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;

      if (e.key === '0') return resetView();
      const preset = CAMERA_PRESETS.find((p) => p.key === e.key);
      if (preset) return goToPreset(preset.id);

      if (e.key === 'Escape') return useAppStore.getState().setSelectedPart(null);
      if (e.key.toLowerCase() === 'n') {
        const s = useAppStore.getState();
        return s.setShowLabels(!s.showLabels);
      }
      if (e.key.toLowerCase() === 'g') {
        const s = useAppStore.getState();
        return s.setShowGuides(!s.showGuides);
      }
      if (e.key.toLowerCase() === 's') {
        void takeScreenshot().catch((err) => console.error(err));
        return;
      }
      if (e.key.toLowerCase() === 'v') {
        const s = useAppStore.getState();
        return s.setValuesEnabled(!s.valuesEnabled);
      }

      const layerId = LAYER_KEYS[e.key.toLowerCase()];
      if (layerId) {
        const { models, modelId } = useAppStore.getState();
        const entry = models.find((m) => m.id === modelId);
        const index = entry ? availableLayers(entry).findIndex((l) => l.id === layerId) : -1;
        if (index >= 0) animateDepth(index);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
