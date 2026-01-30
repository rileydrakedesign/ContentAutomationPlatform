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
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseInt(e.target.value, 10);
    setLocalValue(newValue);
  };

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    if (localValue !== value) {
      onChange(localValue);
    }
  }, [localValue, value, onChange]);

  const handleMouseDown = () => {
    setIsDragging(true);
  };

  // Get the current state label
  const getCurrentLabel = () => {
    if (localValue < 30) return leftLabel;
    if (localValue > 70) return rightLabel;
    return "Balanced";
  };

  // Calculate gradient color based on value
  const getTrackGradient = () => {
    return `linear-gradient(90deg,
      var(--color-primary-600) 0%,
      var(--color-primary-500) ${localValue}%,
      var(--color-bg-elevated) ${localValue}%,
      var(--color-bg-elevated) 100%
    )`;
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-[var(--color-text-primary)] text-heading">
          {label}
        </label>
        <div className="flex items-center gap-2">
          {showValue && (
            <span className="text-xs font-mono text-[var(--color-text-muted)] bg-[var(--color-bg-elevated)] px-2 py-0.5 rounded">
              {localValue}
            </span>
          )}
          <span
            className={`
              text-xs font-medium px-2 py-0.5 rounded-full
              transition-all duration-200
              ${isDragging
                ? "bg-[var(--color-primary-500)]/20 text-[var(--color-primary-400)]"
                : "bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)]"
              }
            `}
          >
            {getCurrentLabel()}
          </span>
        </div>
      </div>

      {/* Description */}
      {description && (
        <p className="text-xs text-[var(--color-text-muted)]">{description}</p>
      )}

      {/* Slider */}
      <div className="relative">
        {/* Labels */}
        <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)] mb-2">
          <span className={localValue < 30 ? "text-[var(--color-primary-400)]" : ""}>
            {leftLabel}
          </span>
          <span className={localValue > 70 ? "text-[var(--color-primary-400)]" : ""}>
            {rightLabel}
          </span>
        </div>

        {/* Custom Slider Track */}
        <div className="relative h-2 w-full">
          {/* Background Track */}
          <div
            className="absolute inset-0 rounded-full transition-all duration-100"
            style={{ background: getTrackGradient() }}
          />

          {/* Input Range */}
          <input
            type="range"
            min="0"
            max="100"
            value={localValue}
            onChange={handleChange}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onTouchStart={handleMouseDown}
            onTouchEnd={handleMouseUp}
            className="
              absolute inset-0 w-full h-full
              appearance-none bg-transparent cursor-pointer z-10
              [&::-webkit-slider-thumb]:appearance-none
              [&::-webkit-slider-thumb]:w-5
              [&::-webkit-slider-thumb]:h-5
              [&::-webkit-slider-thumb]:bg-white
              [&::-webkit-slider-thumb]:rounded-full
              [&::-webkit-slider-thumb]:cursor-pointer
              [&::-webkit-slider-thumb]:shadow-lg
              [&::-webkit-slider-thumb]:shadow-black/30
              [&::-webkit-slider-thumb]:transition-all
              [&::-webkit-slider-thumb]:duration-150
              [&::-webkit-slider-thumb]:hover:scale-110
              [&::-webkit-slider-thumb]:active:scale-95
              [&::-webkit-slider-thumb]:border-2
              [&::-webkit-slider-thumb]:border-[var(--color-primary-500)]
              [&::-moz-range-thumb]:w-5
              [&::-moz-range-thumb]:h-5
              [&::-moz-range-thumb]:bg-white
              [&::-moz-range-thumb]:rounded-full
              [&::-moz-range-thumb]:cursor-pointer
              [&::-moz-range-thumb]:border-2
              [&::-moz-range-thumb]:border-[var(--color-primary-500)]
              [&::-moz-range-thumb]:shadow-lg
            "
          />
        </div>

        {/* Value Indicator Dots */}
        <div className="flex items-center justify-between mt-2">
          <div className="flex gap-1">
            {[0, 25, 50, 75, 100].map((mark) => (
              <div
                key={mark}
                className={`
                  w-1 h-1 rounded-full transition-all duration-200
                  ${localValue >= mark
                    ? "bg-[var(--color-primary-500)]"
                    : "bg-[var(--color-bg-hover)]"
                  }
                `}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
