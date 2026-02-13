"use client";

import { useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { weightedEngagement } from "@/lib/utils/engagement";
import type { PostAnalytics } from "@/types/analytics";

interface Bucket {
  label: string;
  range: string;
  posts: PostAnalytics[];
  avgEngagement: number;
}

const BUCKET_DEFS: { label: string; range: string; min: number; max: number }[] = [
  { label: "Short", range: "<100", min: 0, max: 99 },
  { label: "Medium", range: "100-200", min: 100, max: 200 },
  { label: "Long", range: "200-280", min: 201, max: 280 },
  { label: "Thread", range: "280+", min: 281, max: Infinity },
];

const MIN_TOTAL = 5;
const MIN_PER_BUCKET = 2;

interface Props {
  posts: PostAnalytics[];
}

export function PostLengthSweetSpot({ posts }: Props) {
  const { buckets, bestIdx, takeaway } = useMemo(() => {
    const nonReplies = posts.filter((p) => !p.is_reply);
    if (nonReplies.length < MIN_TOTAL) return { buckets: [], bestIdx: -1, takeaway: "" };

    const filled: Bucket[] = BUCKET_DEFS.map((def) => {
      const matching = nonReplies.filter(
        (p) => p.text.length >= def.min && p.text.length <= def.max
      );
      const avg =
        matching.length >= MIN_PER_BUCKET
          ? matching.reduce((s, p) => s + weightedEngagement(p as unknown as Record<string, number>), 0) / matching.length
          : 0;
      return { label: def.label, range: def.range, posts: matching, avgEngagement: avg };
    });

    const valid = filled.filter((b) => b.avgEngagement > 0);
    if (valid.length < 2) return { buckets: [], bestIdx: -1, takeaway: "" };

    let best = 0;
    for (let i = 1; i < filled.length; i++) {
      if (filled[i].avgEngagement > filled[best].avgEngagement) best = i;
    }

    const overallAvg =
      valid.reduce((s, b) => s + b.avgEngagement, 0) / valid.length;
    const pctAbove =
      overallAvg > 0
        ? Math.round(((filled[best].avgEngagement - overallAvg) / overallAvg) * 100)
        : 0;

    const msg =
      pctAbove > 0
        ? `${filled[best].label} posts get +${pctAbove}% more engagement than average`
        : `${filled[best].label} posts perform best overall`;

    return { buckets: filled, bestIdx: best, takeaway: msg };
  }, [posts]);

  if (buckets.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Post Length Sweet Spot</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--color-text-tertiary)]">
            Need 5+ posts with at least 2 buckets having 2+ posts each
          </p>
        </CardContent>
      </Card>
    );
  }

  const maxEng = Math.max(...buckets.map((b) => b.avgEngagement));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Post Length Sweet Spot</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Bars */}
        <div className="flex items-end gap-3" style={{ height: 140 }}>
          {buckets.map((b, i) => {
            const pct = maxEng > 0 ? (b.avgEngagement / maxEng) * 100 : 0;
            const isBest = i === bestIdx;
            return (
              <div key={b.label} className="flex-1 flex flex-col items-center gap-1.5" style={{ height: "100%", justifyContent: "flex-end" }}>
                {b.avgEngagement > 0 && (
                  <span className="text-xs text-[var(--color-text-secondary)]">
                    {Math.round(b.avgEngagement)}
                  </span>
                )}
                <div
                  className="w-full rounded-t transition-all"
                  style={{
                    height: `${Math.max(pct, b.avgEngagement > 0 ? 8 : 0)}%`,
                    backgroundColor: isBest
                      ? "rgb(99, 102, 241)"
                      : "rgba(99, 102, 241, 0.3)",
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* Labels */}
        <div className="flex gap-3 mt-2">
          {buckets.map((b, i) => (
            <div key={b.label} className="flex-1 text-center">
              <p className={`text-xs font-medium ${i === bestIdx ? "text-indigo-400" : "text-[var(--color-text-secondary)]"}`}>
                {b.label}
              </p>
              <p className="text-[10px] text-[var(--color-text-tertiary)]">{b.range} chars</p>
              <p className="text-[10px] text-[var(--color-text-tertiary)]">{b.posts.length} posts</p>
            </div>
          ))}
        </div>

        {/* Takeaway */}
        <p className="text-sm text-[var(--color-text-secondary)] mt-3 pt-3" style={{ borderTop: "1px solid var(--color-border-default)" }}>
          {takeaway}
        </p>
      </CardContent>
    </Card>
  );
}
