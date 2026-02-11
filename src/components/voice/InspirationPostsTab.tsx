"use client";

import { useState, useEffect } from "react";
import { Bookmark, Trash2, ExternalLink, Eye, Heart, Repeat2, MessageCircle } from "lucide-react";

interface NichePost {
  id: string;
  x_post_id: string;
  text_content: string;
  metrics: {
    views?: number;
    likes?: number;
    retweets?: number;
    replies?: number;
  };
  post_timestamp: string | null;
  niche_accounts?: {
    x_username: string;
    display_name: string | null;
  };
}

export function InspirationPostsTab() {
  const [posts, setPosts] = useState<NichePost[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/niche-posts?limit=100");
      if (res.ok) {
        const data = await res.json();
        setPosts(data);
      }
    } catch (error) {
      console.error("Failed to fetch inspiration posts:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const handleDeletePost = async (id: string) => {
    try {
      const res = await fetch(`/api/niche-posts/${id}`, { method: "DELETE" });
      if (res.ok) {
        setPosts((prev) => prev.filter((p) => p.id !== id));
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
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-slate-800 rounded w-48"></div>
        <div className="h-32 bg-slate-800 rounded"></div>
        <div className="h-32 bg-slate-800 rounded"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-medium text-white">Saved Inspiration</h3>
            <p className="text-sm text-slate-400 mt-1">
              Posts you&apos;ve saved as inspiration for content generation. Add posts via the Chrome extension.
            </p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-violet-500/10 text-violet-400 rounded-full text-sm">
            <Bookmark className="w-4 h-4" />
            <span>{posts.length} posts</span>
          </div>
        </div>

        {posts.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-slate-800 flex items-center justify-center">
              <Bookmark className="w-6 h-6 text-slate-500" />
            </div>
            <p className="text-slate-400 mb-2">No inspiration posts saved yet</p>
            <p className="text-sm text-slate-500">
              Browse X and use the Chrome extension to save posts that inspire you.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => (
              <div
                key={post.id}
                className="border border-slate-700 rounded-lg p-4 hover:border-slate-600 transition-colors"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <a
                    href={`https://x.com/${post.niche_accounts?.x_username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-sm text-violet-400 hover:text-violet-300 transition-colors flex-shrink-0"
                  >
                    <span className="font-medium">
                      {post.niche_accounts?.display_name || post.niche_accounts?.x_username}
                    </span>
                    <span className="text-slate-500">@{post.niche_accounts?.x_username}</span>
                  </a>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <a
                      href={`https://x.com/${post.niche_accounts?.x_username}/status/${post.x_post_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-md transition-colors"
                      title="View on X"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <button
                      onClick={() => handleDeletePost(post.id)}
                      className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                      title="Remove post"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <p className="text-sm text-slate-300 whitespace-pre-line mb-3">
                  {post.text_content}
                </p>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-xs text-slate-500">
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
                    <span className="text-xs text-slate-500">
                      {formatDate(post.post_timestamp)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-slate-900/50 border border-slate-800/50 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-violet-500/10 flex items-center justify-center flex-shrink-0">
            <svg
              className="w-4 h-4 text-violet-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div>
            <p className="text-sm text-slate-300">
              Saved posts are analyzed for patterns. Use the{" "}
              <strong className="text-white">Extract Patterns</strong> button on the
              Insights page to discover what works.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
