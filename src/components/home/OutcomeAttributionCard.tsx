"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { TrendingUp, TrendingDown, BarChart3 } from "lucide-react";
import { apiFetch } from "@/lib/utils/apiFetch";

interface Attribution {
  assisted: { count: number; avg_engagement: number };
  baseline: { count: number; avg_engagement: number };
  lift_pct: number | null;
  has_enough_data: boolean;
}

/**
 * "Did Agents For X actually grow me?" — the ROI proof that justifies the
 * subscription (Gap #4). Renders nothing until there's enough data to compare
 * honestly, so it never lies.
 */
export function OutcomeAttributionCard({ className }: { className?: string }) {
  const [data, setData] = useState<Attribution | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<Attribution>("/api/insights/attribution")
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Honest: only show once both groups have enough refreshed posts to compare.
  if (!data || !data.has_enough_data || data.lift_pct === null) return null;

  const positive = data.lift_pct >= 0;

  return (
    <Card className={className}>
      <CardContent>
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-4 h-4 text-[var(--color-primary-400)]" />
          <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
            Is it working?
          </h3>
        </div>

        <div className="flex items-baseline gap-2">
          <span
            className={`text-2xl font-semibold ${
              positive ? "text-[var(--color-success-400)]" : "text-[var(--color-text-secondary)]"
            }`}
          >
            {positive ? "+" : ""}
            {data.lift_pct}%
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-[var(--color-text-secondary)]">
            {positive ? (
              <TrendingUp className="w-3.5 h-3.5 text-[var(--color-success-400)]" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5" />
            )}
            engagement vs. your baseline
          </span>
        </div>

        <p className="text-xs text-[var(--color-text-muted)] mt-2">
          Your {data.assisted.count} posts written with Agents For X average{" "}
          {data.assisted.avg_engagement.toLocaleString()} weighted engagement vs.{" "}
          {data.baseline.avg_engagement.toLocaleString()} across {data.baseline.count}{" "}
          baseline posts.
        </p>
      </CardContent>
    </Card>
  );
}
