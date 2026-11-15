import { useProgress } from '@react-three/drei';
import { useAppStore } from '../state/store';

export function LoadingOverlay() {
  const { active, progress, errors } = useProgress();
  const registryError = useAppStore((s) => s.registryError);

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
