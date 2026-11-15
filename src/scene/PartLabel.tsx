import { Html } from '@react-three/drei';
import { useAppStore } from '../state/store';
import { describePart, isLayerInteractive, type LabelDict } from './partLabels';

/**
 * Etiqueta flotante con el nombre de la estructura bajo el cursor
 * (o la fijada con clic / toque). Se ancla al punto 3D, así acompaña la rotación.
 */
export function PartLabel({ dict }: { dict: LabelDict }) {
  const hovered = useAppStore((s) => s.hoveredPart);
  const selected = useAppStore((s) => s.selectedPart);
  const showLabels = useAppStore((s) => s.showLabels);
  const showLatin = useAppStore((s) => s.showLatin);
  const part = hovered ?? selected;
  const interactive = useAppStore((s) => (part ? isLayerInteractive(part.layer, s.depth) : false));

  if (!part || !showLabels || !interactive) return null;
  const text = describePart(part.name, dict);

  return (
    <Html position={part.point} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
      <div className={`part-label${selected?.name === part.name ? ' is-pinned' : ''}`}>
        <span className="part-label-es">
          {text.es}
          {text.side && <span className="part-label-side"> ({text.side})</span>}
        </span>
        {showLatin && text.la && <span className="part-label-la">{text.la}</span>}
      </div>
    </Html>
  );
}
