"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { CapturedPost } from "@/types/captured";
import { formatNumber, formatRelativeTime } from "@/lib/utils/formatting";
import { Eye, Heart, MessageSquare, Repeat, ExternalLink } from "lucide-react";

export function PerformanceTab() {
  const [posts, setPosts] = useState<CapturedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"engagement" | "views" | "likes" | "recent">("engagement");

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

  function weightedEngagement(p: CapturedPost) {
    const likes = p.metrics.likes || 0;
    const retweets = p.metrics.retweets || 0;
    const replies = p.metrics.replies || 0;
    return likes + retweets * 2 + replies * 3;
  }

  const sortedPosts = [...posts].sort((a, b) => {
    if (sortBy === "engagement") {
      return weightedEngagement(b) - weightedEngagement(a);
    }
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
  const totalEngagement = posts.reduce((sum, p) => sum + weightedEngagement(p), 0);

  const avgEngagementPerPost = posts.length > 0 ? Math.round(totalEngagement / posts.length) : 0;
  const engagementRate = totalViews > 0 ? ((totalEngagement / totalViews) * 100).toFixed(2) : "0";

  const winners = [...posts].sort((a, b) => weightedEngagement(b) - weightedEngagement(a)).slice(0, 5);
  const recent = [...posts].sort((a, b) => new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime()).slice(0, 5);

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
      {/* 1-minute snapshot */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <Eye className="w-4 h-4" />
            <span className="text-xs uppercase">Posts analyzed</span>
          </div>
          <p className="text-2xl font-semibold text-white font-mono">{formatNumber(posts.length)}</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <Heart className="w-4 h-4" />
            <span className="text-xs uppercase">Avg engagement / post</span>
          </div>
          <p className="text-2xl font-semibold text-white font-mono">{formatNumber(avgEngagementPerPost)}</p>
          <p className="text-xs text-slate-500 mt-1">weighted: likes + 2×rts + 3×replies</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <Repeat className="w-4 h-4" />
            <span className="text-xs uppercase">Engagement rate</span>
          </div>
          <p className="text-2xl font-semibold text-white font-mono">{engagementRate}%</p>
          <p className="text-xs text-slate-500 mt-1">vs views (if present)</p>
        </Card>
      </div>

      {/* Winners + recent */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-medium text-white">Top winners</h3>
              <p className="text-xs text-slate-500 mt-1">Best posts by weighted engagement</p>
            </div>
            <a href="/library" className="text-xs text-slate-400 hover:text-white">View all</a>
          </div>

          {winners.length === 0 ? (
            <div className="text-sm text-slate-500">No posts yet. Save your posts with the extension.</div>
          ) : (
            <div className="space-y-2">
              {winners.map((post, index) => (
                <div key={post.id} className="flex items-start gap-3 p-3 bg-slate-800/50 rounded-lg">
                  <div className="flex items-center justify-center w-8 h-8 bg-slate-700 rounded-full text-sm font-medium text-slate-300">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200 line-clamp-2">{post.text_content}</p>
                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-2">
                      <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{formatNumber(post.metrics.views || 0)}</span>
                      <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{formatNumber(post.metrics.likes || 0)}</span>
                      <span className="flex items-center gap-1"><Repeat className="w-3 h-3" />{formatNumber(post.metrics.retweets || 0)}</span>
                      <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{formatNumber(post.metrics.replies || 0)}</span>
                    </div>
                  </div>
                  {post.post_url && (
                    <a href={post.post_url} target="_blank" rel="noopener noreferrer" className="p-2 text-slate-400 hover:text-white">
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
              <h3 className="font-medium text-white">Recent posts</h3>
              <p className="text-xs text-slate-500 mt-1">Most recently captured</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="recent">Recent</option>
                <option value="engagement">Engagement</option>
                <option value="views">Views</option>
                <option value="likes">Likes</option>
              </select>
            </div>
          </div>

          {recent.length === 0 ? (
            <div className="text-sm text-slate-500">No posts yet.</div>
          ) : (
            <div className="space-y-2">
              {(sortBy === "recent" ? recent : sortedPosts.slice(0, 5)).map((post) => (
                <div key={post.id} className="flex items-start gap-3 p-3 bg-slate-800/50 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200 line-clamp-2">{post.text_content}</p>
                    <div className="flex items-center justify-between gap-3 mt-2 text-xs text-slate-500">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{formatNumber(post.metrics.likes || 0)}</span>
                        <span className="flex items-center gap-1"><Repeat className="w-3 h-3" />{formatNumber(post.metrics.retweets || 0)}</span>
                        <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{formatNumber(post.metrics.replies || 0)}</span>
                      </div>
                      <span>{formatRelativeTime(post.captured_at)}</span>
                    </div>
                  </div>
                  {post.post_url && (
                    <a href={post.post_url} target="_blank" rel="noopener noreferrer" className="p-2 text-slate-400 hover:text-white">
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
