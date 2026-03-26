"use client";

import type { InspirationPost } from "@/types/inspiration";

type ApplyAs = "voice_and_format" | "voice_only" | "format_only";

interface StyleSelectorProps {
  inspirations: InspirationPost[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  applyAs: ApplyAs;
  onApplyAsChange: (applyAs: ApplyAs) => void;
}

export function StyleSelector({
  inspirations,
  selectedIds,
  onToggle,
  applyAs,
  onApplyAsChange,
}: StyleSelectorProps) {
  const analyzedInspirations = inspirations.filter(
    (i) => i.analysis_status === "completed"
  );

  if (analyzedInspirations.length === 0) {
    return (
      <div>
        <label className="block text-sm text-[var(--color-text-secondary)] mb-2">Style Reference (optional)</label>
        <div className="p-4 bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] rounded-lg text-center">
          <p className="text-sm text-[var(--color-text-muted)]">No analyzed inspiration posts yet</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            Add inspiration posts in the Library to use for style reference
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm text-[var(--color-text-secondary)]">Style Reference (optional)</label>
        <span className="text-xs text-[var(--color-text-muted)]">{selectedIds.length} selected</span>
      </div>

      {/* Apply as toggle */}
      {selectedIds.length > 0 && (
        <div className="p-3 bg-[var(--color-bg-elevated)] rounded-lg">
          <div className="text-xs text-[var(--color-text-secondary)] mb-2">Apply as:</div>
          <div className="flex gap-2">
            {[
              { value: "voice_and_format" as ApplyAs, label: "Voice + Format" },
              { value: "voice_only" as ApplyAs, label: "Voice Only" },
              { value: "format_only" as ApplyAs, label: "Format Only" },
            ].map(({ value, label }) => (
              <button
                key={value}
                onClick={() => onApplyAsChange(value)}
                className={`px-3 py-1.5 rounded text-xs transition ${
                  applyAs === value
                    ? "bg-[var(--color-primary-500)] text-white"
                    : "bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]/80"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Inspiration list */}
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {analyzedInspirations.map((post) => (
          <button
            key={post.id}
            onClick={() => onToggle(post.id)}
            className={`w-full p-3 rounded-lg border text-left transition ${
              selectedIds.includes(post.id)
                ? "border-[var(--color-primary-500)] bg-[var(--color-primary-500)]/10"
                : "border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] hover:border-[var(--color-border-strong)]"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs px-2 py-0.5 rounded border bg-[var(--color-primary-500)]/10 text-[var(--color-primary-400)] border-[var(--color-primary-500)]/20">
                Inspiration
              </span>
              {post.author_handle && (
                <span className="text-xs text-[var(--color-text-muted)]">@{post.author_handle}</span>
              )}
            </div>
            <p className="text-sm text-[var(--color-text-secondary)] line-clamp-2">
              {post.raw_content}
            </p>
            {post.voice_analysis && (
              <div className="mt-2 text-xs text-[var(--color-text-muted)]">
                Tone: {post.voice_analysis.tone.slice(0, 3).join(", ")}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
