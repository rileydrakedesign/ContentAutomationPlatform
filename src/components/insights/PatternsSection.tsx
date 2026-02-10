"use client";

import { useState, useEffect, useMemo } from "react";
import { PostAnalytics } from "@/types/analytics";
import { formatNumber } from "@/lib/utils/formatting";
import { weightedEngagement } from "@/lib/utils/engagement";

export function PatternsSection() {
  const [posts, setPosts] = useState<PostAnalytics[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPosts() {
      try {
        const res = await fetch("/api/analytics/csv");
        const json = await res.json();
        const rows = (json?.data?.posts && Array.isArray(json.data.posts)) ? json.data.posts : [];
        setPosts(rows.filter((p: any) => !p.is_reply));
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
      posts.reduce((sum, p) => sum + (p.text?.length || 0), 0) / posts.length
    );

    // Average engagement per post (weighted), plus rate vs impressions when present
    const engagementVals = posts.map((p: any) => weightedEngagement(p as any));
    const avgEngagement =
      engagementVals.length > 0
        ? Math.round(engagementVals.reduce((a, b) => a + b, 0) / engagementVals.length)
        : 0;

    const totalImpressions = posts.reduce((sum, p) => sum + (p.impressions || 0), 0);
    const engagementRate = totalImpressions > 0
      ? ((engagementVals.reduce((a, b) => a + b, 0) / totalImpressions) * 100).toFixed(2)
      : "0";

    // Best performing day
    const dayMap = new Map<number, { count: number; engagement: number }>();
    posts.forEach((post: any) => {
      const d = post.date ? new Date(String(post.date)) : null;
      if (d && !isNaN(d.getTime())) {
        const day = d.getDay();
        const current = dayMap.get(day) || { count: 0, engagement: 0 };
        const engagement = weightedEngagement(post as any);
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
      (p) => (p.text || "").includes("🧵") || (p.text || "").includes("1/")
    );
    const regularPosts = posts.filter(
      (p) => !(p.text || "").includes("🧵") && !(p.text || "").includes("1/")
    );

    let bestFormat = "Single posts";
    if (threadLikePosts.length >= 3 && regularPosts.length >= 3) {
      const threadAvg =
        threadLikePosts.reduce((sum, p: any) => sum + (p.impressions || 0), 0) /
        threadLikePosts.length;
      const regularAvg =
        regularPosts.reduce((sum, p: any) => sum + (p.impressions || 0), 0) /
        regularPosts.length;
      bestFormat = threadAvg > regularAvg * 1.2 ? "Threads" : "Single posts";
    }

    // Total stats
    const totalLikes = posts.reduce((sum, p) => sum + (p.likes || 0), 0);

    return {
      avgLength,
      avgEngagement,
      engagementRate,
      bestDay,
      bestFormat,
      totalPosts: posts.length,
      totalImpressions,
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
          <p className="text-sm text-slate-500 mb-1">Total Impressions</p>
          <p className="text-xl font-semibold text-white">{formatNumber(patterns.totalImpressions)}</p>
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
          <span className="text-slate-400">Avg engagement / post</span>
          <span className="text-white font-medium">{formatNumber(patterns.avgEngagement)}</span>
        </div>
        <div className="flex items-center justify-between py-3 border-b border-slate-800">
          <span className="text-slate-400">Engagement rate</span>
          <span className="text-white font-medium">{patterns.engagementRate}%</span>
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
