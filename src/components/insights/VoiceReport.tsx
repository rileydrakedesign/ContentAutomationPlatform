"use client";

import { Card } from "@/components/ui/Card";
import {
  Compass,
  Sparkles,
  TrendingUp,
  CalendarDays,
  Info,
  Check,
} from "lucide-react";
import type { NichePositioning } from "@/types/niche";

export interface VoiceReportData {
  niche_summary: string | null;
  positioning: NichePositioning | null;
  content_pillars: string[];
  top_patterns: {
    id: string;
    pattern_type: string;
    pattern_name: string;
    pattern_value: string;
    multiplier: number;
    sample_count: number;
  }[];
  top_posts: {
    text: string;
    engagement_score: number;
    impressions: number;
  }[];
  cadence: {
    posts_last_28_days: number;
    avg_posts_per_week: number;
    target_posts_per_week: number | null;
    pillar_targets: { pillar: string; posts_per_week: number }[];
  };
  recurring_deviations?: {
    category: string;
    occurrences: number;
    suggestion: string;
  }[];
  feedback_themes?: {
    likes: number;
    dislikes: number;
    recent_disliked: string[];
    recent_liked: string[];
  };
  inspiration_alignment?: {
    total: number;
    aligned: number;
    note: string;
  };
  context_freshness?: {
    analytics_updated_at: string | null;
    examples_refreshed_at: string | null;
    patterns_extracted_at: string | null;
    niche_analyzed_at: string | null;
    stale_components: string[];
    retune_recommended: boolean;
  };
  steps: {
    examples_updated: number;
    patterns_extracted: number;
    pattern_extraction_skipped: string | null;
    posts_analyzed: number;
  };
}

function truncate(text: string, max = 180): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + "…";
}

