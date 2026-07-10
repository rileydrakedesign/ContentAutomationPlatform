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
  Brain,
} from "lucide-react";
import { VoiceEditorView } from "./editor/VoiceEditorView";
import { NicheProfileTab } from "./NicheProfileTab";
import { TraitCardsPanel } from "./TraitCardsPanel";

type ViewMode = "settings" | "editor" | "niche";

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
      const posts = (json.data?.posts || []) as Array<{ id: string; text: string; is_reply?: boolean; impressions?: number; engagement_score?: number }>;
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
              flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-100 cursor-pointer
              ${voiceType === "post"
                ? "bg-[var(--color-accent-500)] text-[var(--color-text-inverse)]"
                : "text-[var(--color-text-inverse)] hover:text-[var(--color-text-inverse)] hover:bg-[var(--color-bg-elevated)]"
              }
            `}
          >
            <FileText className="w-4 h-4" />
            Post Voice
          </button>
          <button
            onClick={() => setVoiceType("reply")}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-100 cursor-pointer
              ${voiceType === "reply"
                ? "bg-[var(--color-accent-500)] text-[var(--color-text-inverse)]"
                : "text-[var(--color-text-inverse)] hover:text-[var(--color-text-inverse)] hover:bg-[var(--color-bg-elevated)]"
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
              flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-100 cursor-pointer
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
              flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-100 cursor-pointer
              ${viewMode === "editor"
                ? "bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)]"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              }
            `}
          >
            <MessageCircle className="w-4 h-4" />
            Refine
          </button>
          <button
            onClick={() => setViewMode("niche")}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-100 cursor-pointer
              ${viewMode === "niche"
                ? "bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)]"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              }
            `}
          >
            <Brain className="w-4 h-4" />
            Niche
          </button>
        </div>
      </div>

      {/* Conditional Content */}
      {viewMode === "editor" ? (
        <VoiceEditorView settings={s} voiceType={voiceType} onSettingsUpdate={updateSettings} />
      ) : viewMode === "niche" ? (
        <NicheProfileTab
          voiceType={voiceType}
          useNicheContext={s.use_niche_context ?? true}
          onToggle={(enabled) => updateSettings({ use_niche_context: enabled })}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left Column - 3/5 width */}
          <div className="lg:col-span-3 space-y-6">
            {/* Derived voice traits — the §4.3 front door: the voice is
                learned from the user's top posts, not configured. */}
            <TraitCardsPanel
              settings={s}
              exampleTexts={examples.map((e) => e.content_text)}
              voiceType={voiceType}
              onApplyPatch={updateSettings}
            />

            {/* Special Instructions */}
            <Card>
              <CardContent>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-[var(--color-warning-500)]/10 flex items-center justify-center">
                    <StickyNote className="w-4 h-4 text-[var(--color-warning-400)]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                      Anything the coach should know
                    </h3>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      Rules of your voice we can&apos;t see in the data
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
                  placeholder="e.g. Never mention competitors by name. Always write in first person."
                  rows={4}
                  className="w-full px-3 py-2 text-sm resize-none"
                />
              </CardContent>
            </Card>

            {/* Advanced — the raw dials the trait cards set for you. Backstage
                per PRD §4.3: available, never the front door. */}
            <details className="group rounded-2xl border border-[var(--color-border-subtle)]">
              <summary className="cursor-pointer list-none px-5 py-4 flex items-center justify-between text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors">
                <span className="flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  Advanced — manual dials
                </span>
                <span className="text-xs text-[var(--color-text-muted)] group-open:hidden">
                  The trait cards above set these for you
                </span>
              </summary>
              <div className="px-5 pb-5 space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-6">
                    <div className="w-8 h-8 rounded-lg bg-[var(--color-accent-500)]/10 flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-[var(--color-accent-400)]" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                        Voice dials
                      </h3>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        Manual override — the derived traits keep these honest
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
                </div>
                {/* The per-user AI-model picker was removed with the assistant
                    overhaul — provider selection is a platform decision now
                    (LIVE_READ_PROVIDER env + resolveProvider), not a voice
                    setting. */}
              </div>
            </details>
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
                      Lines your voice never crosses
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
                      {voiceType === "reply" ? "Replies" : "Posts"} that represent your style —
                      the corpus your traits are derived from
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
