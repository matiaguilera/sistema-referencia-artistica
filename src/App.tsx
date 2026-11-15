import { useEffect } from 'react';
import { loadRegistry } from './registry/loadRegistry';
import { Viewer } from './scene/Viewer';
import { useAppStore } from './state/store';
import { LoadingOverlay } from './ui/LoadingOverlay';
import { SidePanel } from './ui/SidePanel';
import { useKeyboardShortcuts } from './ui/useKeyboardShortcuts';

export default function App() {
  const { setRegistry, setRegistryError, panelOpen } = useAppStore();
  useKeyboardShortcuts();

  useEffect(() => {
    loadRegistry()
      .then((r) => setRegistry(r.models, r.defaultModel))
      .catch((err: unknown) => setRegistryError(err instanceof Error ? err.message : String(err)));
  }, [setRegistry, setRegistryError]);

  return (
    <div className={`app${panelOpen ? ' panel-open' : ''}`}>
      <main className="viewer">
        <Viewer />
        <LoadingOverlay />
      </main>
      <SidePanel />
    </div>
  );
}
