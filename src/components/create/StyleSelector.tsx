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
        <label className="block text-sm text-slate-400 mb-2">Style Reference (optional)</label>
        <div className="p-4 bg-slate-800 border border-slate-700 rounded-lg text-center">
          <p className="text-sm text-slate-500">No analyzed inspiration posts yet</p>
          <p className="text-xs text-slate-600 mt-1">
            Add inspiration posts in the Library to use for style reference
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm text-slate-400">Style Reference (optional)</label>
        <span className="text-xs text-slate-500">{selectedIds.length} selected</span>
      </div>

      {/* Apply as toggle */}
      {selectedIds.length > 0 && (
        <div className="p-3 bg-slate-800 rounded-lg">
          <div className="text-xs text-slate-400 mb-2">Apply as:</div>
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
                    ? "bg-amber-500 text-white"
                    : "bg-slate-700 text-slate-300 hover:bg-slate-600"
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
                ? "border-purple-500 bg-purple-500/10"
                : "border-slate-700 bg-slate-800 hover:border-slate-600"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs px-2 py-0.5 rounded border bg-purple-500/10 text-purple-400 border-purple-500/20">
                Inspiration
              </span>
              {post.author_handle && (
                <span className="text-xs text-slate-500">@{post.author_handle}</span>
              )}
            </div>
            <p className="text-sm text-slate-300 line-clamp-2">
              {post.raw_content}
            </p>
            {post.voice_analysis && (
              <div className="mt-2 text-xs text-slate-500">
                Tone: {post.voice_analysis.tone.slice(0, 3).join(", ")}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
