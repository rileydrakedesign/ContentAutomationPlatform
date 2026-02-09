"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PostAnalytics, AnalyticsInsight } from "@/types/analytics";
import { formatNumber } from "@/lib/utils/formatting";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  MessageCircle,
  Eye,
  Clock,
  Users,
  Upload,
  ArrowRight,
} from "lucide-react";

interface InsightsHubProps {
  posts: PostAnalytics[];
  uploadedAt?: string;
  onUploadClick: () => void;
  compact?: boolean;
}

function parsePostDate(dateStr: string): Date | null {
  try {
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) return parsed;
  } catch {
    return null;
  }
  return null;
}

export function InsightsHub({ posts, uploadedAt, onUploadClick, compact }: InsightsHubProps) {
  const insights = useMemo(() => {
    if (posts.length === 0) return [];

    const originalPosts = posts.filter((p) => !p.is_reply);
    const replies = posts.filter((p) => p.is_reply);

    const insights: AnalyticsInsight[] = [];

    // 1. Average impressions per post
    if (originalPosts.length > 0) {
      const avgImpressions = Math.round(
        originalPosts.reduce((sum, p) => sum + p.impressions, 0) / originalPosts.length
      );
      insights.push({
        id: "avg-impressions",
        type: "performance",
        title: "Avg. Impressions",
        description: `Your posts average ${formatNumber(avgImpressions)} impressions`,
        value: formatNumber(avgImpressions),
        priority: 1,
      });
    }

    // 2. Reply vs Post comparison
    if (originalPosts.length > 0 && replies.length > 0) {
      const avgPostImpressions =
        originalPosts.reduce((sum, p) => sum + p.impressions, 0) / originalPosts.length;
      const avgReplyImpressions =
        replies.reduce((sum, p) => sum + p.impressions, 0) / replies.length;
      const ratio = avgReplyImpressions / avgPostImpressions;

      if (ratio > 1.2) {
        insights.push({
          id: "reply-performance",
          type: "comparison",
          title: "Replies Outperform",
          description: `Your replies get ${ratio.toFixed(1)}x more impressions than posts`,
          value: `${ratio.toFixed(1)}x`,
          trend: "up",
          priority: 2,
        });
      } else if (ratio < 0.8) {
        insights.push({
          id: "post-performance",
          type: "comparison",
          title: "Posts Outperform",
          description: `Your posts get ${(1 / ratio).toFixed(1)}x more impressions than replies`,
          value: `${(1 / ratio).toFixed(1)}x`,
          trend: "up",
          priority: 2,
        });
      }
    }

    // 3. Best performing day
    const dayPerformance: Record<string, { impressions: number; count: number }> = {};
    posts.forEach((post) => {
      const date = parsePostDate(post.date);
      if (!date) return;
      const day = date.toLocaleDateString("en-US", { weekday: "long" });
      if (!dayPerformance[day]) {
        dayPerformance[day] = { impressions: 0, count: 0 };
      }
      dayPerformance[day].impressions += post.impressions;
      dayPerformance[day].count++;
    });

    const bestDay = Object.entries(dayPerformance)
      .map(([day, data]) => ({
        day,
        avgImpressions: data.impressions / data.count,
      }))
      .sort((a, b) => b.avgImpressions - a.avgImpressions)[0];

    if (bestDay && Object.keys(dayPerformance).length >= 3) {
      insights.push({
        id: "best-day",
        type: "timing",
        title: "Best Day",
        description: `${bestDay.day}s perform best with ${formatNumber(Math.round(bestDay.avgImpressions))} avg impressions`,
        value: bestDay.day,
        priority: 3,
      });
    }

    // 4. Engagement rate
    const totalImpressions = posts.reduce((sum, p) => sum + p.impressions, 0);
    const totalEngagements = posts.reduce(
      (sum, p) => sum + p.likes + p.replies + p.reposts,
      0
    );
    if (totalImpressions > 0) {
      const engagementRate = ((totalEngagements / totalImpressions) * 100).toFixed(2);
      insights.push({
        id: "engagement-rate",
        type: "performance",
        title: "Engagement Rate",
        description: `${engagementRate}% of impressions result in engagement`,
        value: `${engagementRate}%`,
        priority: 4,
      });
    }

    // 5. New follows from content
    const totalFollows = posts.reduce((sum, p) => sum + p.new_follows, 0);
    if (totalFollows > 0) {
      insights.push({
        id: "new-follows",
        type: "growth",
        title: "New Followers",
        description: `Gained ${totalFollows} followers from this content`,
        value: `+${totalFollows}`,
        trend: "up",
        priority: 5,
      });
    }

    // 6. Question pattern insight (posts with "?" perform differently)
    const questionsP = originalPosts.filter((p) => p.text.includes("?"));
    const nonQuestionsP = originalPosts.filter((p) => !p.text.includes("?"));

    if (questionsP.length >= 3 && nonQuestionsP.length >= 3) {
      const avgQReplies =
        questionsP.reduce((sum, p) => sum + p.replies, 0) / questionsP.length;
      const avgNonQReplies =
        nonQuestionsP.reduce((sum, p) => sum + p.replies, 0) / nonQuestionsP.length;
      const ratio = avgQReplies / avgNonQReplies;

      if (ratio > 1.5) {
        insights.push({
          id: "question-pattern",
          type: "pattern",
          title: "Questions Drive Replies",
          description: `Posts with questions get ${ratio.toFixed(1)}x more replies`,
          value: `${ratio.toFixed(1)}x`,
          trend: "up",
          priority: 6,
        });
      }
    }

    return insights.sort((a, b) => a.priority - b.priority).slice(0, 4);
  }, [posts]);

  const getIcon = (type: string) => {
    switch (type) {
      case "performance":
        return BarChart3;
      case "comparison":
        return MessageCircle;
      case "timing":
        return Clock;
      case "growth":
        return Users;
      case "pattern":
        return TrendingUp;
      default:
        return Eye;
    }
  };

  const getTrendIcon = (trend?: "up" | "down" | "neutral") => {
    if (trend === "up") return <TrendingUp className="w-3 h-3 text-emerald-400" />;
    if (trend === "down") return <TrendingDown className="w-3 h-3 text-red-400" />;
    return null;
  };

  if (posts.length === 0) {
    return (
      <Card>
        <CardContent className={compact ? "py-4" : "py-8"}>
          <div className={compact ? "flex flex-col sm:flex-row sm:items-center gap-4" : "text-center"}>
            <div className={`${compact ? "w-10 h-10" : "w-14 h-14 mx-auto mb-4"} rounded-2xl bg-[var(--color-bg-elevated)] flex items-center justify-center shrink-0`}>
              <BarChart3 className={`${compact ? "w-5 h-5" : "w-7 h-7"} text-[var(--color-text-muted)]`} />
            </div>
            <div className={compact ? "flex-1" : ""}>
              <h3 className={`${compact ? "text-sm" : "text-base"} font-medium text-[var(--color-text-primary)] mb-1`}>
                Insights Hub
              </h3>
              <p className={`text-${compact ? "xs" : "sm"} text-[var(--color-text-muted)] ${compact ? "" : "mb-4 max-w-[280px] mx-auto"}`}>
                Upload your X analytics CSV to unlock insights
              </p>
            </div>
            {!compact && (
              <Button
                variant="primary"
                icon={<Upload className="w-4 h-4" />}
                onClick={onUploadClick}
                glow
              >
                Upload Analytics CSV
              </Button>
            )}
            {compact && (
              <div className="w-full sm:w-auto">
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Upload className="w-3.5 h-3.5" />}
                  onClick={onUploadClick}
                  fullWidth
                >
                  Upload
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className={compact ? "py-3" : ""}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
              Insights Hub
            </h3>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              Based on {posts.length} posts
              {uploadedAt && ` · Updated ${new Date(uploadedAt).toLocaleDateString()}`}
            </p>
          </div>
          <Link href="/insights">
            <Button variant="ghost" size="sm" icon={<ArrowRight className="w-3.5 h-3.5" />} iconPosition="right">
              Full Insights
            </Button>
          </Link>
        </div>

        <div className={`grid ${compact ? "grid-cols-4" : "grid-cols-2"} gap-3`}>
          {insights.map((insight) => {
            const Icon = getIcon(insight.type);
            return (
              <div
                key={insight.id}
                className="p-3 bg-[var(--color-bg-elevated)] rounded-lg"
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[var(--color-primary-500)]/10 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-[var(--color-primary-400)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                        {insight.title}
                      </span>
                      {getTrendIcon(insight.trend)}
                    </div>
                    <p className="text-lg font-semibold text-[var(--color-text-primary)] font-mono mt-0.5">
                      {insight.value}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-1 line-clamp-2">
                      {insight.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
