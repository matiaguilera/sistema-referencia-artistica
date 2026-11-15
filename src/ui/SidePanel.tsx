import type { ReactNode } from 'react';
import { useAppStore, useCurrentModel, type Background } from '../state/store';
import { AnatomyControls } from './AnatomyControls';
import { CameraButtons } from './CameraButtons';
import { LayerControls } from './LayerControls';
import { CaptureControls, GuideControls } from './ReferenceControls';
import { LightControls, ValuesControls } from './LightControls';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="panel-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

const BG_OPTIONS: { id: Background; label: string }[] = [
  { id: 'dark', label: 'Oscuro' },
  { id: 'mid', label: 'Gris medio' },
  { id: 'light', label: 'Claro' },
];

export function SidePanel() {
  const models = useAppStore((s) => s.models);
  const modelId = useAppStore((s) => s.modelId);
  const setModelId = useAppStore((s) => s.setModelId);
  const panelOpen = useAppStore((s) => s.panelOpen);
  const togglePanel = useAppStore((s) => s.togglePanel);
  const background = useAppStore((s) => s.background);
  const setBackground = useAppStore((s) => s.setBackground);
  const current = useCurrentModel();

  return (
    <>
      <button
        className={`panel-toggle${panelOpen ? ' is-open' : ''}`}
        onClick={togglePanel}
        aria-expanded={panelOpen}
        aria-controls="side-panel"
        title={panelOpen ? 'Ocultar panel' : 'Mostrar panel'}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          {panelOpen ? (
            <path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          ) : (
            <path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          )}
        </svg>
      </button>

      <aside id="side-panel" className={`side-panel${panelOpen ? ' is-open' : ''}`} aria-hidden={!panelOpen}>
        <header className="panel-header">
          <h1>Head Study</h1>
          <p>Referencia 3D de la cabeza</p>
        </header>

        <Section title="Modelo">
          <select value={modelId ?? ''} onChange={(e) => {
              setModelId(e.target.value);
              e.currentTarget.blur(); // devuelve los atajos de teclado (1–8, 0) al visor
            }} aria-label="Modelo">
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          {current?.placeholder && (
            <p className="note">Modelo provisional: es una forma simplificada mientras se preparan los modelos reales.</p>
          )}
        </Section>

        <Section title="Capas">
          <LayerControls />
        </Section>

        <Section title="Anatomía">
          <AnatomyControls />
        </Section>

        <Section title="Cámara">
          <CameraButtons />
        </Section>

        <Section title="Iluminación">
          <LightControls />
        </Section>

        <Section title="Valores">
          <ValuesControls />
        </Section>

        <Section title="Guías">
          <GuideControls />
        </Section>

        <Section title="Captura">
          <CaptureControls />
        </Section>

        <Section title="Fondo">
          <div className="segmented" role="radiogroup" aria-label="Fondo">
            {BG_OPTIONS.map((o) => (
              <button
                key={o.id}
                role="radio"
                aria-checked={background === o.id}
                className={background === o.id ? 'is-active' : ''}
                onClick={() => setBackground(o.id)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </Section>

        <footer className="panel-footer">
          <p>
            <kbd>Arrastrar</kbd> rotar · <kbd>Rueda</kbd>/<kbd>pellizco</kbd> zoom · <kbd>Clic der.</kbd>/<kbd>2 dedos</kbd> desplazar
          </p>
          <p>
            Atajos: <kbd>1</kbd>–<kbd>8</kbd> vistas · <kbd>0</kbd> restablecer · <kbd>P</kbd> <kbd>M</kbd> <kbd>C</kbd> capas · <kbd>V</kbd> valores · <kbd>N</kbd> nombres · <kbd>G</kbd> guías · <kbd>S</kbd> captura · <kbd>Esc</kbd> soltar selección · <kbd>Shift</kbd>+arrastrar luz
          </p>
        </footer>
      </aside>
    </>
  );
}
