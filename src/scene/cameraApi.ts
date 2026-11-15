import type { CameraControls } from '@react-three/drei';
import type { ComponentRef } from 'react';
import { DEFAULT_FRAME, type ModelEntry } from '../registry/types';
import { useAppStore } from '../state/store';
import { CAMERA_PRESETS, framingDistance, presetPosition, type CameraPresetId } from './cameraPresets';

type Controls = ComponentRef<typeof CameraControls>;

/**
 * Puente entre la UI (fuera del Canvas) y los controles de cámara (dentro del Canvas).
 * CameraRig registra aquí sus controles; los botones llaman a goToPreset / resetView.
 */
let controls: Controls | null = null;
let frame: NonNullable<ModelEntry['frame']> = DEFAULT_FRAME;

export function registerCamera(c: Controls | null, f: ModelEntry['frame']) {
  controls = c;
  frame = f ?? DEFAULT_FRAME;
}

export function goToPreset(id: CameraPresetId, animate = true) {
  const preset = CAMERA_PRESETS.find((p) => p.id === id);
  if (!controls || !preset) return;
  const aspect = (controls.camera as { aspect?: number }).aspect ?? 1;
  const [px, py, pz] = presetPosition(preset, frame.target, framingDistance(frame.radius, aspect));
  const [tx, ty, tz] = frame.target;
  void controls.setLookAt(px, py, pz, tx, ty, tz, animate);
  useAppStore.getState().setActivePreset(id);
}

export function resetView(animate = true) {
  goToPreset('front', animate);
}

/** Llamado cuando el usuario empieza a arrastrar la cámara ('controlstart' solo se emite por input del usuario). */
export function onUserCameraMove() {
  useAppStore.getState().setActivePreset(null);
}
