"use client";

import { useState, useEffect, useRef } from "react";
import { Brain, RefreshCw, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { NicheProfile, TopicCluster } from "@/types/niche";
import { VoiceType } from "@/types/voice";

interface NicheProfileTabProps {
  voiceType: VoiceType;
  useNicheContext: boolean;
  onToggle: (enabled: boolean) => void;
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function ClusterBar({ cluster }: { cluster: TopicCluster }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">
            {cluster.name}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0 text-xs text-[var(--color-text-muted)]">
          <span>{cluster.post_count} posts</span>
          <span>{cluster.avg_engagement.toLocaleString()} eng</span>
          <span className="w-8 text-right">{cluster.share_pct}%</span>
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-[var(--color-bg-elevated)] overflow-hidden">
        <div
          className="h-full rounded-full bg-[var(--color-primary-500)]"
          style={{ width: `${Math.min(cluster.share_pct, 100)}%` }}
        />
      </div>
      {cluster.keywords.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-0.5">
          {cluster.keywords.slice(0, 6).map((kw) => (
            <span
              key={kw}
              className="px-1.5 py-0.5 text-[10px] rounded bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] border border-[var(--color-border-subtle)]"
            >
              {kw}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function NicheProfileTab({ voiceType, useNicheContext, onToggle }: NicheProfileTabProps) {
  const [profile, setProfile] = useState<NicheProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [summary, setSummary] = useState("");
  const summaryFocused = useRef(false);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/niche/profile");
      if (res.ok) {
        const data = await res.json();
        setProfile(data.profile);
      }
    } catch (err) {
      console.error("Failed to fetch niche profile:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    if (!summaryFocused.current) {
      setSummary(profile?.niche_summary || "");
    }
  }, [profile?.niche_summary]);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const res = await fetch("/api/niche/analyze", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setAnalyzeError(data.error || "Analysis failed");
      } else {
        setProfile(data.profile);
      }
    } catch {
      setAnalyzeError("Analysis failed — please try again");
    } finally {
      setAnalyzing(false);
    }
  };

  const saveSummary = async (value: string) => {
    if (!profile) return;
    const trimmed = value.trim();
    if (trimmed === (profile.niche_summary || "")) return;
    try {
      const res = await fetch("/api/niche/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niche_summary: trimmed || null }),
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data.profile);
      }
    } catch (err) {
      console.error("Failed to save niche summary:", err);
    }
  };

  const sortedClusters = profile
    ? [...profile.topic_clusters].sort((a, b) => b.avg_engagement - a.avg_engagement)
    : [];

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 skeleton w-48" />
        <div className="h-32 skeleton" />
        <div className="h-24 skeleton" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-primary-500)]/10 flex items-center justify-center">
            <Brain className="w-4 h-4 text-[var(--color-primary-400)]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Niche Memory
            </h3>
            <p className="text-xs text-[var(--color-text-muted)]">
              AI understanding of your content identity
            </p>
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleAnalyze}
          disabled={analyzing}
          icon={<RefreshCw className={`w-4 h-4 ${analyzing ? "animate-spin" : ""}`} />}
        >
          {analyzing ? "Analysing…" : profile ? "Re-analyse" : "Analyse"}
        </Button>
      </div>

      {analyzeError && (
        <div className="px-4 py-3 rounded-lg border border-[var(--color-danger-500)]/40 bg-[var(--color-danger-500)]/10 text-sm text-[var(--color-danger-400)]">
          {analyzeError}
        </div>
      )}

      {/* Empty state */}
      {!profile && !analyzeError && (
        <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] p-8 text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[var(--color-primary-500)]/10 flex items-center justify-center">
            <Brain className="w-6 h-6 text-[var(--color-primary-400)]" />
          </div>
          <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">
            No niche profile yet
          </h4>
          <p className="text-xs text-[var(--color-text-muted)] max-w-xs mx-auto mb-4">
            Run an analysis to discover your content niche, top topics, and how they inform your AI-generated content.
          </p>
          <Button
            variant="primary"
            size="sm"
            onClick={handleAnalyze}
            disabled={analyzing}
            icon={<Brain className="w-4 h-4" />}
          >
            {analyzing ? "Analysing…" : "Analyse my niche"}
          </Button>
        </div>
      )}

      {/* Profile content */}
      {profile && (
        <>
          {/* Niche summary */}
          <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
                Niche Summary
              </span>
              <span className="text-[10px] text-[var(--color-text-muted)]">· editable</span>
            </div>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              onFocus={() => { summaryFocused.current = true; }}
              onBlur={() => {
                summaryFocused.current = false;
                saveSummary(summary);
              }}
              rows={3}
              placeholder="Describe your content niche…"
              className="w-full px-3 py-2 text-sm resize-none"
            />
          </div>

          {/* Content pillars */}
          {profile.content_pillars.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
                Content Pillars
              </span>
              <div className="flex flex-wrap gap-2">
                {profile.content_pillars.map((pillar) => (
                  <span
                    key={pillar}
                    className="px-3 py-1 text-xs font-medium rounded-full bg-[var(--color-primary-500)]/10 text-[var(--color-primary-400)] border border-[var(--color-primary-500)]/20"
                  >
                    {pillar}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Topic clusters */}
          {sortedClusters.length > 0 && (
            <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4 space-y-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[var(--color-text-muted)]" />
                <span className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
                  Topic Clusters
                </span>
              </div>
              <div className="space-y-5">
                {sortedClusters.map((cluster, i) => (
                  <ClusterBar key={i} cluster={cluster} />
                ))}
              </div>
            </div>
          )}

          {/* Use in prompts toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)]">
            <div>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">
                Use niche context in prompts
              </p>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                Injects your niche summary into AI generation for {voiceType === "reply" ? "replies" : "posts"}
              </p>
            </div>
            <button
              onClick={() => onToggle(!useNicheContext)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                useNicheContext ? "bg-[var(--color-primary-500)]" : "bg-[var(--color-bg-elevated)]"
              }`}
              style={{ border: "1px solid var(--color-border-default)" }}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${
                  useNicheContext ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Footer metadata */}
          <p className="text-xs text-[var(--color-text-muted)] text-center">
            Last analysed {formatRelativeTime(profile.last_analyzed_at || profile.updated_at)}
            {" · "}
            {profile.total_posts_analyzed} posts analysed
          </p>
        </>
      )}
    </div>
  );
}
