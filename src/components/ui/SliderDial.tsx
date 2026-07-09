"use client";

import { useState, useEffect, useCallback } from "react";

interface SliderDialProps {
  label: string;
  leftLabel: string;
  rightLabel: string;
  value: number;
  onChange: (value: number) => void;
  description?: string;
  showValue?: boolean;
}

// GALLEY: rule-and-sort — a 1px track with a square paper "sort" thumb. No fill,
// no glow, no scale. Value readout in brackets. See docs/design/galley/galley.css.
export function SliderDial({
  label,
  leftLabel,
  rightLabel,
  value,
  onChange,
  description,
  showValue = false,
}: SliderDialProps) {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(parseInt(e.target.value, 10));
  };

  const commit = useCallback(() => {
    if (localValue !== value) onChange(localValue);
  }, [localValue, value, onChange]);

  const getCurrentLabel = () => {
    if (localValue < 30) return leftLabel;
    if (localValue > 70) return rightLabel;
    return "Balanced";
  };

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-baseline justify-between">
        <label className="text-xs uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
          {label}
        </label>
        <div className="flex items-baseline gap-[1.5ch] text-xs">
          {showValue && (
            <span className="text-[var(--color-accent-400)]">[{localValue}]</span>
          )}
          <span className="uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
            {getCurrentLabel()}
          </span>
        </div>
      </div>

      {description && (
        <p className="text-xs text-[var(--color-text-muted)]">{description}</p>
      )}

      {/* Slider */}
      <div>
        <input
          type="range"
          min="0"
          max="100"
          value={localValue}
          onChange={handleChange}
          onMouseUp={commit}
          onTouchEnd={commit}
          onKeyUp={commit}
          className="
            w-full h-6 appearance-none bg-transparent cursor-pointer
            focus:outline-none
            [&::-webkit-slider-runnable-track]:h-px
            [&::-webkit-slider-runnable-track]:bg-[var(--color-border-strong)]
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-[9px]
            [&::-webkit-slider-thumb]:h-[17px]
            [&::-webkit-slider-thumb]:-mt-2
            [&::-webkit-slider-thumb]:bg-[var(--color-primary-500)]
            [&::-webkit-slider-thumb]:rounded-none
            [&::-webkit-slider-thumb]:cursor-pointer
            [&::-moz-range-track]:h-px
            [&::-moz-range-track]:bg-[var(--color-border-strong)]
            [&::-moz-range-thumb]:w-[9px]
            [&::-moz-range-thumb]:h-[17px]
            [&::-moz-range-thumb]:bg-[var(--color-primary-500)]
            [&::-moz-range-thumb]:rounded-none
            [&::-moz-range-thumb]:border-0
            [&::-moz-range-thumb]:cursor-pointer
          "
        />

        {/* End labels */}
        <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
          <span className={localValue < 30 ? "text-[var(--color-text-secondary)]" : ""}>
            {leftLabel}
          </span>
          <span className={localValue > 70 ? "text-[var(--color-text-secondary)]" : ""}>
            {rightLabel}
          </span>
        </div>
      </div>
    </div>
  );
}
