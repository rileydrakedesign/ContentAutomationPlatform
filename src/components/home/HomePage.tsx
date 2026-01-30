"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PatternInsightsSection } from "./PatternInsightsSection";
import { CapturedPost } from "@/types/captured";
import { formatNumber, formatRelativeTime } from "@/lib/utils/formatting";
import { TrendingUp, TrendingDown, Minus, Plus, ArrowRight, RefreshCw, Eye, Heart, Users } from "lucide-react";

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
  icon?: React.ReactNode;
}

function MetricCard({ label, value, trend, trendLabel, icon }: MetricCardProps) {
  const getTrendIcon = () => {
    if (!trend) return <Minus className="w-3 h-3" />;
    if (trend > 0) return <TrendingUp className="w-3 h-3" />;
    return <TrendingDown className="w-3 h-3" />;
  };

  const getTrendColor = () => {
    if (!trend) return "text-[var(--color-text-muted)]";
    if (trend > 0) return "text-[var(--color-success-400)]";
    return "text-[var(--color-danger-400)]";
  };

  return (
    <Card className="p-4 hover:border-[var(--color-border-strong)] transition-all duration-200">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
          {label}
        </p>
        {icon && (
          <div className="w-8 h-8 rounded-lg bg-[var(--color-primary-500)]/10 flex items-center justify-center">
            <span className="text-[var(--color-primary-400)]">{icon}</span>
          </div>
        )}
      </div>
      <p className="text-2xl font-semibold text-[var(--color-text-primary)] font-mono tabular-nums">
        {value}
      </p>
      {(trend !== undefined || trendLabel) && (
        <div className={`flex items-center gap-1.5 mt-2 text-xs ${getTrendColor()}`}>
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
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="h-8 skeleton w-48"></div>
          <div className="h-4 skeleton w-72"></div>
        </div>
        <div className="grid grid-cols-4 gap-4">
          <div className="h-28 skeleton"></div>
          <div className="h-28 skeleton"></div>
          <div className="h-28 skeleton"></div>
          <div className="h-28 skeleton"></div>
        </div>
        <div className="h-48 skeleton"></div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-heading text-2xl font-semibold text-[var(--color-text-primary)]">
          Dashboard
        </h1>
        <p className="text-[var(--color-text-secondary)] text-sm mt-1">
          Performance snapshot and pattern insights
        </p>
      </div>

      <div className="space-y-8">
        {/* Performance Snapshot */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-heading text-base font-semibold text-[var(--color-text-primary)]">
              Performance Snapshot
            </h2>
            {xStatus?.connected && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSync}
                loading={syncing}
                icon={<RefreshCw className="w-3.5 h-3.5" />}
              >
                {syncing ? "Syncing..." : "Sync"}
              </Button>
            )}
          </div>

          <div className="grid grid-cols-4 gap-4">
            <MetricCard
              label="Posts"
              value={posts.length}
              trendLabel="last 7d"
              icon={<Eye className="w-4 h-4" />}
            />
            <MetricCard
              label="Views"
              value={formatNumber(totalViews)}
              trend={8}
              icon={<Eye className="w-4 h-4" />}
            />
            <MetricCard
              label="Engagement"
              value={`${engagementRate}%`}
              trend={2}
              icon={<Heart className="w-4 h-4" />}
            />
            <MetricCard
              label="Followers"
              value="+142"
              trendLabel="this week"
              icon={<Users className="w-4 h-4" />}
            />
          </div>
        </section>

        {/* Pattern Insights */}
        <PatternInsightsSection />

        {/* Quick Actions */}
        <section className="grid grid-cols-2 gap-4">
          <Link href="/create">
            <Button
              variant="primary"
              fullWidth
              glow
              icon={<Plus className="w-5 h-5" />}
              className="h-14 text-base"
            >
              Create Post
            </Button>
          </Link>
          <Link href="/insights">
            <Button
              variant="secondary"
              fullWidth
              icon={<ArrowRight className="w-4 h-4" />}
              iconPosition="right"
              className="h-14 text-base"
            >
              View Insights
            </Button>
          </Link>
        </section>

        {/* Connect X prompt */}
        {!xStatus?.connected && (
          <Card className="border-[var(--color-accent-500)]/30 bg-[var(--color-accent-500)]/5">
            <CardContent className="flex items-center justify-between py-5">
              <div>
                <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">
                  Connect Your X Account
                </h2>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Sync your posts to track performance and extract patterns
                </p>
              </div>
              <Link href="/settings">
                <Button variant="primary" glow>
                  Connect
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Recent Posts */}
        {recentPosts.length > 0 && (
          <Card>
            <CardContent>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-heading text-base font-semibold text-[var(--color-text-primary)]">
                  Recent Posts
                </h2>
                <Link
                  href="/insights"
                  className="text-sm text-[var(--color-primary-400)] hover:text-[var(--color-primary-300)] transition-colors"
                >
                  View All
                </Link>
              </div>

              <div className="space-y-2">
                {recentPosts.map((post) => (
                  <div
                    key={post.id}
                    className="p-3 bg-[var(--color-bg-elevated)] hover:bg-[var(--color-bg-hover)] rounded-lg transition-colors cursor-pointer"
                  >
                    <p className="text-sm text-[var(--color-text-secondary)] line-clamp-2 mb-2">
                      {post.text_content}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-[var(--color-text-muted)] font-mono">
                      {post.metrics.views && (
                        <span className="flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          {formatNumber(post.metrics.views)}
                        </span>
                      )}
                      {post.metrics.likes && (
                        <span className="flex items-center gap-1">
                          <Heart className="w-3 h-3" />
                          {formatNumber(post.metrics.likes)}
                        </span>
                      )}
                      <span>{formatRelativeTime(post.captured_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Drafts to Review */}
        {generatedDrafts.length > 0 && (
          <Card>
            <CardContent>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-heading text-base font-semibold text-[var(--color-text-primary)]">
                    Drafts to Review
                  </h2>
                  <Badge variant="primary">{generatedDrafts.length}</Badge>
                </div>
                <Link
                  href="/create?tab=drafts"
                  className="text-sm text-[var(--color-primary-400)] hover:text-[var(--color-primary-300)] transition-colors"
                >
                  View All
                </Link>
              </div>

              <div className="space-y-2">
                {generatedDrafts.slice(0, 2).map((draft) => (
                  <Link
                    key={draft.id}
                    href={`/drafts/${draft.id}`}
                    className="block p-3 bg-[var(--color-bg-elevated)] hover:bg-[var(--color-bg-hover)] rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="default">
                        {draft.type === "X_POST" ? "Post" : "Thread"}
                      </Badge>
                      <span className="text-xs text-[var(--color-text-muted)] font-mono">
                        {formatRelativeTime(draft.created_at)}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--color-text-secondary)] line-clamp-2">
                      {getPreview(draft)}
                    </p>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
