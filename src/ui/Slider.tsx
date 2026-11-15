import { useId } from 'react';

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  disabled?: boolean;
  title?: string;
}

/** Slider con etiqueta y valor visible. */
export function Slider({ label, value, min, max, step = 0.01, onChange, format, disabled, title }: SliderProps) {
  const id = useId();
  const text = format ? format(value) : value.toFixed(2);
  return (
    <div className={`slider-row${disabled ? ' is-disabled' : ''}`} title={title}>
      <div className="slider-head">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id}>{text}</output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-valuetext={text}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}
