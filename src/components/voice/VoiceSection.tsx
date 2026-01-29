"use client";

import { useState, useEffect } from "react";
import { UserVoiceSettings, VoiceType, DEFAULT_VOICE_SETTINGS, AIModelProvider } from "@/types/voice";
import { FileText, MessageSquare, Settings, MessageCircle } from "lucide-react";
import { VoiceEditorView } from "./editor/VoiceEditorView";

// Inline slider component - simplified
function VoiceSlider({
  label,
  leftLabel,
  rightLabel,
  value,
  onChange,
}: {
  label: string;
  leftLabel: string;
  rightLabel: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleMouseUp = () => {
    if (localValue !== value) {
      onChange(localValue);
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-300">{label}</span>
        <span className="text-xs text-slate-500">
          {localValue < 35 ? leftLabel : localValue > 65 ? rightLabel : "Balanced"}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-slate-500 w-20">{leftLabel}</span>
        <div className="flex-1 relative">
          <input
            type="range"
            min="0"
            max="100"
            value={localValue}
            onChange={(e) => setLocalValue(parseInt(e.target.value, 10))}
            onMouseUp={handleMouseUp}
            onTouchEnd={handleMouseUp}
            className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer
                       [&::-webkit-slider-thumb]:appearance-none
                       [&::-webkit-slider-thumb]:w-3.5
                       [&::-webkit-slider-thumb]:h-3.5
                       [&::-webkit-slider-thumb]:bg-white
                       [&::-webkit-slider-thumb]:rounded-full
                       [&::-webkit-slider-thumb]:cursor-pointer
                       [&::-webkit-slider-thumb]:shadow-sm
                       [&::-moz-range-thumb]:w-3.5
                       [&::-moz-range-thumb]:h-3.5
                       [&::-moz-range-thumb]:bg-white
                       [&::-moz-range-thumb]:rounded-full
                       [&::-moz-range-thumb]:border-0"
          />
          <div
            className="absolute top-0 left-0 h-1.5 bg-amber-500 rounded-full pointer-events-none"
            style={{ width: `${localValue}%` }}
          />
        </div>
        <span className="text-xs text-slate-500 w-20 text-right">{rightLabel}</span>
      </div>
    </div>
  );
}

// Tag input for words/topics
function TagInput({
  placeholder,
  values,
  onChange,
}: {
  placeholder: string;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const [input, setInput] = useState("");

  const addTag = () => {
    const trimmed = input.trim();
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed]);
      setInput("");
    }
  };

  const removeTag = (tag: string) => {
    onChange(values.filter((v) => v !== tag));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {values.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-800 text-slate-300 text-xs rounded"
          >
            {tag}
            <button
              onClick={() => removeTag(tag)}
              className="text-slate-500 hover:text-white"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
          placeholder={placeholder}
          className="flex-1 px-2.5 py-1.5 bg-slate-800/50 border border-slate-700 rounded text-sm text-white placeholder-slate-500 focus:outline-none focus:border-slate-600"
        />
        <button
          onClick={addTag}
          disabled={!input.trim()}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded disabled:opacity-50 transition"
        >
          Add
        </button>
      </div>
    </div>
  );
}

type ViewMode = "settings" | "editor";

export function VoiceSection() {
  const [voiceType, setVoiceType] = useState<VoiceType>("reply");
  const [viewMode, setViewMode] = useState<ViewMode>("settings");
  const [settings, setSettings] = useState<UserVoiceSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Examples state
  const [examples, setExamples] = useState<Array<{ id: string; content_text: string }>>([]);
  const [newExample, setNewExample] = useState("");

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/voice/settings?type=${voiceType}`);
      if (!res.ok) throw new Error("Failed to fetch settings");
      const data = await res.json();
      setSettings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  const fetchExamples = async () => {
    try {
      const res = await fetch(`/api/voice/examples?type=${voiceType}&include_excluded=false`);
      if (res.ok) {
        const data = await res.json();
        setExamples(data);
      }
    } catch (err) {
      console.error("Failed to fetch examples:", err);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchExamples();
  }, [voiceType]);

  const updateSettings = async (updates: Partial<UserVoiceSettings>): Promise<void> => {
    try {
      const res = await fetch("/api/voice/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voice_type: voiceType, ...updates }),
      });
      if (res.ok) {
        const updated = await res.json();
        setSettings(updated);
      }
    } catch (err) {
      console.error("Failed to update:", err);
    }
  };

  const addExample = async () => {
    if (!newExample.trim()) return;
    try {
      const res = await fetch("/api/voice/examples", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content_text: newExample.trim(), content_type: voiceType }),
      });
      if (res.ok) {
        setNewExample("");
        fetchExamples();
      }
    } catch (err) {
      console.error("Failed to add example:", err);
    }
  };

  const removeExample = async (id: string) => {
    try {
      await fetch(`/api/voice/examples/${id}`, { method: "DELETE" });
      setExamples((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      console.error("Failed to remove example:", err);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 bg-slate-800 rounded w-48" />
        <div className="h-32 bg-slate-800 rounded" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-400 text-sm">
        {error} · <button onClick={fetchSettings} className="underline">Retry</button>
      </div>
    );
  }

  const s = settings || { ...DEFAULT_VOICE_SETTINGS } as UserVoiceSettings;
  const guardrails = s.guardrails || { avoid_words: [], avoid_topics: [], custom_rules: [] };

  return (
    <div className="space-y-6">
      {/* Controls Row */}
      <div className="flex items-center justify-between">
        {/* Voice Type Toggle */}
        <div className="flex items-center gap-1 bg-slate-800/50 p-1 rounded-lg">
          <button
            onClick={() => setVoiceType("post")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition ${
              voiceType === "post"
                ? "bg-amber-500 text-slate-900 font-medium"
                : "text-slate-400 hover:text-white hover:bg-slate-700/50"
            }`}
          >
            <FileText className="w-4 h-4" />
            Post
          </button>
          <button
            onClick={() => setVoiceType("reply")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition ${
              voiceType === "reply"
                ? "bg-amber-500 text-slate-900 font-medium"
                : "text-slate-400 hover:text-white hover:bg-slate-700/50"
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            Reply
          </button>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 bg-slate-800/50 p-1 rounded-lg">
          <button
            onClick={() => setViewMode("settings")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition ${
              viewMode === "settings"
                ? "bg-slate-700 text-white"
                : "text-slate-400 hover:text-white hover:bg-slate-700/50"
            }`}
          >
            <Settings className="w-4 h-4" />
            Settings
          </button>
          <button
            onClick={() => setViewMode("editor")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition ${
              viewMode === "editor"
                ? "bg-slate-700 text-white"
                : "text-slate-400 hover:text-white hover:bg-slate-700/50"
            }`}
          >
            <MessageCircle className="w-4 h-4" />
            Voice Editor
          </button>
        </div>
      </div>

      {/* Conditional Content */}
      {viewMode === "editor" ? (
        <VoiceEditorView
          settings={s}
          voiceType={voiceType}
          onSettingsUpdate={updateSettings}
        />
      ) : (
        <div className="space-y-8">

      {/* AI Model Selection */}
      <section>
        <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-4">
          AI Model
        </h3>
        <div className="flex gap-2">
          <button
            onClick={() => updateSettings({ ai_model: "openai" })}
            className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
              (s.ai_model || "openai") === "openai"
                ? "bg-emerald-600 text-white"
                : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300"
            }`}
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
              <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364l2.0201-1.1638a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
            </svg>
            OpenAI
          </button>
          <button
            onClick={() => updateSettings({ ai_model: "claude" })}
            className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
              s.ai_model === "claude"
                ? "bg-orange-600 text-white"
                : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300"
            }`}
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
              <path d="M4.709 15.955l4.72-2.647.08-.08 2.726-1.529-4.398-2.398-3.048 6.574-.08.08zm8.478-5.678l3.048 1.77 3.77-2.085-3.77-2.165-3.048 1.77v.71zm-1.368.79L7.341 8.59l3.77-2.085 4.557 2.557-3.85 2.006zm-.158 1.132v4.954l3.77-2.165V9.953l-3.77 2.247zm-1.052.553l-3.77 2.085v4.876l3.77-2.085v-4.876zm8.637-5.36L12.078 3 4.789 7.312v9.546L12 21l7.246-4.142V7.392z" />
            </svg>
            Claude
          </button>
          <button
            onClick={() => updateSettings({ ai_model: "grok" })}
            className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
              s.ai_model === "grok"
                ? "bg-sky-600 text-white"
                : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300"
            }`}
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            Grok
          </button>
        </div>
        <p className="text-xs text-slate-600 mt-2">
          {(s.ai_model || "openai") === "openai"
            ? "Using GPT-4o-mini for replies, GPT-4 Turbo for posts"
            : s.ai_model === "claude"
            ? "Using Claude 3 Haiku for replies, Claude 3.5 Sonnet for posts"
            : "Using Grok 3 Fast for replies, Grok 3 for posts"}
        </p>
      </section>

      <hr className="border-slate-800" />

      {/* Voice Dials */}
      <section>
        <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-4">
          Voice Dials
        </h3>
        <div className="space-y-5">
          <VoiceSlider
            label="Optimization"
            leftLabel="Authentic"
            rightLabel="Optimized"
            value={s.optimization_authenticity}
            onChange={(v) => updateSettings({ optimization_authenticity: v })}
          />
          <VoiceSlider
            label="Tone"
            leftLabel="Formal"
            rightLabel="Casual"
            value={s.tone_formal_casual}
            onChange={(v) => updateSettings({ tone_formal_casual: v })}
          />
          <VoiceSlider
            label="Energy"
            leftLabel="Calm"
            rightLabel="Punchy"
            value={s.energy_calm_punchy}
            onChange={(v) => updateSettings({ energy_calm_punchy: v })}
          />
          <VoiceSlider
            label="Stance"
            leftLabel="Neutral"
            rightLabel="Opinionated"
            value={s.stance_neutral_opinionated}
            onChange={(v) => updateSettings({ stance_neutral_opinionated: v })}
          />
        </div>
      </section>

      <hr className="border-slate-800" />

      {/* Guardrails */}
      <section>
        <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-4">
          Guardrails
        </h3>
        <div className="space-y-5">
          <div>
            <label className="text-sm text-slate-300 mb-2 block">Words to Avoid</label>
            <TagInput
              placeholder="Add word..."
              values={guardrails.avoid_words}
              onChange={(v) => updateSettings({ guardrails: { ...guardrails, avoid_words: v } })}
            />
          </div>
          <div>
            <label className="text-sm text-slate-300 mb-2 block">Topics to Avoid</label>
            <TagInput
              placeholder="Add topic..."
              values={guardrails.avoid_topics}
              onChange={(v) => updateSettings({ guardrails: { ...guardrails, avoid_topics: v } })}
            />
          </div>
        </div>
      </section>

      <hr className="border-slate-800" />

      {/* Examples */}
      <section>
        <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-4">
          Voice Examples
        </h3>
        <p className="text-xs text-slate-500 mb-3">
          Add {voiceType === "reply" ? "replies" : "posts"} that represent your voice.
        </p>

        {examples.length > 0 && (
          <div className="space-y-2 mb-4">
            {examples.map((ex) => (
              <div
                key={ex.id}
                className="flex items-start gap-2 p-2.5 bg-slate-800/30 rounded text-sm text-slate-300 group"
              >
                <p className="flex-1 line-clamp-2">{ex.content_text}</p>
                <button
                  onClick={() => removeExample(ex.id)}
                  className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <textarea
            value={newExample}
            onChange={(e) => setNewExample(e.target.value)}
            placeholder={`Paste a ${voiceType === "reply" ? "reply" : "post"} example...`}
            rows={2}
            className="flex-1 px-3 py-2 bg-slate-800/50 border border-slate-700 rounded text-sm text-white placeholder-slate-500 resize-none focus:outline-none focus:border-slate-600"
          />
          <button
            onClick={addExample}
            disabled={!newExample.trim()}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm rounded disabled:opacity-50 transition self-end"
          >
            Add
          </button>
        </div>
      </section>

      <hr className="border-slate-800" />

      {/* Special Notes */}
      <section>
        <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-4">
          Special Instructions
        </h3>
        <textarea
          value={s.special_notes || ""}
          onChange={(e) => updateSettings({ special_notes: e.target.value || null })}
          placeholder="Any specific instructions for the AI..."
          rows={3}
          className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded text-sm text-white placeholder-slate-500 resize-none focus:outline-none focus:border-slate-600"
        />
      </section>
        </div>
      )}
    </div>
  );
}
