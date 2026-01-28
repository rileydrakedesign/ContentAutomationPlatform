"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { CapturedPost } from "@/types/captured";
import { Card } from "@/components/ui/Card";
import { formatNumber, formatMetrics, calculateEngagementScore } from "@/lib/utils/formatting";

export function TopPostsSection() {
  const [posts, setPosts] = useState<CapturedPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPosts() {
      try {
        const res = await fetch("/api/captured?triaged_as=my_post");
        const data = await res.json();
        setPosts(data);
      } catch (error) {
        console.error("Failed to fetch posts:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchPosts();
  }, []);

  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
        <div className="animate-pulse">
          <div className="h-6 bg-slate-800 rounded w-48 mb-4" />
          <div className="space-y-3">
            <div className="h-20 bg-slate-800 rounded" />
            <div className="h-20 bg-slate-800 rounded" />
            <div className="h-20 bg-slate-800 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-white mb-2">Top Performing Posts</h2>
        <p className="text-slate-500">
          No posts yet. Capture your X posts and mark them as "My Post" to see rankings.
        </p>
      </div>
    );
  }

  // Sort by engagement score
  const sortedPosts = [...posts]
    .sort((a, b) => calculateEngagementScore(b.metrics) - calculateEngagementScore(a.metrics))
    .slice(0, 5);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-white">Top Performing Posts</h2>
        <Link
          href="/library?filter=my_posts"
          className="text-sm text-amber-400 hover:text-amber-300 transition"
        >
          View all
        </Link>
      </div>

      <div className="space-y-3">
        {sortedPosts.map((post, index) => (
          <div
            key={post.id}
            className="flex items-start gap-3 p-3 bg-slate-800 rounded-lg"
          >
            <div className="w-6 h-6 flex items-center justify-center rounded-full bg-slate-700 text-slate-300 text-sm font-medium shrink-0">
              {index + 1}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-300 line-clamp-2 mb-2">
                {post.text_content}
              </p>
              <div className="flex items-center gap-3 text-xs">
                {post.metrics.views && (
                  <span className="text-slate-400">
                    {formatNumber(post.metrics.views)} views
                  </span>
                )}
                {post.metrics.likes && (
                  <span className="text-slate-400">
                    {formatNumber(post.metrics.likes)} likes
                  </span>
                )}
                <a
                  href={post.post_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-400 hover:text-amber-300 transition"
                >
                  View
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
