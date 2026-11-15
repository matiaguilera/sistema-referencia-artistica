import { useEffect } from 'react';
import { loadRegistry } from './registry/loadRegistry';
import { Viewer } from './scene/Viewer';
import { useAppStore } from './state/store';
import { ErrorBoundary } from './ui/ErrorBoundary';
import { LoadingOverlay } from './ui/LoadingOverlay';
import { SidePanel } from './ui/SidePanel';
import { useKeyboardShortcuts } from './ui/useKeyboardShortcuts';

export default function App() {
  // Selectores puntuales: suscribirse a todo el store re-renderizaría la app en cada
  // movimiento del cursor o frame de una transición.
  const panelOpen = useAppStore((s) => s.panelOpen);
  useKeyboardShortcuts();

  useEffect(() => {
    const { setRegistry, setRegistryError } = useAppStore.getState();
    loadRegistry()
      .then((r) => setRegistry(r.models, r.defaultModel))
      .catch((err: unknown) => setRegistryError(err instanceof Error ? err.message : String(err)));
  }, []);

  return (
    <div className={`app${panelOpen ? ' panel-open' : ''}`}>
      <main className="viewer">
        <ErrorBoundary>
          <Viewer />
        </ErrorBoundary>
        <LoadingOverlay />
      </main>
      <SidePanel />
    </div>
  );
}