export function VoiceReport({ report }: { report: VoiceReportData }) {
  const {
    niche_summary,
    positioning,
    content_pillars,
    top_patterns,
    top_posts,
    cadence,
    recurring_deviations,
    feedback_themes,
    inspiration_alignment,
    context_freshness,
    steps,
  } = report;

  return (
    <Card className="p-5 space-y-6">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-[var(--color-primary-500)]/10 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-[var(--color-primary-400)]" />
        </div>
        <h3 className="font-semibold text-[var(--color-text-primary)]">Voice Report</h3>
      </div>

      {/* Niche summary + positioning */}
      {(niche_summary || positioning) && (
        <div className="space-y-3">
          {niche_summary && (
            <p className="text-sm text-[var(--color-text-secondary)]">{niche_summary}</p>
          )}
          {positioning && (
            <div className="p-4 rounded-lg bg-[var(--color-primary-500)]/5 border border-[var(--color-primary-500)]/20 space-y-2">
              <div className="flex items-start gap-2">
                <Compass className="w-4 h-4 text-[var(--color-primary-400)] mt-0.5 shrink-0" />
                <p className="text-sm font-medium text-[var(--color-text-primary)]">
                  {positioning.positioning_statement}
                </p>
              </div>
              <div className="space-y-1 pl-6">
                <p className="text-xs text-[var(--color-text-secondary)]">
                  <span className="text-[var(--color-text-muted)]">Audience:</span>{" "}
                  {positioning.target_audience}
                </p>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  <span className="text-[var(--color-text-muted)]">Angle:</span>{" "}
                  {positioning.unique_angle}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Content pillars */}
      {content_pillars.length > 0 && (
        <div>
          <h4 className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)] mb-2">
            Content Pillars
          </h4>
          <div className="flex flex-wrap gap-2">
            {content_pillars.map((pillar) => (
              <span
                key={pillar}
                className="px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--color-primary-500)]/10 text-[var(--color-primary-400)] border border-[var(--color-primary-500)]/20"
              >
                {pillar}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Top patterns */}
      {top_patterns.length > 0 && (
        <div>
          <h4 className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)] mb-2">
            Top Patterns
          </h4>
          <div className="space-y-2">
            {top_patterns.slice(0, 5).map((pattern) => (
              <div
                key={pattern.id}
                className="flex items-start justify-between gap-3 p-3 rounded-lg bg-[var(--color-bg-elevated)]/50 border border-[var(--color-border-default)]"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[var(--color-text-primary)]">
                      {pattern.pattern_name}
                    </span>
                    <span className="px-2 py-0.5 bg-green-500/10 text-green-400 rounded-full text-xs font-medium shrink-0">
                      {pattern.multiplier.toFixed(1)}x
                    </span>
                  </div>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                    {pattern.pattern_value}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">
                    {pattern.sample_count} samples
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top posts */}
      {top_posts.length > 0 && (
        <div>
          <h4 className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)] mb-2">
            Top Posts
          </h4>
          <div className="space-y-2">
            {top_posts.map((post, i) => (
              <div
                key={i}
                className="p-3 rounded-lg bg-[var(--color-bg-elevated)]/50 border border-[var(--color-border-default)]"
              >
                <p className="text-sm text-[var(--color-text-secondary)]">
                  {truncate(post.text)}
                </p>
                <div className="flex items-center gap-3 mt-2 text-xs text-[var(--color-text-muted)]">
                  <span className="flex items-center gap-1">
                    <TrendingUp className="w-3 h-3 text-green-400" />
                    {Math.round(post.engagement_score).toLocaleString()} engagement
                  </span>
                  <span>{post.impressions.toLocaleString()} impressions</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cadence */}
      <div>
        <h4 className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)] mb-2">
          Posting Cadence
        </h4>
        <div className="p-3 rounded-lg bg-[var(--color-bg-elevated)]/50 border border-[var(--color-border-default)]">
          <div className="flex items-center gap-2 text-sm text-[var(--color-text-primary)]">
            <CalendarDays className="w-4 h-4 text-[var(--color-primary-400)]" />
            <span className="font-medium">
              {cadence.avg_posts_per_week.toFixed(1)} posts/week
            </span>
            {cadence.target_posts_per_week !== null && (
              <span className="text-[var(--color-text-muted)]">
                vs {cadence.target_posts_per_week}/week target
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            {cadence.posts_last_28_days} posts in the last 28 days
          </p>
          {cadence.pillar_targets.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {cadence.pillar_targets.map((target) => (
                <span
                  key={target.pillar}
                  className="px-2 py-0.5 rounded-full text-xs bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)] border border-[var(--color-border-default)]"
                >
                  {target.pillar}: {target.posts_per_week}/wk
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recurring voice drift */}
      {recurring_deviations && recurring_deviations.length > 0 && (
        <div>
          <h4 className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)] mb-2">
            Recurring Voice Drift
          </h4>
          <div className="space-y-2">
            {recurring_deviations.map((deviation, i) => (
              <div
                key={i}
                className="p-3 rounded-lg bg-[var(--color-bg-elevated)]/50 border border-[var(--color-border-default)]"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--color-text-muted)]">
                    {deviation.category}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-xs bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)] border border-[var(--color-border-default)] shrink-0">
                    seen {deviation.occurrences}x
                  </span>
                </div>
                <p className="text-sm font-medium text-[var(--color-text-primary)] mt-1">
                  {deviation.suggestion}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Generation feedback */}
      {feedback_themes && feedback_themes.likes + feedback_themes.dislikes > 0 && (
        <div>
          <h4 className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)] mb-2">
            Generation Feedback
          </h4>
          <div className="p-3 rounded-lg bg-[var(--color-bg-elevated)]/50 border border-[var(--color-border-default)]">
            <p className="text-sm text-[var(--color-text-primary)]">
              {feedback_themes.likes} liked · {feedback_themes.dislikes} disliked
            </p>
            {feedback_themes.recent_disliked.length > 0 && (
              <div className="mt-2">
                <p className="text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                  Recently disliked
                </p>
                <ul className="space-y-1">
                  {feedback_themes.recent_disliked.map((snippet, i) => (
                    <li key={i} className="text-xs text-[var(--color-text-muted)]">
                      {snippet}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Inspiration alignment */}
      {inspiration_alignment && (
        <div>
          <h4 className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)] mb-2">
            Inspiration Alignment
          </h4>
          <div className="p-3 rounded-lg bg-[var(--color-bg-elevated)]/50 border border-[var(--color-border-default)]">
            <div className="flex items-start gap-2">
              <p className="text-sm text-[var(--color-text-secondary)]">
                {inspiration_alignment.note}
              </p>
              {inspiration_alignment.total > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-primary-500)]/10 text-[var(--color-primary-400)] border border-[var(--color-primary-500)]/20 shrink-0">
                  {inspiration_alignment.aligned}/{inspiration_alignment.total}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* What ran */}
      <div className="pt-3 border-t border-[var(--color-border-default)]">
        <p className="text-xs text-[var(--color-text-muted)]">
          Analyzed {steps.posts_analyzed} posts · {steps.examples_updated} voice examples updated ·{" "}
          {steps.patterns_extracted} patterns extracted
        </p>
        {steps.pattern_extraction_skipped && (
          <p className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] mt-1">
            <Info className="w-3 h-3 shrink-0" />
            Pattern extraction skipped: {steps.pattern_extraction_skipped}
          </p>
        )}
        {context_freshness && !context_freshness.retune_recommended && (
          <p className="flex items-center gap-1.5 text-xs text-green-400 mt-1">
            <Check className="w-3 h-3 shrink-0" />
            Context up to date with your latest analytics
          </p>
        )}
      </div>
    </Card>
  );
}
