import { applyLightPreset, setLightManual } from '../scene/lightApi';
import { LIGHT_PRESETS } from '../scene/lightPresets';
import { useAppStore, type ValueLevels } from '../state/store';
import { Slider } from './Slider';

const deg = (v: number) => `${Math.round(v)}°`;

function describeAzimuth(a: number) {
  const r = Math.round(a);
  if (Math.abs(r) <= 5) return 'frente';
  if (Math.abs(r) >= 175) return 'detrás';
  const side = r > 0 ? 'izq.' : 'der.';
  return `${Math.abs(r)}° ${side}`;
}

export function LightControls() {
  const light = useAppStore((s) => s.light);
  const preset = useAppStore((s) => s.lightPreset);
  const showGizmo = useAppStore((s) => s.showLightGizmo);
  const setShowGizmo = useAppStore((s) => s.setShowLightGizmo);

  return (
    <div className="stack">
      <div className="button-grid three">
        {LIGHT_PRESETS.map((p) => (
          <button
            key={p.id}
            className={`chip${preset === p.id ? ' is-active' : ''}`}
            aria-pressed={preset === p.id}
            title={p.hint}
            onClick={() => applyLightPreset(p.id)}
          >
            {p.label}
          </button>
        ))}
        <span className={`chip chip-static${preset === null ? ' is-active-soft' : ''}`} title="Ajustada a mano">
          Personal
        </span>
      </div>

      <Slider
        label="Dirección"
        title="Azimut: gira la luz alrededor de la cabeza"
        value={light.azimuth}
        min={-180}
        max={180}
        step={1}
        format={describeAzimuth}
        onChange={(azimuth) => setLightManual({ azimuth })}
      />
      <Slider
        label="Altura"
        title="Elevación: positiva desde arriba, negativa desde abajo"
        value={light.elevation}
        min={-85}
        max={85}
        step={1}
        format={deg}
        onChange={(elevation) => setLightManual({ elevation })}
      />
      <Slider
        label="Intensidad"
        value={light.intensity}
        min={0}
        max={6}
        step={0.05}
        format={(v) => v.toFixed(1)}
        onChange={(intensity) => setLightManual({ intensity })}
      />

      <label className="check">
        <input type="checkbox" checked={light.fillEnabled} onChange={(e) => setLightManual({ fillEnabled: e.target.checked })} />
        Luz de relleno
      </label>
      <Slider
        label="Relleno"
        title="Luz suave del lado opuesto, sin sombras"
        value={light.fillIntensity}
        min={0}
        max={2}
        step={0.05}
        disabled={!light.fillEnabled}
        format={(v) => v.toFixed(2)}
        onChange={(fillIntensity) => setLightManual({ fillIntensity })}
      />
      <Slider
        label="Ambiente"
        title="Cuánto se aclaran las sombras"
        value={light.ambient}
        min={0}
        max={1}
        step={0.01}
        format={(v) => v.toFixed(2)}
        onChange={(ambient) => setLightManual({ ambient })}
      />
      <label className="check">
        <input type="checkbox" checked={showGizmo} onChange={(e) => setShowGizmo(e.target.checked)} />
        Mostrar indicador de luz
      </label>
      <p className="note">
        <kbd>Shift</kbd> + arrastrar sobre la cabeza mueve la luz.
      </p>
    </div>
  );
}

const LEVEL_OPTIONS: { value: ValueLevels; label: string }[] = [
  { value: 0, label: 'Gris' },
  { value: 3, label: '3' },
  { value: 4, label: '4' },
  { value: 5, label: '5' },
];

export function ValuesControls() {
  const enabled = useAppStore((s) => s.valuesEnabled);
  const setEnabled = useAppStore((s) => s.setValuesEnabled);
  const levels = useAppStore((s) => s.valueLevels);
  const setLevels = useAppStore((s) => s.setValueLevels);
  const bias = useAppStore((s) => s.valueBias);
  const setBias = useAppStore((s) => s.setValueBias);

  return (
    <div className="stack">
      <label className="check">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        Modo valores <span className="muted">(tecla V)</span>
      </label>
      <div className="segmented four" role="radiogroup" aria-label="Número de tonos">
        {LEVEL_OPTIONS.map((o) => (
          <button
            key={o.value}
            role="radio"
            aria-checked={levels === o.value}
            className={levels === o.value ? 'is-active' : ''}
            disabled={!enabled}
            title={o.value === 0 ? 'Escala de grises continua' : `${o.value} tonos`}
            onClick={() => setLevels(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
      <Slider
        label="Umbrales"
        title="Desplaza dónde caen los cortes entre tonos: a la izquierda más claro, a la derecha más oscuro"
        value={Math.log2(bias)}
        min={-1.5}
        max={1.5}
        step={0.05}
        disabled={!enabled}
        format={(v) => (Math.abs(v) < 0.03 ? 'neutro' : v < 0 ? 'más claro' : 'más oscuro')}
        onChange={(v) => setBias(2 ** v)}
      />
    </div>
  );
}
