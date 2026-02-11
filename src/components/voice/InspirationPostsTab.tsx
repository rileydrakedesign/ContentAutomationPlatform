"use client";

import { useState, useEffect } from "react";
import {
  Bookmark,
  Trash2,
  ExternalLink,
  Eye,
  Heart,
  Repeat2,
  MessageCircle,
  FileText,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";

interface MyPost {
  id: string;
  text: string;
  date: string;
  post_url?: string;
  impressions: number;
  likes: number;
  replies: number;
  reposts: number;
  bookmarks: number;
  engagement_score: number;
  is_reply: boolean;
}

interface InspirationPost {
  id: string;
  raw_content: string;
  source_url: string | null;
  author_handle: string | null;
  metrics: {
    views?: number;
    likes?: number;
    retweets?: number;
    replies?: number;
  };
  post_timestamp: string | null;
  source: string;
  created_at: string;
}

export function InspirationPostsTab() {
  const [myPosts, setMyPosts] = useState<MyPost[]>([]);
  const [savedPosts, setSavedPosts] = useState<InspirationPost[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [analyticsRes, postsRes] = await Promise.all([
        fetch("/api/analytics/csv"),
        fetch("/api/inspiration"),
      ]);

      if (analyticsRes.ok) {
        const json = await analyticsRes.json();
        const posts: MyPost[] = json.data?.posts || [];
        // Sort by engagement score descending
        posts.sort((a, b) => b.engagement_score - a.engagement_score);
        setMyPosts(posts);
      }
      if (postsRes.ok) {
        const data = await postsRes.json();
        // Filter to only chrome extension saves for the "Saved Posts" column
        setSavedPosts(
          data.filter((p: InspirationPost) => p.source === "chrome_extension")
        );
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDeletePost = async (id: string) => {
    try {
      const res = await fetch(`/api/inspiration/${id}`, { method: "DELETE" });
      if (res.ok) {
        setSavedPosts((prev) => prev.filter((p) => p.id !== id));
      }
    } catch (error) {
      console.error("Failed to delete post:", error);
    }
  };

  const formatNumber = (num: number | undefined | null) => {
    if (num === undefined || num === null) return "-";
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="h-8 bg-[var(--color-bg-elevated)] rounded w-32 animate-pulse" />
          <div className="h-32 bg-[var(--color-bg-elevated)] rounded animate-pulse" />
          <div className="h-32 bg-[var(--color-bg-elevated)] rounded animate-pulse" />
        </div>
        <div className="space-y-4">
          <div className="h-8 bg-[var(--color-bg-elevated)] rounded w-32 animate-pulse" />
          <div className="h-32 bg-[var(--color-bg-elevated)] rounded animate-pulse" />
          <div className="h-32 bg-[var(--color-bg-elevated)] rounded animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left Column: My Posts */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-primary-500)]/10 flex items-center justify-center">
              <FileText className="w-4 h-4 text-[var(--color-primary-400)]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">My Posts</h3>
              <p className="text-xs text-[var(--color-text-muted)]">
                Your posts from X analytics, sorted by engagement
              </p>
            </div>
          </div>
          <Badge variant="primary">{myPosts.length}</Badge>
        </div>

        {myPosts.length === 0 ? (
          <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-6 text-center">
            <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-[var(--color-bg-elevated)] flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-[var(--color-text-muted)]" />
            </div>
            <p className="text-sm text-[var(--color-text-secondary)] mb-1">No posts yet</p>
            <p className="text-xs text-[var(--color-text-muted)]">
              Upload your X analytics CSV on the Insights page to see your posts here.
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
            {myPosts.map((post) => (
              <div
                key={post.id}
                className="group rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-4 hover:border-[var(--color-border-default)] transition-colors"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <Badge variant={post.is_reply ? "accent" : "primary"}>
                    {post.is_reply ? "reply" : "post"}
                  </Badge>
                  {post.post_url && (
                    <a
                      href={post.post_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="opacity-0 group-hover:opacity-100 p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-all"
                      title="View on X"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
                <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-line line-clamp-4">
                  {post.text}
                </p>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      {formatNumber(post.impressions)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Heart className="w-3 h-3" />
                      {formatNumber(post.likes)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Repeat2 className="w-3 h-3" />
                      {formatNumber(post.reposts)}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle className="w-3 h-3" />
                      {formatNumber(post.replies)}
                    </span>
                  </div>
                  {post.date && (
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {formatDate(post.date)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right Column: Saved Posts */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-accent-500)]/10 flex items-center justify-center">
              <Bookmark className="w-4 h-4 text-[var(--color-accent-400)]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Saved Posts</h3>
              <p className="text-xs text-[var(--color-text-muted)]">
                Posts saved from X via Chrome extension
              </p>
            </div>
          </div>
          <Badge variant="accent">{savedPosts.length}</Badge>
        </div>

        {savedPosts.length === 0 ? (
          <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-6 text-center">
            <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-[var(--color-bg-elevated)] flex items-center justify-center">
              <Bookmark className="w-5 h-5 text-[var(--color-text-muted)]" />
            </div>
            <p className="text-sm text-[var(--color-text-secondary)] mb-1">No saved posts yet</p>
            <p className="text-xs text-[var(--color-text-muted)]">
              Browse X and use the Chrome extension to save posts that inspire you.
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
            {savedPosts.map((post) => (
              <div
                key={post.id}
                className="group rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-4 hover:border-[var(--color-border-default)] transition-colors"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  {post.author_handle && (
                    <a
                      href={`https://x.com/${post.author_handle.replace(/^@/, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-[var(--color-accent-400)] hover:text-[var(--color-accent-300)] transition-colors"
                    >
                      <span className="font-medium">{post.author_handle}</span>
                    </a>
                  )}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    {post.source_url && (
                      <a
                        href={post.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                        title="View on X"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <button
                      onClick={() => handleDeletePost(post.id)}
                      className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-danger-400)] transition-colors"
                      title="Remove post"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-line line-clamp-4">
                  {post.raw_content}
                </p>

                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      {formatNumber(post.metrics?.views)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Heart className="w-3 h-3" />
                      {formatNumber(post.metrics?.likes)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Repeat2 className="w-3 h-3" />
                      {formatNumber(post.metrics?.retweets)}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle className="w-3 h-3" />
                      {formatNumber(post.metrics?.replies)}
                    </span>
                  </div>
                  {post.post_timestamp && (
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {formatDate(post.post_timestamp)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
