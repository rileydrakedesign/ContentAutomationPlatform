"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { VoiceMemoInput } from "./VoiceMemoInput";
import { FormatSelector } from "./FormatSelector";
import { StyleSelector } from "./StyleSelector";
import type { InspirationPost } from "@/types/inspiration";

type DraftType = "X_POST" | "X_THREAD";
type ApplyAs = "voice_and_format" | "voice_only" | "format_only";

export function NewDraftForm() {
  const router = useRouter();

  // State
  const [draftType, setDraftType] = useState<DraftType>("X_POST");
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [inspirations, setInspirations] = useState<InspirationPost[]>([]);
  const [selectedInspirations, setSelectedInspirations] = useState<string[]>([]);
  const [applyAs, setApplyAs] = useState<ApplyAs>("voice_and_format");
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceContent, setSourceContent] = useState<string | null>(null);

  // Fetch inspirations on mount
  useEffect(() => {
    async function fetchInspirations() {
      try {
        const res = await fetch("/api/inspiration");
        const data = await res.json();
        setInspirations(data);
      } catch (error) {
        console.error("Failed to fetch inspirations:", error);
      }
    }
    fetchInspirations();
  }, []);

  async function handleTranscriptSubmit(transcript: string) {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/sources/transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });

      if (res.ok) {
        const data = await res.json();
        setSourceId(data.id);
        setSourceContent(transcript.slice(0, 150) + (transcript.length > 150 ? "..." : ""));
      } else {
        const data = await res.json();
        setError(data.error || "Failed to save transcript");
      }
    } catch {
      setError("Failed to save transcript");
    } finally {
      setLoading(false);
    }
  }

  async function handleAudioSubmit(file: File) {
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/sources/voice-memo", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setSourceId(data.id);
        setSourceContent(`Audio: ${file.name}`);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to upload audio");
      }
    } catch {
      setError("Failed to upload audio");
    } finally {
      setLoading(false);
    }
  }

  function toggleInspiration(id: string) {
    setSelectedInspirations((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }

  async function handleGenerate() {
    if (!sourceId) {
      setError("Please add your voice memo or idea first");
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const body: Record<string, unknown> = {
        sourceIds: [sourceId],
        draftType,
      };

      if (selectedInspirations.length > 0) {
        body.styleReference = {
          inspirationIds: selectedInspirations,
          applyAs,
        };
      }

      const res = await fetch("/api/drafts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const draft = await res.json();
        router.push(`/drafts/${draft.id}`);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to generate draft");
      }
    } catch {
      setError("Failed to generate draft");
    } finally {
      setGenerating(false);
    }
  }

  function clearSource() {
    setSourceId(null);
    setSourceContent(null);
  }

  return (
    <div className="space-y-4">
      {/* Voice Memo Input */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-white mb-4">
          What do you want to say?
        </h2>

        {sourceId ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-slate-800 rounded-lg">
              <div className="flex items-center gap-3">
                <span className="text-teal-400 text-base">✓</span>
                <div>
                  <p className="text-sm text-white">Content ready</p>
                  <p className="text-xs text-slate-500 line-clamp-1">{sourceContent}</p>
                </div>
              </div>
              <button
                onClick={clearSource}
                className="text-sm text-slate-400 hover:text-white transition"
              >
                Change
              </button>
            </div>
          </div>
        ) : (
          <VoiceMemoInput
            onTranscriptSubmit={handleTranscriptSubmit}
            onAudioSubmit={handleAudioSubmit}
            loading={loading}
          />
        )}
      </div>

      {/* Style Reference (Optional) */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
        <StyleSelector
          inspirations={inspirations}
          selectedIds={selectedInspirations}
          onToggle={toggleInspiration}
          applyAs={applyAs}
          onApplyAsChange={setApplyAs}
        />
      </div>

      {/* Format Selection */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
        <FormatSelector selected={draftType} onChange={setDraftType} />
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Generate Button */}
      <button
        onClick={handleGenerate}
        disabled={!sourceId || generating}
        className="w-full py-3 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-lg font-medium transition"
      >
        {generating ? "Generating..." : "Generate Draft"}
      </button>
    </div>
  );
}
