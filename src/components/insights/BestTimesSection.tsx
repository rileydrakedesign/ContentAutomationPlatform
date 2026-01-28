"use client";

import { useState, useEffect } from "react";
import type { PostingAnalytics, BestTimeRecommendation, HeatmapCell } from "@/types/analytics";

const DAY_ABBREVIATIONS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const KEY_HOURS = [6, 9, 12, 15, 18, 21]; // 6 AM, 9 AM, 12 PM, 3 PM, 6 PM, 9 PM

function formatHourShort(hour: number): string {
  if (hour === 0) return "12a";
  if (hour === 12) return "12p";
  if (hour < 12) return `${hour}a`;
  return `${hour - 12}p`;
}

function getConfidenceBadgeClass(confidence: "high" | "medium" | "low"): string {
  switch (confidence) {
    case "high":
      return "bg-teal-900/50 text-teal-400 border-teal-800";
    case "medium":
      return "bg-yellow-900/50 text-yellow-400 border-yellow-800";
    case "low":
      return "bg-slate-800 text-slate-400 border-slate-700";
  }
}

function getHeatmapColor(value: number): string {
  if (value === 0) return "bg-slate-800";
  if (value < 0.25) return "bg-amber-900/30";
  if (value < 0.5) return "bg-amber-800/50";
  if (value < 0.75) return "bg-amber-700/70";
  return "bg-amber-500";
}

interface HeatmapGridProps {
  data: HeatmapCell[];
}

function HeatmapGrid({ data }: HeatmapGridProps) {
  const dataMap = new Map<string, HeatmapCell>();
  for (const cell of data) {
    dataMap.set(`${cell.dayOfWeek}-${cell.hour}`, cell);
  }

  return (
    <div className="mt-4">
      <div className="flex gap-1">
        <div className="flex flex-col gap-1 pr-2">
          <div className="h-5" />
          {DAY_ABBREVIATIONS.map((day) => (
            <div key={day} className="h-8 flex items-center text-xs text-slate-500">
              {day}
            </div>
          ))}
        </div>

        <div className="flex-1">
          <div className="flex gap-1 mb-1">
            {KEY_HOURS.map((hour) => (
              <div
                key={hour}
                className="flex-1 text-center text-xs text-slate-500"
              >
                {formatHourShort(hour)}
              </div>
            ))}
          </div>

          {[0, 1, 2, 3, 4, 5, 6].map((day) => (
            <div key={day} className="flex gap-1 mb-1">
              {KEY_HOURS.map((hour) => {
                const cell = dataMap.get(`${day}-${hour}`);
                const value = cell?.value || 0;
                return (
                  <div
                    key={hour}
                    className={`flex-1 h-8 rounded ${getHeatmapColor(value)} transition-colors cursor-default`}
                    title={
                      cell
                        ? `${DAY_ABBREVIATIONS[day]} ${formatHourShort(hour)}: ${cell.postCount} post${cell.postCount !== 1 ? "s" : ""}`
                        : "No data"
                    }
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 mt-4 text-xs text-slate-500">
        <span>Lower engagement</span>
        <div className="flex gap-0.5">
          <div className="w-4 h-4 rounded bg-slate-800" />
          <div className="w-4 h-4 rounded bg-amber-900/30" />
          <div className="w-4 h-4 rounded bg-amber-800/50" />
          <div className="w-4 h-4 rounded bg-amber-700/70" />
          <div className="w-4 h-4 rounded bg-amber-500" />
        </div>
        <span>Higher engagement</span>
      </div>
    </div>
  );
}

interface TimeSlotCardProps {
  recommendation: BestTimeRecommendation;
  rank: number;
}

function TimeSlotCard({ recommendation, rank }: TimeSlotCardProps) {
  return (
    <div className="bg-slate-800 rounded-lg p-4">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 flex items-center justify-center rounded-full bg-slate-700 text-slate-300 text-sm font-medium">
            {rank}
          </span>
          <div>
            <p className="text-white font-medium">{recommendation.dayName}</p>
            <p className="text-slate-400 text-sm">{recommendation.timeDisplay}</p>
          </div>
        </div>
        <span
          className={`px-2 py-0.5 text-xs rounded border ${getConfidenceBadgeClass(recommendation.confidence)}`}
        >
          {recommendation.confidence}
        </span>
      </div>
      <div className="text-sm text-slate-500">
        Avg engagement: <span className="text-slate-300">{recommendation.avgEngagement}</span>
        <span className="mx-2">·</span>
        {recommendation.postCount} post{recommendation.postCount !== 1 ? "s" : ""}
      </div>
    </div>
  );
}

export function BestTimesSection() {
  const [analytics, setAnalytics] = useState<PostingAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const res = await fetch("/api/analytics/best-times");
        if (!res.ok) {
          throw new Error("Failed to fetch analytics");
        }
        const data: PostingAnalytics = await res.json();
        setAnalytics(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
        <div className="animate-pulse">
          <div className="h-6 bg-slate-800 rounded w-48 mb-4" />
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="h-24 bg-slate-800 rounded" />
            <div className="h-24 bg-slate-800 rounded" />
            <div className="h-24 bg-slate-800 rounded" />
          </div>
          <div className="h-48 bg-slate-800 rounded" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-white mb-2">Best Times to Post</h2>
        <p className="text-red-400">Failed to load analytics: {error}</p>
      </div>
    );
  }

  if (!analytics || !analytics.hasEnoughData) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-white mb-2">Best Times to Post</h2>
        <p className="text-slate-500">
          Not enough data yet. Capture at least 5 posts with timestamps to see posting time recommendations.
        </p>
        {analytics && analytics.totalPostsAnalyzed > 0 && (
          <p className="text-sm text-slate-600 mt-2">
            Currently analyzing {analytics.totalPostsAnalyzed} post{analytics.totalPostsAnalyzed !== 1 ? "s" : ""}.
          </p>
        )}
      </div>
    );
  }

  const topThree = analytics.bestTimes.slice(0, 3);
  const topTimesSummary = topThree
    .map((t) => `${t.dayName.slice(0, 3)} ${t.timeDisplay}`)
    .join(" · ");

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-white">Best Times to Post</h2>
        <span className="text-sm text-slate-500">
          Based on {analytics.totalPostsAnalyzed} posts
        </span>
      </div>

      {/* Top 3 recommendations */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {topThree.map((rec, index) => (
          <TimeSlotCard
            key={`${rec.dayOfWeek}-${rec.hour}`}
            recommendation={rec}
            rank={index + 1}
          />
        ))}
      </div>

      {/* Summary */}
      <div className="p-3 bg-slate-800 rounded-lg text-sm mb-4">
        <span className="text-slate-400">Top times: </span>
        <span className="text-white">{topTimesSummary}</span>
      </div>

      {/* Heatmap */}
      {analytics.heatmapData.length > 0 && (
        <div className="pt-4 border-t border-slate-800">
          <h3 className="text-sm font-medium text-slate-400 mb-2">Engagement Heatmap</h3>
          <HeatmapGrid data={analytics.heatmapData} />
        </div>
      )}
    </div>
  );
}
