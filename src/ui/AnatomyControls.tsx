import { useMemo } from 'react';
import { animateDepth, availableLayers } from '../scene/layers';
import { describePart, isLayerInteractive, partAnchor, useLabelDict } from '../scene/partLabels';
import { useAppStore, useCurrentModel } from '../state/store';

const GROUP_TITLE: Record<string, string> = { muscle: 'Músculos', skull: 'Huesos' };

export function AnatomyControls() {
  const entry = useCurrentModel();
  const dict = useLabelDict(entry?.labels);
  const showLabels = useAppStore((s) => s.showLabels);
  const setShowLabels = useAppStore((s) => s.setShowLabels);
  const showLatin = useAppStore((s) => s.showLatin);
  const setShowLatin = useAppStore((s) => s.setShowLatin);
  const layerParts = useAppStore((s) => s.layerParts);
  const selected = useAppStore((s) => s.selectedPart);
  const hovered = useAppStore((s) => s.hoveredPart);
  const depth = useAppStore((s) => s.depth);

  const layers = useMemo(() => (entry ? availableLayers(entry) : []), [entry]);
  const groups = useMemo(
    () =>
      layers
        .map((l, index) => ({ ...l, index }))
        .filter((l) => l.index > 0 && layerParts[l.index]?.length)
        .map((l) => ({
          id: l.id,
          index: l.index,
          title: GROUP_TITLE[l.id] ?? l.label,
          parts: layerParts[l.index]
            .map((name) => ({ name, text: describePart(name, dict) }))
            .sort((a, b) => a.text.es.localeCompare(b.text.es, 'es') || (a.text.side ?? '').localeCompare(b.text.side ?? '')),
        })),
    [layers, layerParts, dict],
  );

  if (layers.length < 2) return <p className="note">Este modelo no tiene capas anatómicas.</p>;

  const current = hovered ?? selected;
  const currentText = current && isLayerInteractive(current.layer, depth) ? describePart(current.name, dict) : null;

  const select = (name: string, index: number) => {
    const { setSelectedPart, selectedPart } = useAppStore.getState();
    if (selectedPart?.name === name) return setSelectedPart(null);
    const point = partAnchor(name);
    if (!point) return;
    setSelectedPart({ name, layer: index, point });
    if (!isLayerInteractive(index, useAppStore.getState().depth)) animateDepth(index);
  };

  return (
    <div className="stack">
      <label className="check">
        <input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} />
        Mostrar nombres <span className="muted">(tecla N)</span>
      </label>
      <label className="check">
        <input type="checkbox" checked={showLatin} onChange={(e) => setShowLatin(e.target.checked)} />
        Nombre en latín
      </label>

      <div className="current-part" aria-live="polite">
        {currentText ? (
          <>
            <strong>
              {currentText.es}
              {currentText.side && <span className="muted"> ({currentText.side})</span>}
            </strong>
            {showLatin && currentText.la && <em>{currentText.la}</em>}
          </>
        ) : (
          <span className="muted">
            {depth < 0.5 ? 'Pasa a la vista muscular o de cráneo y señala una estructura.' : 'Pasa el cursor o toca una estructura.'}
          </span>
        )}
      </div>

      {groups.map((g) => (
        <details key={g.id} className="part-list">
          <summary>
            {g.title} <span className="muted">({g.parts.length})</span>
          </summary>
          <ul>
            {g.parts.map((p) => (
              <li key={p.name}>
                <button
                  className={selected?.name === p.name ? 'is-active' : ''}
                  onClick={() => select(p.name, g.index)}
                  onPointerEnter={() => {
                    const point = partAnchor(p.name);
                    if (point) useAppStore.getState().setHoveredPart({ name: p.name, layer: g.index, point });
                  }}
                  onPointerLeave={() => {
                    if (useAppStore.getState().hoveredPart?.name === p.name) useAppStore.getState().setHoveredPart(null);
                  }}
                >
                  {p.text.es}
                  {p.text.side && <span className="muted"> {p.text.side}</span>}
                </button>
              </li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  );
}
