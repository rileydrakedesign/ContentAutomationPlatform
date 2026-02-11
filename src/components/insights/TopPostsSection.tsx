"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PostAnalytics } from "@/types/analytics";
import { Card } from "@/components/ui/Card";
import { formatNumber } from "@/lib/utils/formatting";
import { weightedEngagement } from "@/lib/utils/engagement";

export function TopPostsSection() {
  const [posts, setPosts] = useState<PostAnalytics[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPosts() {
      try {
        const res = await fetch("/api/analytics/csv");
        const json = await res.json();
        const rows = (json?.data?.posts && Array.isArray(json.data.posts)) ? json.data.posts : [];
        setPosts(rows);
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

  const onlyPosts = posts.filter((p) => !p.is_reply);

  if (onlyPosts.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-white mb-2">Top Performing Posts</h2>
        <p className="text-slate-500">
          Upload your X analytics CSV to see rankings.
        </p>
      </div>
    );
  }

  // Sort by impressions (primary) then weighted engagement
  const sortedPosts = [...onlyPosts]
    .sort((a, b) => {
      const imp = (b.impressions || 0) - (a.impressions || 0);
      if (imp !== 0) return imp;
      return weightedEngagement(b as any) - weightedEngagement(a as any);
    })
    .slice(0, 5);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-white">Top Performing Posts</h2>
        <Link
          href="/insights?tab=overview#performance"
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
                {post.text}
              </p>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-slate-400">
                  {formatNumber(post.impressions || 0)} impressions
                </span>
                <span className="text-slate-400">
                  {formatNumber(post.likes || 0)} likes
                </span>
                {post.post_url && (
                  <a
                    href={post.post_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-400 hover:text-amber-300 transition"
                >
                    View
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
