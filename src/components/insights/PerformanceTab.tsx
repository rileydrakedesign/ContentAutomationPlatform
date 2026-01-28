"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { CapturedPost } from "@/types/captured";
import { formatNumber, formatRelativeTime } from "@/lib/utils/formatting";
import { TrendingUp, Eye, Heart, MessageSquare, Repeat, ExternalLink } from "lucide-react";

export function PerformanceTab() {
  const [posts, setPosts] = useState<CapturedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"views" | "likes" | "recent">("views");

  useEffect(() => {
    async function fetchPosts() {
      try {
        const res = await fetch("/api/captured?triaged_as=my_post");
        if (res.ok) {
          const data = await res.json();
          setPosts(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        console.error("Failed to fetch posts:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchPosts();
  }, []);

  const sortedPosts = [...posts].sort((a, b) => {
    if (sortBy === "views") {
      return (b.metrics.views || 0) - (a.metrics.views || 0);
    }
    if (sortBy === "likes") {
      return (b.metrics.likes || 0) - (a.metrics.likes || 0);
    }
    return new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime();
  });

  // Calculate aggregate stats
  const totalViews = posts.reduce((sum, p) => sum + (p.metrics.views || 0), 0);
  const totalLikes = posts.reduce((sum, p) => sum + (p.metrics.likes || 0), 0);
  const totalRetweets = posts.reduce((sum, p) => sum + (p.metrics.retweets || 0), 0);
  const totalReplies = posts.reduce((sum, p) => sum + (p.metrics.replies || 0), 0);
  const avgEngagement = totalViews > 0 ? ((totalLikes + totalRetweets) / totalViews * 100).toFixed(2) : "0";

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="grid grid-cols-4 gap-3">
          <div className="h-20 bg-slate-800 rounded-lg"></div>
          <div className="h-20 bg-slate-800 rounded-lg"></div>
          <div className="h-20 bg-slate-800 rounded-lg"></div>
          <div className="h-20 bg-slate-800 rounded-lg"></div>
        </div>
        <div className="h-64 bg-slate-800 rounded-lg"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Aggregate Stats */}
      <div className="grid grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <Eye className="w-4 h-4" />
            <span className="text-xs uppercase">Total Views</span>
          </div>
          <p className="text-2xl font-semibold text-white font-mono">
            {formatNumber(totalViews)}
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <Heart className="w-4 h-4" />
            <span className="text-xs uppercase">Total Likes</span>
          </div>
          <p className="text-2xl font-semibold text-white font-mono">
            {formatNumber(totalLikes)}
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <Repeat className="w-4 h-4" />
            <span className="text-xs uppercase">Total Retweets</span>
          </div>
          <p className="text-2xl font-semibold text-white font-mono">
            {formatNumber(totalRetweets)}
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <TrendingUp className="w-4 h-4" />
            <span className="text-xs uppercase">Avg Engagement</span>
          </div>
          <p className="text-2xl font-semibold text-white font-mono">{avgEngagement}%</p>
        </Card>
      </div>

      {/* Posts List */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-white">Your Posts</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "views" | "likes" | "recent")}
              className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="views">Views</option>
              <option value="likes">Likes</option>
              <option value="recent">Recent</option>
            </select>
          </div>
        </div>

        {sortedPosts.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-slate-400">No posts found</p>
            <p className="text-sm text-slate-500 mt-1">
              Save your posts using the Chrome extension to see them here
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedPosts.slice(0, 20).map((post, index) => (
              <div
                key={post.id}
                className="flex gap-4 p-3 bg-slate-800/50 hover:bg-slate-800 rounded-lg transition"
              >
                <div className="flex items-center justify-center w-8 h-8 bg-slate-700 rounded-full text-sm font-medium text-slate-300">
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200 line-clamp-2 mb-2">
                    {post.text_content}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      {formatNumber(post.metrics.views || 0)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Heart className="w-3 h-3" />
                      {formatNumber(post.metrics.likes || 0)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Repeat className="w-3 h-3" />
                      {formatNumber(post.metrics.retweets || 0)}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      {formatNumber(post.metrics.replies || 0)}
                    </span>
                    <span>{formatRelativeTime(post.captured_at)}</span>
                  </div>
                </div>
                {post.post_url && (
                  <a
                    href={post.post_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-slate-400 hover:text-white transition"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
