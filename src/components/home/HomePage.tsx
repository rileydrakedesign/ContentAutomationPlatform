"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PatternInsightsSection } from "./PatternInsightsSection";
import { CapturedPost } from "@/types/captured";
import { formatNumber, formatRelativeTime } from "@/lib/utils/formatting";
import { TrendingUp, TrendingDown, Minus, Plus, ArrowRight, RefreshCw } from "lucide-react";

type Draft = {
  id: string;
  type: "X_POST" | "X_THREAD";
  status: "PENDING" | "GENERATED" | "APPROVED" | "REJECTED";
  content: Record<string, unknown>;
  edited_content: Record<string, unknown> | null;
  created_at: string;
};

interface XStatus {
  connected: boolean;
  username?: string;
  lastSyncAt?: string;
}

interface MetricCardProps {
  label: string;
  value: string | number;
  trend?: number;
  trendLabel?: string;
}

function MetricCard({ label, value, trend, trendLabel }: MetricCardProps) {
  const getTrendIcon = () => {
    if (!trend) return <Minus className="w-3 h-3" />;
    if (trend > 0) return <TrendingUp className="w-3 h-3" />;
    return <TrendingDown className="w-3 h-3" />;
  };

  const getTrendColor = () => {
    if (!trend) return "text-slate-500";
    if (trend > 0) return "text-green-400";
    return "text-red-400";
  };

  return (
    <Card className="p-4">
      <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-semibold text-white font-mono tabular-nums">{value}</p>
      {(trend !== undefined || trendLabel) && (
        <div className={`flex items-center gap-1 mt-1 text-xs ${getTrendColor()}`}>
          {getTrendIcon()}
          <span>{trendLabel || `${(trend ?? 0) > 0 ? "+" : ""}${trend ?? 0}%`}</span>
        </div>
      )}
    </Card>
  );
}

