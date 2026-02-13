"use client";

import { useMemo } from "react";
import { CalendarDays, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { formatNumber } from "@/lib/utils/formatting";
import type { PostAnalytics } from "@/types/analytics";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface Props {
  posts: PostAnalytics[];
}

export function BestDayIndicator({ posts }: Props) {
  const result = useMemo(() => {
    const nonReplies = posts.filter((p) => !p.is_reply);
    if (nonReplies.length < 5) return null;

    // Group by day of week
    const byDay: Record<number, { total: number; count: number }> = {};
    for (const p of nonReplies) {
      const day = new Date(p.date).getDay();
      if (!byDay[day]) byDay[day] = { total: 0, count: 0 };
      byDay[day].total += p.impressions;
      byDay[day].count += 1;
    }

    let bestDay = -1;
    let bestAvg = 0;
    let totalAvgOthers = 0;
    let otherCount = 0;

    for (const [day, data] of Object.entries(byDay)) {
      const avg = data.total / data.count;
      if (avg > bestAvg) {
        bestDay = Number(day);
        bestAvg = avg;
      }
    }

    if (bestDay === -1) return null;

    for (const [day, data] of Object.entries(byDay)) {
      if (Number(day) !== bestDay) {
        totalAvgOthers += data.total / data.count;
        otherCount += 1;
      }
    }

    const avgOthers = otherCount > 0 ? totalAvgOthers / otherCount : 0;
    const pctAbove = avgOthers > 0 ? Math.round(((bestAvg - avgOthers) / avgOthers) * 100) : 0;

    return {
      dayName: DAY_NAMES[bestDay],
      avgImpressions: Math.round(bestAvg),
      pctAbove,
      postCount: byDay[bestDay].count,
    };
  }, [posts]);

  if (!result) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-full min-h-[160px]">
          <p className="text-sm text-[var(--color-text-tertiary)]">
            Need 5+ posts for best day analysis
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardContent className="flex flex-col justify-center h-full min-h-[160px] gap-3">
        <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
          <CalendarDays size={14} />
          <span className="text-xs font-medium uppercase tracking-wide">Best Day</span>
        </div>

        <div>
          <p className="text-2xl font-bold text-[var(--color-text-primary)]">{result.dayName}</p>
          <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
            {formatNumber(result.avgImpressions)} avg impressions
          </p>
        </div>

        {result.pctAbove > 0 && (
          <div className="flex items-center gap-1.5 text-teal-400">
            <TrendingUp size={14} />
            <span className="text-sm font-medium">+{result.pctAbove}% vs other days</span>
          </div>
        )}

        <p className="text-xs text-[var(--color-text-tertiary)]">
          Based on {result.postCount} post{result.postCount !== 1 ? "s" : ""}
        </p>
      </CardContent>
    </Card>
  );
}
