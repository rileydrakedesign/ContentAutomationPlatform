"use client";

import { useState, useEffect, useMemo } from "react";
import { CapturedPost } from "@/types/captured";
import { formatNumber, calculateEngagementRate } from "@/lib/utils/formatting";
import { weightedEngagement } from "@/lib/utils/engagement";

export function PatternsSection() {
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

  const patterns = useMemo(() => {
    if (posts.length === 0) return null;

    // Average length
    const avgLength = Math.round(
      posts.reduce((sum, p) => sum + p.text_content.length, 0) / posts.length
    );

    // Average engagement rate
    const engagementRates = posts
      .map((p) => calculateEngagementRate(p.metrics))
      .filter((r) => r > 0);
    const avgEngagement =
      engagementRates.length > 0
        ? (engagementRates.reduce((a, b) => a + b, 0) / engagementRates.length).toFixed(2)
        : "0";

    // Best performing day
    const dayMap = new Map<number, { count: number; engagement: number }>();
    posts.forEach((post) => {
      if (post.post_timestamp) {
        const day = new Date(post.post_timestamp).getDay();
        const current = dayMap.get(day) || { count: 0, engagement: 0 };
        const engagement = weightedEngagement(
          post.metrics as Record<string, number | undefined>
        );
        dayMap.set(day, {
          count: current.count + 1,
          engagement: current.engagement + engagement,
        });
      }
    });

    let bestDay = "Not enough data";
    let bestDayEngagement = 0;
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    dayMap.forEach((value, day) => {
      const avgDayEngagement = value.engagement / value.count;
      if (avgDayEngagement > bestDayEngagement && value.count >= 2) {
        bestDayEngagement = avgDayEngagement;
        bestDay = dayNames[day];
      }
    });

    // Detect if threads perform better
    const threadLikePosts = posts.filter(
      (p) => p.text_content.includes("🧵") || p.text_content.includes("1/")
    );
    const regularPosts = posts.filter(
      (p) => !p.text_content.includes("🧵") && !p.text_content.includes("1/")
    );

    let bestFormat = "Single posts";
    if (threadLikePosts.length >= 3 && regularPosts.length >= 3) {
      const threadAvg =
        threadLikePosts.reduce((sum, p) => sum + (p.metrics.likes || 0), 0) /
        threadLikePosts.length;
      const regularAvg =
        regularPosts.reduce((sum, p) => sum + (p.metrics.likes || 0), 0) /
        regularPosts.length;
      bestFormat = threadAvg > regularAvg * 1.2 ? "Threads" : "Single posts";
    }

    // Total stats
    const totalViews = posts.reduce((sum, p) => sum + (p.metrics.views || 0), 0);
    const totalLikes = posts.reduce((sum, p) => sum + (p.metrics.likes || 0), 0);

    return {
      avgLength,
      avgEngagement,
      bestDay,
      bestFormat,
      totalPosts: posts.length,
      totalViews,
      totalLikes,
    };
  }, [posts]);

  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
        <div className="animate-pulse">
          <div className="h-6 bg-slate-800 rounded w-48 mb-4" />
          <div className="grid grid-cols-2 gap-3">
            <div className="h-20 bg-slate-800 rounded" />
            <div className="h-20 bg-slate-800 rounded" />
            <div className="h-20 bg-slate-800 rounded" />
            <div className="h-20 bg-slate-800 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!patterns) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-white mb-2">Content Patterns</h2>
        <p className="text-slate-500">
          No posts yet. Start capturing your posts to see patterns.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
      <h2 className="text-sm font-semibold text-white mb-4">Content Patterns</h2>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-slate-800 rounded-lg p-4">
          <p className="text-sm text-slate-500 mb-1">Total Posts</p>
          <p className="text-xl font-semibold text-white">{patterns.totalPosts}</p>
        </div>
        <div className="bg-slate-800 rounded-lg p-4">
          <p className="text-sm text-slate-500 mb-1">Total Views</p>
          <p className="text-xl font-semibold text-white">{formatNumber(patterns.totalViews)}</p>
        </div>
        <div className="bg-slate-800 rounded-lg p-4">
          <p className="text-sm text-slate-500 mb-1">Total Likes</p>
          <p className="text-xl font-semibold text-white">{formatNumber(patterns.totalLikes)}</p>
        </div>
      </div>

      {/* Pattern Details */}
      <div className="space-y-3">
        <div className="flex items-center justify-between py-3 border-b border-slate-800">
          <span className="text-slate-400">Average post length</span>
          <span className="text-white font-medium">{patterns.avgLength} characters</span>
        </div>
        <div className="flex items-center justify-between py-3 border-b border-slate-800">
          <span className="text-slate-400">Average engagement rate</span>
          <span className="text-white font-medium">{patterns.avgEngagement}%</span>
        </div>
        <div className="flex items-center justify-between py-3 border-b border-slate-800">
          <span className="text-slate-400">Best performing day</span>
          <span className="text-white font-medium">{patterns.bestDay}</span>
        </div>
        <div className="flex items-center justify-between py-3">
          <span className="text-slate-400">Best format</span>
          <span className="text-white font-medium">{patterns.bestFormat}</span>
        </div>
      </div>
    </div>
  );
}