export function HomePage() {
  const [xStatus, setXStatus] = useState<XStatus | null>(null);
  const [posts, setPosts] = useState<CapturedPost[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const [xRes, postsRes, draftsRes] = await Promise.all([
          fetch("/api/x/status"),
          fetch("/api/captured?triaged_as=my_post"),
          fetch("/api/drafts"),
        ]);

        const [xData, postsData, draftsData] = await Promise.all([
          xRes.json(),
          postsRes.json(),
          draftsRes.json(),
        ]);

        setXStatus(xData);
        setPosts(Array.isArray(postsData) ? postsData : []);
        setDrafts(Array.isArray(draftsData) ? draftsData : []);
      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/x/sync", { method: "POST" });
      if (res.ok) {
        const postsRes = await fetch("/api/captured?triaged_as=my_post");
        const postsData = await postsRes.json();
        setPosts(Array.isArray(postsData) ? postsData : []);

        const xRes = await fetch("/api/x/status");
        const xData = await xRes.json();
        setXStatus(xData);
      }
    } catch (error) {
      console.error("Failed to sync:", error);
    } finally {
      setSyncing(false);
    }
  }

  function getPreview(draft: Draft) {
    const content = draft.edited_content || draft.content;
    if ("text" in content) return content.text as string;
    if ("tweets" in content) return (content.tweets as string[])[0];
    return "";
  }

  // Calculate stats
  const totalViews = posts.reduce((sum, p) => sum + (p.metrics.views || 0), 0);
  const totalLikes = posts.reduce((sum, p) => sum + (p.metrics.likes || 0), 0);
  const engagementRate = totalViews > 0 ? ((totalLikes / totalViews) * 100).toFixed(1) : "0";
  const generatedDrafts = drafts.filter((d) => d.status === "GENERATED");
  const recentPosts = posts.slice(0, 5);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-slate-800 rounded w-48"></div>
        <div className="grid grid-cols-4 gap-3">
          <div className="h-24 bg-slate-800 rounded-lg"></div>
          <div className="h-24 bg-slate-800 rounded-lg"></div>
          <div className="h-24 bg-slate-800 rounded-lg"></div>
          <div className="h-24 bg-slate-800 rounded-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Performance snapshot and pattern insights
        </p>
      </div>

      <div className="space-y-6">
        {/* Performance Snapshot */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-white">Performance Snapshot</h2>
            {xStatus?.connected && (
              <button
                onClick={handleSync}
                disabled={syncing}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${syncing ? "animate-spin" : ""}`} />
                <span>{syncing ? "Syncing..." : "Sync"}</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-4 gap-3">
            <MetricCard label="Posts" value={posts.length} trendLabel="last 7d" />
            <MetricCard label="Views" value={formatNumber(totalViews)} trend={8} />
            <MetricCard label="Eng Rate" value={`${engagementRate}%`} trend={2} />
            <MetricCard label="Followers" value="+142" trendLabel="this week" />
          </div>
        </div>

        {/* Pattern Insights */}
        <PatternInsightsSection />

        {/* Quick Actions */}
        <div className="flex gap-3">
          <Link
            href="/create"
            className="flex-1 flex items-center justify-center gap-2 p-4 bg-violet-500 hover:bg-violet-600 rounded-lg transition text-center"
          >
            <Plus className="w-5 h-5 text-white" />
            <span className="font-semibold text-white">Create Post</span>
          </Link>
          <Link
            href="/insights"
            className="flex-1 flex items-center justify-center gap-2 p-4 bg-slate-800 hover:bg-slate-700 rounded-lg transition text-center"
          >
            <span className="font-medium text-white">View Insights</span>
            <ArrowRight className="w-4 h-4 text-slate-400" />
          </Link>
        </div>

        {/* Connect X prompt */}
        {!xStatus?.connected && (
          <Card className="p-4 border-amber-500/30">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-medium text-white mb-1">
                  Connect Your X Account
                </h2>
                <p className="text-sm text-slate-500">
                  Sync your posts to track performance and extract patterns
                </p>
              </div>
              <Link
                href="/settings"
                className="px-4 py-2 bg-amber-500 text-slate-900 font-medium rounded-lg hover:bg-amber-400 transition"
              >
                Connect
              </Link>
            </div>
          </Card>
        )}

        {/* Recent Posts */}
        {recentPosts.length > 0 && (
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-white">Recent Posts</h2>
              <Link
                href="/insights"
                className="text-sm text-violet-400 hover:text-violet-300 transition"
              >
                View All
              </Link>
            </div>

            <div className="space-y-2">
              {recentPosts.map((post) => (
                <div
                  key={post.id}
                  className="p-3 bg-slate-800/50 hover:bg-slate-800 rounded-lg transition"
                >
                  <p className="text-sm text-slate-300 line-clamp-2 mb-2">
                    {post.text_content}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-slate-500 font-mono">
                    {post.metrics.views && (
                      <span>{formatNumber(post.metrics.views)} views</span>
                    )}
                    {post.metrics.likes && (
                      <span>{formatNumber(post.metrics.likes)} likes</span>
                    )}
                    <span>{formatRelativeTime(post.captured_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Drafts to Review */}
        {generatedDrafts.length > 0 && (
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-white">Drafts to Review</h2>
                <Badge variant="primary">{generatedDrafts.length}</Badge>
              </div>
              <Link
                href="/create?tab=drafts"
                className="text-sm text-violet-400 hover:text-violet-300 transition"
              >
                View All
              </Link>
            </div>

            <div className="space-y-2">
              {generatedDrafts.slice(0, 2).map((draft) => (
                <Link
                  key={draft.id}
                  href={`/drafts/${draft.id}`}
                  className="block p-3 bg-slate-800/50 hover:bg-slate-800 rounded-lg transition"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs px-2 py-0.5 bg-slate-700 rounded">
                      {draft.type === "X_POST" ? "Post" : "Thread"}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      {formatRelativeTime(draft.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-slate-300 line-clamp-2">
                    {getPreview(draft)}
                  </p>
                </Link>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
