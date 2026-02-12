"use client";

import { useState, useEffect } from "react";
import type { DayOfWeekAnalytics, DayOfWeekStats } from "@/types/analytics";

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getBarColor(value: number, isBest: boolean): string {
  if (isBest) return "rgb(99, 102, 241)"; // indigo-500
  if (value === 0) return "rgba(255,255,255,0.05)";
  // scale from muted to bright
  const alpha = 0.2 + value * 0.6;
  return `rgba(99, 102, 241, ${alpha})`;
}

function ConfidenceDot({ confidence }: { confidence: "high" | "medium" | "low" }) {
  const color = confidence === "high" ? "bg-teal-400" : confidence === "medium" ? "bg-yellow-400" : "bg-slate-500";
  return <span className={`inline-block w-1.5 h-1.5 rounded-full ${color}`} />;
}

function DayDetail({ day }: { day: DayOfWeekStats }) {
  return (
    <div className="grid grid-cols-4 gap-3 text-center">
      <div>
        <p className="text-xs text-slate-500">Avg Impressions</p>
        <p className="text-sm font-medium text-white">{day.avgImpressions.toLocaleString()}</p>
      </div>
      <div>
        <p className="text-xs text-slate-500">Avg Likes</p>
        <p className="text-sm font-medium text-white">{day.avgLikes}</p>
      </div>
      <div>
        <p className="text-xs text-slate-500">Avg Reposts</p>
        <p className="text-sm font-medium text-white">{day.avgReposts}</p>
      </div>
      <div>
        <p className="text-xs text-slate-500">Avg Replies</p>
        <p className="text-sm font-medium text-white">{day.avgReplies}</p>
      </div>
    </div>
  );
}

export function BestTimesSection() {
  const [analytics, setAnalytics] = useState<DayOfWeekAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const res = await fetch("/api/analytics/best-times");
        if (!res.ok) throw new Error("Failed to fetch analytics");
        const data: DayOfWeekAnalytics = await res.json();
        setAnalytics(data);
        if (data.bestDay) setSelectedDay(data.bestDay.dayOfWeek);
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
          <div className="h-5 bg-slate-800 rounded w-48 mb-4" />
          <div className="flex gap-2 items-end h-32 mb-4">
            {[65, 45, 80, 55, 70, 90, 50].map((h, i) => (
              <div key={i} className="flex-1 bg-slate-800 rounded" style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-white mb-2">Best Days to Post</h2>
        <p className="text-red-400 text-sm">Failed to load analytics: {error}</p>
      </div>
    );
  }

  if (!analytics || !analytics.hasEnoughData) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-white mb-2">Best Days to Post</h2>
        <p className="text-slate-500 text-sm">
          Not enough data yet. Upload your analytics CSV with at least 5 posts to see day-of-week performance.
        </p>
      </div>
    );
  }

  const { days, bestDay, totalPostsAnalyzed } = analytics;
  const activeDayData = selectedDay !== null ? days[selectedDay] : null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-white">Best Days to Post</h2>
          {bestDay && (
            <p className="text-xs text-slate-500 mt-0.5">
              {bestDay.dayName}s perform best with {bestDay.avgImpressions.toLocaleString()} avg impressions
            </p>
          )}
        </div>
        <span className="text-xs text-slate-500">
          {totalPostsAnalyzed} posts analyzed
        </span>
      </div>

      {/* Bar chart */}
      <div className="flex gap-2 items-end" style={{ height: 120 }}>
        {days.map((day) => {
          const isBest = bestDay?.dayOfWeek === day.dayOfWeek;
          const isSelected = selectedDay === day.dayOfWeek;
          const barHeight = Math.max(day.value * 100, day.postCount > 0 ? 8 : 4);

          return (
            <button
              key={day.dayOfWeek}
              onClick={() => setSelectedDay(isSelected ? null : day.dayOfWeek)}
              className="flex-1 flex flex-col items-center justify-end gap-1 group"
              style={{ height: "100%" }}
            >
              {/* Post count label */}
              <span className="text-[10px] text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">
                {day.postCount}
              </span>
              {/* Bar */}
              <div
                className="w-full rounded-t transition-all"
                style={{
                  height: `${barHeight}%`,
                  backgroundColor: getBarColor(day.value, isBest),
                  outline: isSelected ? "1.5px solid rgba(99,102,241,0.7)" : "none",
                  outlineOffset: 1,
                }}
              />
            </button>
          );
        })}
      </div>

      {/* Day labels */}
      <div className="flex gap-2 mt-1.5 mb-3">
        {days.map((day) => {
          const isBest = bestDay?.dayOfWeek === day.dayOfWeek;
          const isSelected = selectedDay === day.dayOfWeek;
          return (
            <div
              key={day.dayOfWeek}
              className={`flex-1 text-center text-xs ${
                isSelected ? "text-indigo-400 font-medium" : isBest ? "text-white" : "text-slate-500"
              }`}
            >
              {DAY_SHORT[day.dayOfWeek]}
            </div>
          );
        })}
      </div>

      {/* Selected day detail */}
      {activeDayData && activeDayData.postCount > 0 && (
        <div className="pt-3 border-t border-slate-800">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium text-white">{activeDayData.dayName}</span>
            <ConfidenceDot confidence={activeDayData.confidence} />
            <span className="text-[10px] text-slate-500">
              {activeDayData.postCount} post{activeDayData.postCount !== 1 ? "s" : ""} · {activeDayData.confidence} confidence
            </span>
          </div>
          <DayDetail day={activeDayData} />
        </div>
      )}
    </div>
  );
}
