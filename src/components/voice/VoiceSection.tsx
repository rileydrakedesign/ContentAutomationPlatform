"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { UserVoiceSettings, VoiceType, DEFAULT_VOICE_SETTINGS } from "@/types/voice";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { SliderDial } from "@/components/ui/SliderDial";
import {
  FileText,
  MessageSquare,
  Settings,
  MessageCircle,
  Plus,
  X,
  Sparkles,
  Shield,
  Quote,
  StickyNote,
  Cpu,
} from "lucide-react";
import { VoiceEditorView } from "./editor/VoiceEditorView";

// AI Model Icons
const OpenAIIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
    <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364l2.0201-1.1638a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
  </svg>
);

const ClaudeIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
    <path d="M4.709 15.955l4.72-2.647.08-.08 2.726-1.529-4.398-2.398-3.048 6.574-.08.08zm8.478-5.678l3.048 1.77 3.77-2.085-3.77-2.165-3.048 1.77v.71zm-1.368.79L7.341 8.59l3.77-2.085 4.557 2.557-3.85 2.006zm-.158 1.132v4.954l3.77-2.165V9.953l-3.77 2.247zm-1.052.553l-3.77 2.085v4.876l3.77-2.085v-4.876zm8.637-5.36L12.078 3 4.789 7.312v9.546L12 21l7.246-4.142V7.392z" />
  </svg>
);

const GrokIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

type ViewMode = "settings" | "editor";

// Tag Input Component
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
    <div className="space-y-3">
      {values.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {values.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] text-xs rounded-full border border-[var(--color-border-default)] group"
            >
              {tag}
              <button
                onClick={() => removeTag(tag)}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-danger-400)] transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
          placeholder={placeholder}
          className="flex-1 h-9 px-3 text-sm"
        />
        <Button variant="secondary" size="sm" onClick={addTag} disabled={!input.trim()}>
          Add
        </Button>
      </div>
    </div>
  );
}

