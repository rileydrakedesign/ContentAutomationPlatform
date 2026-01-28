"use client";

import { useState, useEffect } from "react";

interface SliderDialProps {
  label: string;
  leftLabel: string;
  rightLabel: string;
  value: number;
  onChange: (value: number) => void;
  description?: string;
}

export function SliderDial({
  label,
  leftLabel,
  rightLabel,
  value,
  onChange,
  description,
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

  const handleMouseUp = () => {
    setIsDragging(false);
    if (localValue !== value) {
      onChange(localValue);
    }
  };

  const handleMouseDown = () => {
    setIsDragging(true);
  };

  // Calculate the position indicator color based on value
  const getIndicatorStyle = () => {
    const position = (localValue / 100) * 100;
    return {
      left: `${position}%`,
      transform: "translateX(-50%)",
    };
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-200">{label}</label>
        <span className="text-xs text-slate-400">
          {localValue < 30
            ? leftLabel
            : localValue > 70
            ? rightLabel
            : "Balanced"}
        </span>
      </div>
      {description && (
        <p className="text-xs text-slate-500">{description}</p>
      )}
      <div className="relative pt-1">
        <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
          <span>{leftLabel}</span>
          <span>{rightLabel}</span>
        </div>
        <div className="relative">
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
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer
                       [&::-webkit-slider-thumb]:appearance-none
                       [&::-webkit-slider-thumb]:w-4
                       [&::-webkit-slider-thumb]:h-4
                       [&::-webkit-slider-thumb]:bg-white
                       [&::-webkit-slider-thumb]:rounded-full
                       [&::-webkit-slider-thumb]:cursor-pointer
                       [&::-webkit-slider-thumb]:shadow-md
                       [&::-webkit-slider-thumb]:transition-transform
                       [&::-webkit-slider-thumb]:hover:scale-110
                       [&::-moz-range-thumb]:w-4
                       [&::-moz-range-thumb]:h-4
                       [&::-moz-range-thumb]:bg-white
                       [&::-moz-range-thumb]:rounded-full
                       [&::-moz-range-thumb]:cursor-pointer
                       [&::-moz-range-thumb]:border-0"
          />
          {/* Track fill */}
          <div
            className="absolute top-0 left-0 h-2 bg-gradient-to-r from-violet-600 to-violet-400 rounded-l-lg pointer-events-none"
            style={{ width: `${localValue}%` }}
          />
        </div>
      </div>
    </div>
  );
}
