import { useAppStore } from '../state/store';
import { goToPreset, resetView } from '../scene/cameraApi';
import { CAMERA_PRESETS } from '../scene/cameraPresets';

export function CameraButtons() {
  const active = useAppStore((s) => s.activePreset);
  return (
    <>
      <div className="button-grid">
        {CAMERA_PRESETS.map((p) => (
          <button
            key={p.id}
            className={`chip${active === p.id ? ' is-active' : ''}`}
            onClick={() => goToPreset(p.id)}
            title={`${p.hint} (tecla ${p.key})`}
            aria-pressed={active === p.id}
          >
            {p.label}
          </button>
        ))}
      </div>
      <button className="btn-secondary full" onClick={() => resetView()} title="Restablecer la vista (tecla 0)">
        Restablecer vista
      </button>
    </>
  );
}
