import { useProgress } from '@react-three/drei';
import { useAppStore } from '../state/store';

export function LoadingOverlay() {
  const { active, progress, errors } = useProgress();
  const registryError = useAppStore((s) => s.registryError);
  const glLost = useAppStore((s) => s.glContextLost);

  if (glLost) {
    return (
      <div className="overlay overlay-error overlay-interactive" role="alert">
        <strong>La vista 3D se detuvo</strong>
        <span>El navegador liberó la memoria gráfica (por ejemplo, tras una captura muy grande). Recarga para continuar.</span>
        <button className="btn-primary" onClick={() => window.location.reload()}>
          Recargar
        </button>
      </div>
    );
  }

  if (registryError || errors.length > 0) {
    return (
      <div className="overlay overlay-error" role="alert">
        <strong>No se pudo cargar el modelo</strong>
        <span>{registryError ?? `Error al cargar: ${errors.join(', ')}`}</span>
      </div>
    );
  }
  if (!active) return null;
  return (
    <div className="overlay" role="status" aria-live="polite">
      <div className="progress">
        <div className="progress-bar" style={{ width: `${Math.round(progress)}%` }} />
      </div>
      <span>Cargando modelo… {Math.round(progress)}%</span>
    </div>
  );
}