export function VoiceSection() {
  const [voiceType, setVoiceType] = useState<VoiceType>("reply");
  const [viewMode, setViewMode] = useState<ViewMode>("settings");
  const [settings, setSettings] = useState<UserVoiceSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [specialNotes, setSpecialNotes] = useState("");
  const specialNotesFocused = useRef(false);

  // Examples state
  const [examples, setExamples] = useState<Array<{ id: string; content_text: string }>>([]);
  const [examplePickerOpen, setExamplePickerOpen] = useState(false);
  const [exampleSearch, setExampleSearch] = useState("");
  const [analyticsPosts, setAnalyticsPosts] = useState<Array<{ id: string; text: string; is_reply: boolean; impressions: number; engagement_score: number }>>([]);
  const [loadingAnalyticsPosts, setLoadingAnalyticsPosts] = useState(false);

  // Inspiration picker
  const [inspirationPickerOpen, setInspirationPickerOpen] = useState(false);
  const [inspirationSearch, setInspirationSearch] = useState("");

  // Inspiration posts (saved)
  const [inspirations, setInspirations] = useState<Array<{ id: string; raw_content: string; author_handle: string | null; include_in_post_voice?: boolean; include_in_reply_voice?: boolean; created_at: string; is_pinned?: boolean | null }>>([]);
  const [loadingInspirations, setLoadingInspirations] = useState(false);

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

  const fetchInspirations = async () => {
    try {
      setLoadingInspirations(true);
      const res = await fetch("/api/inspiration");
      if (res.ok) {
        const data = await res.json();
        setInspirations(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Failed to fetch inspirations:", err);
    } finally {
      setLoadingInspirations(false);
    }
  };

  const ensureAnalyticsPostsLoaded = async () => {
    if (loadingAnalyticsPosts) return;
    if (analyticsPosts.length > 0) return;
    try {
      setLoadingAnalyticsPosts(true);
      const res = await fetch("/api/analytics/csv");
      if (!res.ok) return;
      const json = await res.json();
      const posts = (json.data?.posts || []) as Array<any>;
      setAnalyticsPosts(
        posts.map((p) => ({
          id: p.id,
          text: p.text,
          is_reply: !!p.is_reply,
          impressions: Number(p.impressions || 0),
          engagement_score: Number(p.engagement_score || 0),
        }))
      );
    } catch (err) {
      console.error("Failed to fetch analytics CSV:", err);
    } finally {
      setLoadingAnalyticsPosts(false);
    }
  };

  const setInspirationIncluded = async (id: string, included: boolean) => {
    try {
      const payload = voiceType === "reply"
        ? { include_in_reply_voice: included }
        : { include_in_post_voice: included };
      const res = await fetch(`/api/inspiration/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const updated = await res.json();
        setInspirations((prev) => prev.map((p) => (p.id === id ? { ...p, ...updated } : p)));
      }
    } catch (err) {
      console.error("Failed to toggle inspiration include:", err);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchExamples();
    fetchInspirations();
  }, [voiceType]);

  useEffect(() => {
    if (!specialNotesFocused.current) {
      setSpecialNotes(settings?.special_notes || "");
    }
  }, [settings?.special_notes]);

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

  const addExampleFromText = async (text: string) => {
    const trimmed = (text || "").trim();
    if (!trimmed) return;
    try {
      const res = await fetch("/api/voice/examples", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content_text: trimmed, content_type: voiceType }),
      });
      if (res.ok) {
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
      <div className="space-y-6">
        <div className="h-12 skeleton w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 space-y-6">
            <div className="h-32 skeleton" />
            <div className="h-64 skeleton" />
          </div>
          <div className="lg:col-span-2 space-y-6">
            <div className="h-48 skeleton" />
            <div className="h-48 skeleton" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center">
          <p className="text-[var(--color-danger-400)] mb-4">{error}</p>
          <Button variant="secondary" onClick={fetchSettings}>
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  const s = settings || ({ ...DEFAULT_VOICE_SETTINGS } as UserVoiceSettings);
  const guardrails = s.guardrails || { avoid_words: [], avoid_topics: [], custom_rules: [] };

  return (
    <div className="space-y-6">
      {/* Controls Row */}
      <div className="flex items-center justify-between">
        {/* Voice Type Toggle */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)]">
          <button
            onClick={() => setVoiceType("post")}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer
              ${voiceType === "post"
                ? "bg-[var(--color-primary-500)] text-white shadow-[var(--shadow-glow-primary)]"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-elevated)]"
              }
            `}
          >
            <FileText className="w-4 h-4" />
            Post Voice
          </button>
          <button
            onClick={() => setVoiceType("reply")}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer
              ${voiceType === "reply"
                ? "bg-[var(--color-primary-500)] text-white shadow-[var(--shadow-glow-primary)]"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-elevated)]"
              }
            `}
          >
            <MessageSquare className="w-4 h-4" />
            Reply Voice
          </button>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)]">
          <button
            onClick={() => setViewMode("settings")}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer
              ${viewMode === "settings"
                ? "bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)]"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              }
            `}
          >
            <Settings className="w-4 h-4" />
            Settings
          </button>
          <button
            onClick={() => setViewMode("editor")}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer
              ${viewMode === "editor"
                ? "bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)]"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              }
            `}
          >
            <MessageCircle className="w-4 h-4" />
            AI Editor
          </button>
        </div>
      </div>

      {/* Conditional Content */}
      {viewMode === "editor" ? (
        <VoiceEditorView settings={s} voiceType={voiceType} onSettingsUpdate={updateSettings} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left Column - 3/5 width */}
          <div className="lg:col-span-3 space-y-6">
            {/* AI Model Selection */}
            <Card>
              <CardContent>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-[var(--color-primary-500)]/10 flex items-center justify-center">
                    <Cpu className="w-4 h-4 text-[var(--color-primary-400)]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                      AI Model
                    </h3>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      Choose which AI generates your content
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: "openai", name: "OpenAI", icon: OpenAIIcon, color: "emerald", desc: "GPT-4 Turbo" },
                    { id: "claude", name: "Claude", icon: ClaudeIcon, color: "orange", desc: "Sonnet 4" },
                    { id: "grok", name: "Grok", icon: GrokIcon, color: "sky", desc: "Grok 3" },
                  ].map((model) => {
                    const isSelected = (s.ai_model || "openai") === model.id;
                    const Icon = model.icon;
                    return (
                      <button
                        key={model.id}
                        onClick={() => updateSettings({ ai_model: model.id as "openai" | "claude" | "grok" })}
                        className={`
                          relative p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer
                          ${isSelected
                            ? `border-${model.color}-500 bg-${model.color}-500/10`
                            : "border-[var(--color-border-default)] hover:border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)]"
                          }
                        `}
                      >
                        {isSelected && (
                          <div className={`absolute top-2 right-2 w-2 h-2 rounded-full bg-${model.color}-500`} />
                        )}
                        <div className={`mb-2 ${isSelected ? `text-${model.color}-400` : "text-[var(--color-text-secondary)]"}`}>
                          <Icon />
                        </div>
                        <p className={`text-sm font-medium ${isSelected ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-secondary)]"}`}>
                          {model.name}
                        </p>
                        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{model.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Special Instructions */}
            <Card>
              <CardContent>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-[var(--color-warning-500)]/10 flex items-center justify-center">
                    <StickyNote className="w-4 h-4 text-[var(--color-warning-400)]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                      Special Instructions
                    </h3>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      Guidance the AI should always follow
                    </p>
                  </div>
                </div>

                <textarea
                  value={specialNotes}
                  onChange={(e) => setSpecialNotes(e.target.value)}
                  onFocus={() => { specialNotesFocused.current = true; }}
                  onBlur={() => {
                    specialNotesFocused.current = false;
                    if (specialNotes !== (s.special_notes || "")) {
                      updateSettings({ special_notes: specialNotes || null });
                    }
                  }}
                  placeholder="What should the AI do (or avoid) every time?"
                  rows={4}
                  className="w-full px-3 py-2 text-sm resize-none"
                />
              </CardContent>
            </Card>

            {/* Voice Personality Sliders */}
            <Card>
              <CardContent>
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-8 h-8 rounded-lg bg-[var(--color-accent-500)]/10 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-[var(--color-accent-400)]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                      Voice Personality
                    </h3>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      Fine-tune how your {voiceType === "reply" ? "replies" : "posts"} sound
                    </p>
                  </div>
                </div>

                <div className="space-y-6">
                  <SliderDial
                    label="Optimization"
                    leftLabel="Authentic"
                    rightLabel="Optimized"
                    value={s.optimization_authenticity}
                    onChange={(v) => updateSettings({ optimization_authenticity: v })}
                  />
                  <SliderDial
                    label="Tone"
                    leftLabel="Formal"
                    rightLabel="Casual"
                    value={s.tone_formal_casual}
                    onChange={(v) => updateSettings({ tone_formal_casual: v })}
                  />
                  <SliderDial
                    label="Energy"
                    leftLabel="Calm"
                    rightLabel="Punchy"
                    value={s.energy_calm_punchy}
                    onChange={(v) => updateSettings({ energy_calm_punchy: v })}
                  />
                  <SliderDial
                    label="Stance"
                    leftLabel="Neutral"
                    rightLabel="Opinionated"
                    value={s.stance_neutral_opinionated}
                    onChange={(v) => updateSettings({ stance_neutral_opinionated: v })}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - 2/5 width */}
          <div className="lg:col-span-2 space-y-6">
            {/* Guardrails */}
            <Card>
              <CardContent>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-[var(--color-danger-500)]/10 flex items-center justify-center">
                    <Shield className="w-4 h-4 text-[var(--color-danger-400)]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                      Guardrails
                    </h3>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      Content the AI should avoid
                    </p>
                  </div>
                </div>

                <div className="space-y-5">
                  <div>
                    <label className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider mb-2 block">
                      Words to Avoid
                    </label>
                    <TagInput
                      placeholder="Add word..."
                      values={guardrails.avoid_words}
                      onChange={(v) => updateSettings({ guardrails: { ...guardrails, avoid_words: v } })}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider mb-2 block">
                      Topics to Avoid
                    </label>
                    <TagInput
                      placeholder="Add topic..."
                      values={guardrails.avoid_topics}
                      onChange={(v) => updateSettings({ guardrails: { ...guardrails, avoid_topics: v } })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Saved Inspiration (manual include) */}
            <Card>
              <CardContent>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-[var(--color-accent-500)]/10 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-[var(--color-accent-400)]" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                      Saved Inspiration
                    </h3>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      Manually include saved posts in your {voiceType === "reply" ? "response" : "post"} voice
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {inspirations.filter((p) => (voiceType === "reply" ? p.include_in_reply_voice : p.include_in_post_voice)).length > 0 && (
                      <Badge variant="accent">
                        {inspirations.filter((p) => (voiceType === "reply" ? p.include_in_reply_voice : p.include_in_post_voice)).length}
                      </Badge>
                    )}
                  </div>
                </div>

                {loadingInspirations ? (
                  <div className="space-y-2">
                    <div className="h-16 skeleton" />
                    <div className="h-16 skeleton" />
                  </div>
                ) : (
                  <>
                  {inspirations.filter((p) => (voiceType === "reply" ? p.include_in_reply_voice : p.include_in_post_voice)).length > 0 && (
                  <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
                    {inspirations
                      .filter((post) => (voiceType === "reply" ? post.include_in_reply_voice : post.include_in_post_voice))
                      .slice(0, 30)
                      .map((post) => (
                        <div
                          key={post.id}
                          className="group p-3 rounded-lg border bg-[var(--color-bg-elevated)] border-[var(--color-border-subtle)]"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs text-[var(--color-text-muted)]">
                                  {post.author_handle
                                    ? (post.author_handle.startsWith("@") ? post.author_handle : `@${post.author_handle}`)
                                    : "unknown"}
                                </span>
                                <span className="text-xs text-[var(--color-text-muted)]">·</span>
                                <span className="text-xs text-[var(--color-text-muted)]">
                                  {new Date(post.created_at).toLocaleDateString()}
                                </span>
                              </div>
                              <p className="text-sm text-[var(--color-text-secondary)] line-clamp-2">
                                {post.raw_content}
                              </p>
                            </div>

                            <button
                              onClick={() => setInspirationIncluded(post.id, false)}
                              className="opacity-0 group-hover:opacity-100 p-1 text-[var(--color-text-muted)] hover:text-[var(--color-danger-400)] transition-all"
                              title="Remove"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                  )}

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={async () => {
                      setInspirationPickerOpen(true);
                      setInspirationSearch("");
                      await fetchInspirations();
                    }}
                    icon={<Plus className="w-4 h-4" />}
                    fullWidth
                  >
                    Add from saved inspirations
                  </Button>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Voice Examples */}
            <Card>
              <CardContent>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-[var(--color-success-500)]/10 flex items-center justify-center">
                    <Quote className="w-4 h-4 text-[var(--color-success-400)]" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                      Voice Examples
                    </h3>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {voiceType === "reply" ? "Replies" : "Posts"} that represent your style
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {examples.length > 0 && (
                      <Badge variant="success">{examples.length}</Badge>
                    )}
                  </div>
                </div>

                {examples.length > 0 && (
                  <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
                    {examples.map((ex) => (
                      <div
                        key={ex.id}
                        className="group flex items-start gap-2 p-3 bg-[var(--color-bg-elevated)] rounded-lg border border-[var(--color-border-subtle)]"
                      >
                        <p className="flex-1 text-sm text-[var(--color-text-secondary)] line-clamp-2">
                          {ex.content_text}
                        </p>
                        <button
                          onClick={() => removeExample(ex.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-[var(--color-text-muted)] hover:text-[var(--color-danger-400)] transition-all"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={async () => {
                    setExamplePickerOpen(true);
                    setExampleSearch("");
                    await ensureAnalyticsPostsLoaded();
                  }}
                  icon={<Plus className="w-4 h-4" />}
                  fullWidth
                >
                  Add example from my {voiceType === "reply" ? "replies" : "posts"}
                </Button>
              </CardContent>
            </Card>

          </div>
        </div>
      )}

      {/* Inspiration Picker Modal — portaled to body to escape CSS containment */}
      {inspirationPickerOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.6)", padding: 16 }} onClick={() => setInspirationPickerOpen(false)}>
          <div className="w-full flex flex-col rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] shadow-2xl" style={{ maxWidth: 768, maxHeight: "85vh" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-[var(--color-border-subtle)]" style={{ flexShrink: 0 }}>
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Add inspiration</h3>
                <p className="text-xs text-[var(--color-text-muted)]">choose from saved inspirations</p>
              </div>
              <button
                onClick={() => setInspirationPickerOpen(false)}
                className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col" style={{ padding: 16, gap: 12, overflow: "hidden", minHeight: 0 }}>
              <input
                value={inspirationSearch}
                onChange={(e) => setInspirationSearch(e.target.value)}
                placeholder="Search..."
                className="w-full h-9 px-3 text-sm bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] rounded-lg"
                style={{ flexShrink: 0 }}
              />

              <div style={{ overflowY: "auto", minHeight: 0 }} className="space-y-2 pr-1">
                {inspirations
                  .filter((p) => !(voiceType === "reply" ? p.include_in_reply_voice : p.include_in_post_voice))
                  .filter((p) => {
                    if (!inspirationSearch.trim()) return true;
                    const q = inspirationSearch.toLowerCase();
                    return (
                      (p.raw_content || "").toLowerCase().includes(q) ||
                      (p.author_handle || "").toLowerCase().includes(q)
                    );
                  })
                  .slice(0, 60)
                  .map((post) => (
                    <button
                      key={post.id}
                      onClick={async () => {
                        await setInspirationIncluded(post.id, true);
                        setInspirationPickerOpen(false);
                      }}
                      className="picker-item w-full text-left p-3 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)]"
                    >
                      <div className="flex items-center justify-between gap-3 mb-1">
                        <div className="flex items-center gap-2">
                          {post.author_handle && (
                            <span className="text-xs text-[var(--color-text-muted)]">
                              {post.author_handle.startsWith("@") ? post.author_handle : `@${post.author_handle}`}
                            </span>
                          )}
                          <span className="text-xs text-[var(--color-text-muted)]">
                            {new Date(post.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <span className="text-xs text-[var(--color-text-muted)]">click to include</span>
                      </div>
                      <p className="text-sm text-[var(--color-text-secondary)] line-clamp-3">{post.raw_content}</p>
                    </button>
                  ))}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Example Picker Modal — portaled to body to escape CSS containment */}
      {examplePickerOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.6)", padding: 16 }} onClick={() => setExamplePickerOpen(false)}>
          <div className="w-full flex flex-col rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] shadow-2xl" style={{ maxWidth: 768, maxHeight: "85vh" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-[var(--color-border-subtle)]" style={{ flexShrink: 0 }}>
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Add voice example</h3>
                <p className="text-xs text-[var(--color-text-muted)]">pick from your analytics CSV</p>
              </div>
              <button
                onClick={() => setExamplePickerOpen(false)}
                className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col" style={{ padding: 16, gap: 12, overflow: "hidden", minHeight: 0 }}>
              <input
                value={exampleSearch}
                onChange={(e) => setExampleSearch(e.target.value)}
                placeholder="Search..."
                className="w-full h-9 px-3 text-sm bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] rounded-lg"
                style={{ flexShrink: 0 }}
              />

              {loadingAnalyticsPosts ? (
                <div className="h-10 skeleton" />
              ) : (
                <div style={{ overflowY: "auto", minHeight: 0 }} className="space-y-2 pr-1">
                  {analyticsPosts
                    .filter((p) => (voiceType === "reply" ? p.is_reply : !p.is_reply))
                    .filter((p) => {
                      if (!exampleSearch.trim()) return true;
                      const q = exampleSearch.toLowerCase();
                      return (p.text || "").toLowerCase().includes(q);
                    })
                    .sort((a, b) => (b.impressions || 0) - (a.impressions || 0))
                    .slice(0, 60)
                    .map((p) => (
                      <button
                        key={p.id}
                        onClick={async () => {
                          await addExampleFromText(p.text);
                          setExamplePickerOpen(false);
                        }}
                        className="picker-item w-full text-left p-3 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)]"
                      >
                        <div className="flex items-center justify-between gap-3 mb-1">
                          <span className="text-xs text-[var(--color-text-muted)]">{p.is_reply ? "reply" : "post"}</span>
                          <span className="text-xs text-[var(--color-text-muted)]">{(p.impressions || 0).toLocaleString()} impressions</span>
                        </div>
                        <p className="text-sm text-[var(--color-text-secondary)] line-clamp-3 whitespace-pre-line">{p.text}</p>
                      </button>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
