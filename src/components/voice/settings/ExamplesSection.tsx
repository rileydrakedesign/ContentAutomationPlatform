"use client";

import { useState, useEffect } from "react";
import { Upload, X, Plus, GripVertical } from "lucide-react";
import { UserVoiceExample, VoiceType, ParsedCsvPost } from "@/types/voice";
import { CsvUploadModal } from "./CsvUploadModal";

interface ExamplesSectionProps {
  voiceType: VoiceType;
  onExamplesChange?: () => void;
}

export function ExamplesSection({ voiceType, onExamplesChange }: ExamplesSectionProps) {
  const [examples, setExamples] = useState<UserVoiceExample[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [newExample, setNewExample] = useState("");
  const [adding, setAdding] = useState(false);

  const fetchExamples = async () => {
    try {
      const res = await fetch(`/api/voice/examples?type=${voiceType}&include_excluded=false`);
      if (res.ok) {
        const data = await res.json();
        setExamples(data);
      }
    } catch (err) {
      console.error("Failed to fetch examples:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExamples();
  }, [voiceType]);

  const addExample = async () => {
    if (!newExample.trim()) return;

    setAdding(true);
    try {
      const res = await fetch("/api/voice/examples", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content_text: newExample.trim(),
          content_type: voiceType,
        }),
      });

      if (res.ok) {
        setNewExample("");
        await fetchExamples();
        onExamplesChange?.();
      }
    } catch (err) {
      console.error("Failed to add example:", err);
    } finally {
      setAdding(false);
    }
  };

  const removeExample = async (id: string) => {
    try {
      const res = await fetch(`/api/voice/examples/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setExamples((prev) => prev.filter((e) => e.id !== id));
        onExamplesChange?.();
      }
    } catch (err) {
      console.error("Failed to remove example:", err);
    }
  };

  const handleCsvImport = async (posts: ParsedCsvPost[]) => {
    for (const post of posts) {
      try {
        await fetch("/api/voice/examples", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content_text: post.text,
            content_type: voiceType,
          }),
        });
      } catch (err) {
        console.error("Failed to import example:", err);
      }
    }
    await fetchExamples();
    onExamplesChange?.();
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-white">Voice Examples</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {voiceType === "reply" ? "Replies" : "Posts"} that demonstrate your voice style.
          </p>
        </div>
        <button
          onClick={() => setShowCsvModal(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-sm rounded-lg transition-colors"
        >
          <Upload className="w-4 h-4" />
          Upload CSV
        </button>
      </div>

      {/* Examples list */}
      <div className="space-y-2 mb-3 max-h-56 overflow-auto">
        {loading ? (
          <div className="animate-pulse space-y-2">
            <div className="h-16 bg-slate-800 rounded-lg" />
            <div className="h-16 bg-slate-800 rounded-lg" />
          </div>
        ) : examples.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm">
            No examples yet. Add some {voiceType === "reply" ? "replies" : "posts"} to train your voice.
          </div>
        ) : (
          examples.map((example) => (
            <div
              key={example.id}
              className="flex items-start gap-2 p-3 bg-slate-800/50 border border-slate-700/50 rounded-lg group"
            >
              <GripVertical className="w-4 h-4 text-slate-600 mt-1 flex-shrink-0 cursor-grab" />
              <p className="flex-1 text-sm text-slate-300 line-clamp-3">
                {example.content_text}
              </p>
              <button
                onClick={() => removeExample(example.id)}
                className="p-1 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Add example */}
      <div className="flex gap-2">
        <textarea
          value={newExample}
          onChange={(e) => setNewExample(e.target.value)}
          placeholder={`Add a ${voiceType === "reply" ? "reply" : "post"} example...`}
          className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 resize-none focus:outline-none focus:border-slate-500"
          rows={2}
        />
        <button
          onClick={addExample}
          disabled={!newExample.trim() || adding}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors self-end"
        >
          {adding ? "..." : <Plus className="w-5 h-5" />}
        </button>
      </div>

      <CsvUploadModal
        isOpen={showCsvModal}
        onClose={() => setShowCsvModal(false)}
        voiceType={voiceType}
        onImport={handleCsvImport}
      />
    </div>
  );
}
