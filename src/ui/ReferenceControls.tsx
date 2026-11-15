import { useState } from 'react';
import { captureView } from '../scene/captureApi';
import { CAMERA_PRESETS } from '../scene/cameraPresets';
import { availableLayers } from '../scene/layers';
import { useAppStore, useCurrentModel } from '../state/store';

export function GuideControls() {
  const showGuides = useAppStore((s) => s.showGuides);
  const setShowGuides = useAppStore((s) => s.setShowGuides);
  const showMidline = useAppStore((s) => s.showMidline);
  const setShowMidline = useAppStore((s) => s.setShowMidline);
  const entry = useCurrentModel();
  const hasLandmarks = !!entry?.landmarks && Object.keys(entry.landmarks).length > 0;

  return (
    <div className="stack">
      <label className="check">
        <input type="checkbox" checked={showGuides} disabled={!hasLandmarks} onChange={(e) => setShowGuides(e.target.checked)} />
        Guías de proporción <span className="muted">(tecla G)</span>
      </label>
      <label className={`check${showGuides ? '' : ' is-disabled'}`}>
        <input type="checkbox" checked={showMidline} disabled={!showGuides} onChange={(e) => setShowMidline(e.target.checked)} />
        Línea media
      </label>
      {!hasLandmarks && <p className="note">Este modelo no define referencias de proporción.</p>}
    </div>
  );
}

/** Nombre de archivo descriptivo: head-study_masculino_3-4-izq_musculo_2026-11-15_1712.png */
export function captureFilename() {
  const s = useAppStore.getState();
  const entry = s.models.find((m) => m.id === s.modelId);
  const slug = (t: string) =>
    t
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  const view = CAMERA_PRESETS.find((p) => p.id === s.activePreset)?.label ?? 'libre';
  const layers = entry ? availableLayers(entry) : [];
  const layer = layers[Math.round(s.depth)]?.label ?? '';
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const parts = ['head-study', entry?.name ?? 'modelo', view, layer, s.valuesEnabled ? 'valores' : ''].filter(Boolean).map(slug);
  return `${parts.join('_')}_${stamp}.png`;
}

export async function takeScreenshot() {
  await captureView(useAppStore.getState().captureScale, captureFilename());
}

export function CaptureControls() {
  const scale = useAppStore((s) => s.captureScale);
  const setScale = useAppStore((s) => s.setCaptureScale);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onCapture = async () => {
    setBusy(true);
    setError(null);
    try {
      await takeScreenshot();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <div className="row">
        <span className="row-label">Resolución</span>
        <div className="segmented compact" role="radiogroup" aria-label="Resolución de la captura">
          {([1, 2] as const).map((v) => (
            <button key={v} role="radio" aria-checked={scale === v} className={scale === v ? 'is-active' : ''} onClick={() => setScale(v)}>
              {v}×
            </button>
          ))}
        </div>
      </div>
      <button className="btn-primary full" onClick={onCapture} disabled={busy}>
        {busy ? 'Guardando…' : 'Guardar PNG'} <span className="muted-ink">(tecla S)</span>
      </button>
      <p className="note">Guarda la vista tal como se ve (incluidas las guías, sin el indicador de luz ni las etiquetas).</p>
      {error && (
        <p className="note error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
