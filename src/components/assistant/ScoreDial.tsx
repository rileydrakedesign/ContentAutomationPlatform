"use client";

import { scoreBand, BAND_COLOR } from "@/lib/analysis/assistant";

/**
 * Circular score readout — the Grammarly "orb". Used in the dashboard panel
 * header and as the basis for the extension's bottom-right score badge.
 */
export function ScoreDial({
  value,
  label,
  provisional = false,
  errorCount = 0,
  size = 56,
  checking = false,
}: {
  /** 0-100. */
  value: number;
  label?: string;
  /** Dim the ring when the score doesn't yet include the LLM components. */
  provisional?: boolean;
  /** Red error-count dot (correctness), Grammarly-style. */
  errorCount?: number;
  size?: number;
  checking?: boolean;
}) {
  const band = scoreBand(value);
  const color = BAND_COLOR[band];
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.max(0, Math.min(100, value)) / 100);

  return (
    <div className="relative inline-flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className={checking ? "animate-pulse" : ""}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--color-border-default)"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeDasharray={c}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            opacity={provisional ? 0.55 : 1}
            style={{ transition: "stroke-dashoffset 300ms ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-semibold" style={{ color }}>
            {value}
          </span>
        </div>
        {errorCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-danger-500)] px-1 text-[10px] font-bold text-white">
            {errorCount}
          </span>
        )}
      </div>
      {label && (
        <span className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
          {label}
          {provisional ? " ·live" : ""}
        </span>
      )}
    </div>
  );
}
