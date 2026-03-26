"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Sparkles, TrendingUp, Zap, ArrowRight } from "lucide-react";

interface Suggestion {
  id: string;
  type: "pattern" | "topic" | "action";
  title: string;
  description: string;
  impact: string;
  action?: string;
  patternId?: string;
}

interface Stats {
  totalPatterns: number;
  avgViews: number;
  avgLikes: number;
  postsAnalyzed: number;
}

const SUGGESTION_ICONS: Record<string, React.ReactNode> = {
  pattern: <Sparkles className="w-4 h-4" />,
  topic: <TrendingUp className="w-4 h-4" />,
  action: <Zap className="w-4 h-4" />,
};

const SUGGESTION_COLORS: Record<string, string> = {
  pattern: "bg-[var(--color-primary-500)]/10 text-[var(--color-primary-400)] border-[var(--color-primary-500)]/20",
  topic: "bg-[var(--color-success-500)]/10 text-[var(--color-success-400)] border-[var(--color-success-500)]/20",
  action: "bg-[var(--color-warning-500)]/10 text-[var(--color-warning-400)] border-[var(--color-warning-500)]/20",
};

export function PatternInsightsSection() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSuggestions() {
      try {
        const res = await fetch("/api/patterns/suggestions");
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data.suggestions || []);
          setStats(data.stats || null);
        }
      } catch (error) {
        console.error("Failed to fetch suggestions:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchSuggestions();
  }, []);

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-6 bg-[var(--color-bg-elevated)] rounded w-40 mb-3"></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="h-28 bg-[var(--color-bg-elevated)] rounded-lg"></div>
          <div className="h-28 bg-[var(--color-bg-elevated)] rounded-lg"></div>
        </div>
      </div>
    );
  }

  if (suggestions.length === 0) {
    return (
      <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] rounded-xl p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-[var(--color-primary-500)]/10 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-[var(--color-primary-400)]" />
          </div>
          <div>
            <h3 className="font-medium text-[var(--color-text-primary)]">Discover What Works</h3>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Save posts to unlock pattern insights
            </p>
          </div>
        </div>
        <p className="text-sm text-[var(--color-text-muted)] mb-4">
          Use the Chrome extension to save your posts and niche accounts. The AI will
          analyze them to find patterns that drive engagement.
        </p>
        <Link
          href="/insights"
          className="inline-flex items-center gap-2 text-sm text-[var(--color-primary-400)] hover:text-[var(--color-primary-300)] transition"
        >
          Go to Insights
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Pattern Insights</h2>
        <Link
          href="/insights?tab=patterns"
          className="text-sm text-[var(--color-primary-400)] hover:text-[var(--color-primary-300)] transition"
        >
          View All
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {suggestions.slice(0, 2).map((suggestion) => (
          <div
            key={suggestion.id}
            className={`p-4 rounded-lg border ${SUGGESTION_COLORS[suggestion.type]}`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                  {SUGGESTION_ICONS[suggestion.type]}
                </div>
                <span className="font-medium text-[var(--color-text-primary)]">{suggestion.title}</span>
              </div>
              <span className="text-xs font-semibold px-2 py-1 bg-white/10 rounded-full">
                {suggestion.impact}
              </span>
            </div>
            <p className="text-sm text-[var(--color-text-secondary)] mb-3 line-clamp-2">
              {suggestion.description}
            </p>
            {suggestion.action && (
              <Link
                href={
                  suggestion.type === "topic"
                    ? `/create?topic=${encodeURIComponent(suggestion.title.replace("Write about: ", ""))}`
                    : "/create"
                }
                className="inline-flex items-center gap-1 text-sm font-medium hover:underline"
              >
                {suggestion.action}
                <ArrowRight className="w-3 h-3" />
              </Link>
            )}
          </div>
        ))}
      </div>

      {stats && stats.totalPatterns > 0 && (
        <div className="mt-3 flex items-center gap-4 text-xs text-[var(--color-text-muted)]">
          <span>{stats.totalPatterns} patterns discovered</span>
          <span>{stats.postsAnalyzed} posts analyzed</span>
        </div>
      )}
    </div>
  );
}
