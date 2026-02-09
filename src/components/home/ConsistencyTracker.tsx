"use client";

import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PostAnalytics } from "@/types/analytics";

interface ConsistencyTrackerProps {
  posts: PostAnalytics[];
  dateRange?: { start: string; end: string };
  className?: string;
}

function parsePostDate(dateStr: string): Date | null {
  // Handle format: "Thu, Jan 22, 2026"
  try {
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) return parsed;
  } catch {
    return null;
  }
  return null;
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDateKey(date: Date): string {
  return date.toISOString().split("T")[0];
}

export function ConsistencyTracker({ posts, dateRange, className }: ConsistencyTrackerProps) {
  const [weeksToShow, setWeeksToShow] = useState(4);

  // Build activity map from posts
  const activityMap = useMemo(() => {
    const map: Record<string, { posts: number; replies: number }> = {};

    posts.forEach((post) => {
      const date = parsePostDate(post.date);
      if (!date) return;

      const key = formatDateKey(date);
      if (!map[key]) {
        map[key] = { posts: 0, replies: 0 };
      }

      if (post.is_reply) {
        map[key].replies++;
      } else {
        map[key].posts++;
      }
    });

    return map;
  }, [posts]);

  // Generate weeks grid
  const weeksGrid = useMemo(() => {
    const weeks: { weekStart: Date; days: { date: Date; posts: number; replies: number }[] }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Start from most recent week
    let currentWeekStart = getWeekStart(today);

    for (let w = 0; w < weeksToShow; w++) {
      const days: { date: Date; posts: number; replies: number }[] = [];

      for (let d = 0; d < 7; d++) {
        const date = new Date(currentWeekStart);
        date.setDate(date.getDate() + d);

        const key = formatDateKey(date);
        const activity = activityMap[key] || { posts: 0, replies: 0 };

        days.push({
          date,
          posts: activity.posts,
          replies: activity.replies,
        });
      }

      weeks.unshift({ weekStart: new Date(currentWeekStart), days });
      currentWeekStart.setDate(currentWeekStart.getDate() - 7);
    }

    return weeks;
  }, [activityMap, weeksToShow]);

  // Calculate summary stats
  const summary = useMemo(() => {
    let totalPosts = 0;
    let totalReplies = 0;
    let currentStreak = 0;
    let tempStreak = 0;

    // Check from today backwards for streak
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 365; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      const key = formatDateKey(checkDate);
      const activity = activityMap[key];

      if (activity && (activity.posts > 0 || activity.replies > 0)) {
        tempStreak++;
      } else if (i > 0) {
        // Don't break streak on today if no activity yet
        break;
      }
    }
    currentStreak = tempStreak;

    // Count totals for displayed period
    weeksGrid.forEach((week) => {
      week.days.forEach((day) => {
        totalPosts += day.posts;
        totalReplies += day.replies;
      });
    });

    return { totalPosts, totalReplies, currentStreak };
  }, [activityMap, weeksGrid]);

  const dayLabels = ["S", "M", "T", "W", "T", "F", "S"];

  const getActivityLevel = (posts: number, replies: number): number => {
    const total = posts + replies;
    if (total === 0) return 0;
    if (total <= 2) return 1;
    if (total <= 5) return 2;
    if (total <= 10) return 3;
    return 4;
  };

  const getActivityColor = (level: number, hasPost: boolean, hasReply: boolean): string => {
    if (level === 0) return "bg-[var(--color-bg-elevated)]";

    // Posts are blue, replies are green, both is teal
    if (hasPost && hasReply) {
      const intensity = level === 1 ? "400/30" : level === 2 ? "400/50" : level === 3 ? "400/70" : "400";
      return `bg-teal-${intensity}`;
    }
    if (hasPost) {
      const intensity = level === 1 ? "400/30" : level === 2 ? "400/50" : level === 3 ? "400/70" : "400";
      return `bg-blue-${intensity}`;
    }
    if (hasReply) {
      const intensity = level === 1 ? "400/30" : level === 2 ? "400/50" : level === 3 ? "400/70" : "400";
      return `bg-emerald-${intensity}`;
    }
    return "bg-[var(--color-bg-elevated)]";
  };

  // Simpler color scheme using opacity
  const getCellStyle = (posts: number, replies: number): React.CSSProperties => {
    const total = posts + replies;
    if (total === 0) return {};

    const hasPost = posts > 0;
    const hasReply = replies > 0;

    // Determine base color
    let hue: number;
    if (hasPost && hasReply) {
      hue = 175; // Teal
    } else if (hasPost) {
      hue = 210; // Blue
    } else {
      hue = 160; // Green
    }

    // Intensity based on activity
    const intensity = Math.min(total / 10, 1);
    const lightness = 50 - intensity * 20;
    const saturation = 60 + intensity * 20;

    return {
      backgroundColor: `hsl(${hue}, ${saturation}%, ${lightness}%)`,
    };
  };

  const maxWeeks = dateRange ? Math.min(12, Math.ceil((new Date().getTime() - new Date(dateRange.start).getTime()) / (7 * 24 * 60 * 60 * 1000))) : 12;

  if (posts.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="py-6">
          <div className="text-center">
            <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-1">
              Consistency Tracker
            </h3>
            <p className="text-xs text-[var(--color-text-muted)]">
              Upload your analytics CSV to see your posting activity
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardContent className="h-full flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
              Consistency Tracker
            </h3>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              {summary.totalPosts} posts, {summary.totalReplies} replies
              {summary.currentStreak > 0 && (
                <span className="ml-2 text-amber-400">
                  🔥 {summary.currentStreak} day streak
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setWeeksToShow(Math.max(4, weeksToShow - 4))}
              disabled={weeksToShow <= 4}
              className="p-1 rounded hover:bg-[var(--color-bg-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-[var(--color-text-muted)]" />
            </button>
            <span className="text-xs text-[var(--color-text-muted)] min-w-[60px] text-center">
              {weeksToShow} weeks
            </span>
            <button
              onClick={() => setWeeksToShow(Math.min(maxWeeks, weeksToShow + 4))}
              disabled={weeksToShow >= maxWeeks}
              className="p-1 rounded hover:bg-[var(--color-bg-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)]" />
            </button>
          </div>
        </div>

        <div className="flex-1 flex gap-1">
          {/* Day labels */}
          <div className="flex flex-col gap-1 mr-1">
            {dayLabels.map((label, i) => (
              <div
                key={i}
                className="w-3 h-3 flex items-center justify-center text-[8px] text-[var(--color-text-muted)]"
              >
                {i % 2 === 1 ? label : ""}
              </div>
            ))}
          </div>

          {/* Weeks grid */}
          <div className="flex gap-1 overflow-x-auto">
            {weeksGrid.map((week, weekIdx) => (
              <div key={weekIdx} className="flex flex-col gap-1">
                {week.days.map((day, dayIdx) => {
                  const isToday = formatDateKey(day.date) === formatDateKey(new Date());
                  const isFuture = day.date > new Date();

                  return (
                    <div
                      key={dayIdx}
                      className={`w-3 h-3 rounded-sm transition-all ${
                        isFuture
                          ? "bg-[var(--color-bg-primary)] opacity-30"
                          : isToday
                          ? "ring-1 ring-[var(--color-primary-400)]"
                          : ""
                      }`}
                      style={!isFuture ? getCellStyle(day.posts, day.replies) : {}}
                      title={`${day.date.toLocaleDateString()}: ${day.posts} posts, ${day.replies} replies`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[var(--color-border)]">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-blue-400" />
            <span className="text-[10px] text-[var(--color-text-muted)]">Posts</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-emerald-400" />
            <span className="text-[10px] text-[var(--color-text-muted)]">Replies</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-teal-400" />
            <span className="text-[10px] text-[var(--color-text-muted)]">Both</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
