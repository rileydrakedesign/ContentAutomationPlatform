"use client";

import { Check, X } from "lucide-react";
import type { Finding } from "@/lib/analysis/assistant";
import { CLASS_STYLE } from "@/lib/analysis/assistant";

/**
 * Hover-to-explain card (GRAMMARLY_PIVOT_UX.md §4). Quiet underline by default;
 * on hover this rises above the span with: colored category chip · what · why
 * (grounded) · Accept (one-click) · Dismiss.
 */
export function SuggestionPopover({
  finding,
  onAccept,
  onDismiss,
}: {
  finding: Finding;
  onAccept?: () => void;
  onDismiss?: () => void;
}) {
  const style = CLASS_STYLE[finding.class];
  const canAccept = onAccept && (finding.replacement !== undefined || finding.replacement === "");

  return (
    <div className="w-72 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-3 shadow-xl">
      <div className="mb-1.5 flex items-center gap-1.5">
        <span
          className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
          style={{ color: style.color, background: `${style.color}1a` }}
        >
          {style.label}
        </span>
      </div>
      <p className="text-sm font-medium text-[var(--color-text-primary)]">{finding.title}</p>
      <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-secondary)]">{finding.why}</p>

      {finding.replacement && finding.replacement.trim().length > 0 && (
        <p className="mt-2 rounded-lg bg-[var(--color-bg-elevated)] px-2 py-1.5 text-xs text-[var(--color-text-primary)]">
          {finding.replacement}
        </p>
      )}

      <div className="mt-2.5 flex items-center gap-2">
        {canAccept && (
          <button
            onClick={onAccept}
            className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-primary-500)] px-2.5 py-1 text-xs font-medium text-[var(--color-text-inverse)] transition-colors duration-100 hover:bg-[var(--color-primary-600)]"
          >
            <Check className="h-3.5 w-3.5" />
            {finding.replacement === "" ? "Remove" : "Accept"}
          </button>
        )}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border-default)] px-2.5 py-1 text-xs text-[var(--color-text-secondary)] transition-colors duration-100 hover:bg-[var(--color-bg-hover)]"
          >
            <X className="h-3.5 w-3.5" />
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}
