"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import type { PostAnalytics } from "@/types/analytics";
import { formatNumber, formatRelativeTime } from "@/lib/utils/formatting";
import { Eye, Heart, MessageSquare, Repeat, ExternalLink, Upload } from "lucide-react";

interface PerformanceTabProps {
  posts: PostAnalytics[];
  uploadedAt?: string;
  onUploadClick: () => void;
  loading?: boolean;
}

type SortKey = "engagement" | "views" | "likes" | "recent";

function sortItems(items: PostAnalytics[], sortBy: SortKey): PostAnalytics[] {
  return [...items].sort((a, b) => {
    if (sortBy === "engagement") return (b.engagement_score || 0) - (a.engagement_score || 0);
    if (sortBy === "views") return (b.impressions || 0) - (a.impressions || 0);
    if (sortBy === "likes") return (b.likes || 0) - (a.likes || 0);
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });
}

export function PerformanceTab({ posts, uploadedAt, onUploadClick, loading }: PerformanceTabProps) {
  const [postsSortBy, setPostsSortBy] = useState<SortKey>("engagement");
  const [repliesSortBy, setRepliesSortBy] = useState<SortKey>("engagement");

  const onlyPosts = posts.filter((p) => !p.is_reply);
  const onlyReplies = posts.filter((p) => p.is_reply);

  const sortedOnlyPosts = sortItems(onlyPosts, postsSortBy);
  const sortedOnlyReplies = sortItems(onlyReplies, repliesSortBy);

  // Calculate aggregate stats
  const totalViews = posts.reduce((sum, p) => sum + (p.impressions || 0), 0);
  const totalLikes = posts.reduce((sum, p) => sum + (p.likes || 0), 0);
  const totalReposts = posts.reduce((sum, p) => sum + (p.reposts || 0), 0);
  const totalReplies = posts.reduce((sum, p) => sum + (p.replies || 0), 0);
  const totalEngagement = posts.reduce((sum, p) => sum + (p.engagement_score || 0), 0);

  const avgImpressions = posts.length > 0 ? Math.round(totalViews / posts.length) : 0;
  const engagementRate = totalViews > 0 ? ((totalEngagement / totalViews) * 100).toFixed(2) : "0";

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="grid grid-cols-4 gap-3">
          <div className="h-20 bg-[var(--color-bg-elevated)] rounded-lg"></div>
          <div className="h-20 bg-[var(--color-bg-elevated)] rounded-lg"></div>
          <div className="h-20 bg-[var(--color-bg-elevated)] rounded-lg"></div>
          <div className="h-20 bg-[var(--color-bg-elevated)] rounded-lg"></div>
        </div>
        <div className="h-64 bg-[var(--color-bg-elevated)] rounded-lg"></div>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Upload className="w-8 h-8 text-[var(--color-text-muted)] mx-auto mb-3" />
        <h3 className="text-[var(--color-text-primary)] font-medium mb-1">No analytics data</h3>
        <p className="text-sm text-[var(--color-text-muted)] mb-4">
          Upload your X analytics CSV to see performance insights.
        </p>
        <button
          onClick={onUploadClick}
          className="px-4 py-2 bg-[var(--color-primary-500)] hover:bg-[var(--color-primary-600)] text-white text-sm rounded-lg transition-colors"
        >
          Upload CSV
        </button>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1-minute snapshot */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-[var(--color-text-secondary)] mb-1">
            <Eye className="w-4 h-4" />
            <span className="text-xs uppercase">Posts analyzed</span>
          </div>
          <p className="text-2xl font-semibold text-[var(--color-text-primary)] font-mono">{formatNumber(posts.length)}</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 text-[var(--color-text-secondary)] mb-1">
            <Eye className="w-4 h-4" />
            <span className="text-xs uppercase">Avg impressions / post</span>
          </div>
          <p className="text-2xl font-semibold text-[var(--color-text-primary)] font-mono">{formatNumber(avgImpressions)}</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 text-[var(--color-text-secondary)] mb-1">
            <Repeat className="w-4 h-4" />
            <span className="text-xs uppercase">Engagement rate</span>
          </div>
          <p className="text-2xl font-semibold text-[var(--color-text-primary)] font-mono">{engagementRate}%</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">vs impressions</p>
        </Card>
      </div>

      {/* Posts + Replies */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3" id="performance">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-medium text-[var(--color-text-primary)]">Posts</h3>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">{formatNumber(onlyPosts.length)} original posts</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--color-text-muted)]">Sort:</span>
              <select
                value={postsSortBy}
                onChange={(e) => setPostsSortBy(e.target.value as SortKey)}
                className="px-2 py-1 bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] rounded text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
              >
                <option value="engagement">Engagement</option>
                <option value="recent">Recent</option>
                <option value="views">Views</option>
                <option value="likes">Likes</option>
              </select>
            </div>
          </div>

          {sortedOnlyPosts.length === 0 ? (
            <div className="text-sm text-[var(--color-text-muted)]">No posts yet. Upload your analytics CSV.</div>
          ) : (
            <div className="space-y-2 overflow-y-auto pr-1" style={{ maxHeight: '520px' }}>
              {sortedOnlyPosts.map((post, index) => (
                <div key={post.id || index} className="flex items-start gap-3 p-3 bg-[var(--color-bg-elevated)]/50 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--color-text-secondary)] line-clamp-2">{post.text}</p>
                    <div className="flex items-center justify-between gap-3 mt-2 text-xs text-[var(--color-text-muted)]">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{formatNumber(post.impressions || 0)}</span>
                        <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{formatNumber(post.likes || 0)}</span>
                        <span className="flex items-center gap-1"><Repeat className="w-3 h-3" />{formatNumber(post.reposts || 0)}</span>
                        <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{formatNumber(post.replies || 0)}</span>
                      </div>
                      <span>{formatRelativeTime(post.date)}</span>
                    </div>
                  </div>
                  {post.post_url && (
                    <a href={post.post_url} target="_blank" rel="noopener noreferrer" className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-medium text-[var(--color-text-primary)]">Replies</h3>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">{formatNumber(onlyReplies.length)} replies</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--color-text-muted)]">Sort:</span>
              <select
                value={repliesSortBy}
                onChange={(e) => setRepliesSortBy(e.target.value as SortKey)}
                className="px-2 py-1 bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] rounded text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
              >
                <option value="engagement">Engagement</option>
                <option value="recent">Recent</option>
                <option value="views">Views</option>
                <option value="likes">Likes</option>
              </select>
            </div>
          </div>

          {sortedOnlyReplies.length === 0 ? (
            <div className="text-sm text-[var(--color-text-muted)]">No replies yet.</div>
          ) : (
            <div className="space-y-2 overflow-y-auto pr-1" style={{ maxHeight: '520px' }}>
              {sortedOnlyReplies.map((post, index) => (
                <div key={post.id || index} className="flex items-start gap-3 p-3 bg-[var(--color-bg-elevated)]/50 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--color-text-secondary)] line-clamp-2">{post.text}</p>
                    <div className="flex items-center justify-between gap-3 mt-2 text-xs text-[var(--color-text-muted)]">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{formatNumber(post.impressions || 0)}</span>
                        <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{formatNumber(post.likes || 0)}</span>
                        <span className="flex items-center gap-1"><Repeat className="w-3 h-3" />{formatNumber(post.reposts || 0)}</span>
                        <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{formatNumber(post.replies || 0)}</span>
                      </div>
                      <span>{formatRelativeTime(post.date)}</span>
                    </div>
                  </div>
                  {post.post_url && (
                    <a href={post.post_url} target="_blank" rel="noopener noreferrer" className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
