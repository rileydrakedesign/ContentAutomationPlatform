"use client";

import { useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { formatNumber } from "@/lib/utils/formatting";
import type { PostAnalytics } from "@/types/analytics";

interface FunnelStage {
  label: string;
  value: number;
  conversionPct: number | null; // null for first stage
  color: string;
}

const STAGE_COLORS = [
  "rgb(129, 140, 248)", // indigo-400
  "rgb(99, 102, 241)",  // indigo-500
  "rgb(79, 70, 229)",   // indigo-600
  "rgb(67, 56, 202)",   // indigo-700
  "rgb(55, 48, 163)",   // indigo-800
  "rgb(49, 46, 129)",   // indigo-900
  "rgb(40, 37, 105)",   // deeper
];

const STAGE_DEFS: { key: keyof PostAnalytics; label: string }[] = [
  { key: "impressions", label: "Impressions" },
  { key: "detail_expands", label: "Detail Expands" },
  { key: "likes", label: "Likes" },
  { key: "replies", label: "Replies" },
  { key: "reposts", label: "Reposts" },
  { key: "profile_visits", label: "Profile Visits" },
  { key: "new_follows", label: "New Follows" },
];

interface Props {
  posts: PostAnalytics[];
}

export function EngagementFunnel({ posts }: Props) {
  const stages = useMemo(() => {
    const nonReplies = posts.filter((p) => !p.is_reply);
    if (nonReplies.length === 0) return [];

    // Sum each field across all posts
    const sums: { key: string; label: string; total: number }[] = STAGE_DEFS.map((def) => ({
      key: def.key,
      label: def.label,
      total: nonReplies.reduce((s, p) => s + ((p[def.key] as number) || 0), 0),
    }));

    // Filter out stages where sum = 0
    const nonZero = sums.filter((s) => s.total > 0);
    if (nonZero.length < 2) return [];

    const maxVal = nonZero[0].total; // impressions should be largest

    const result: FunnelStage[] = nonZero.map((s, i) => ({
      label: s.label,
      value: s.total,
      conversionPct: i > 0 ? (s.total / nonZero[i - 1].total) * 100 : null,
      color: STAGE_COLORS[i % STAGE_COLORS.length],
    }));

    // Normalize bar widths relative to max
    return result.map((s) => ({
      ...s,
      widthPct: maxVal > 0 ? Math.max((s.value / maxVal) * 100, 3) : 0,
    }));
  }, [posts]);

  if (stages.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Engagement Funnel</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--color-text-tertiary)]">
            No post data available for funnel analysis
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Engagement Funnel</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2.5">
          {stages.map((stage) => (
            <div key={stage.label}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-[var(--color-text-secondary)]">{stage.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-[var(--color-text-primary)]">
                    {formatNumber(stage.value)}
                  </span>
                  {stage.conversionPct !== null && (
                    <span className="text-[10px] text-[var(--color-text-tertiary)]">
                      {stage.conversionPct < 0.1
                        ? "<0.1%"
                        : stage.conversionPct < 1
                          ? stage.conversionPct.toFixed(2) + "%"
                          : stage.conversionPct.toFixed(1) + "%"}
                    </span>
                  )}
                </div>
              </div>
              <div
                className="rounded-sm transition-all"
                style={{
                  width: `${stage.widthPct}%`,
                  height: 20,
                  backgroundColor: stage.color,
                }}
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
