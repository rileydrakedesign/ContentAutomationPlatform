"use client";

import { useEffect, useRef } from "react";
import { SKIP_REASONS, type SkipReason } from "./types";

/**
 * Skip requires a reason — it's the ranking signal we'd otherwise never
 * collect (PRD §3.4: "skip reasons feed ranking"). Inline, no portal:
 * the picker replaces the row's action line. "Stet" (proofreader's
 * "let it stand") cancels.
 */
export function SkipReasonPicker({
  onPick,
  onCancel,
}: {
  onPick: (reason: SkipReason) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.querySelector("button")?.focus();
  }, []);

  return (
    <div
      ref={ref}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onCancel();
        }
      }}
      className="flex flex-wrap items-center gap-[1ch] animate-fade-in"
    >
      <span className="text-xs uppercase tracking-[0.1em] text-[var(--color-accent-400)]">
        skip —
      </span>
      {SKIP_REASONS.map((r) => (
        <button
          key={r.value}
          onClick={() => onPick(r.value)}
          className="text-xs uppercase tracking-[0.08em] leading-6 px-[1.5ch] border border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent-500)] hover:text-[var(--color-accent-400)] transition-colors duration-100 ease-linear focus:outline focus:outline-1 focus:outline-[var(--color-border-focus)] focus:outline-offset-2"
        >
          {r.label}
        </button>
      ))}
      <button
        onClick={onCancel}
        title="Let it stand — keep the card"
        className="text-xs lowercase tracking-[0.08em] leading-6 px-[1ch] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:underline"
      >
        stet
      </button>
    </div>
  );
}
