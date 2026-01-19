"use client";

import { useState, useEffect } from "react";
import { CapturedPost, PostMetrics, Collection } from "@/types/captured";

export default function MyPostsPage() {
  const [posts, setPosts] = useState<CapturedPost[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigningCollection, setAssigningCollection] = useState<string | null>(null);

  async function fetchData() {
    try {
      const [postsRes, collectionsRes] = await Promise.all([
        fetch("/api/captured?triaged_as=my_post"),
        fetch("/api/collections"),
      ]);
      const [postsData, collectionsData] = await Promise.all([
        postsRes.json(),
        collectionsRes.json(),
      ]);
      setPosts(postsData);
      setCollections(collectionsData);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  async function assignToCollection(postId: string, collectionId: string | null) {
    try {
      await fetch(`/api/captured/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collection_id: collectionId }),
      });
      await fetchData();
    } catch (error) {
      console.error("Failed to assign collection:", error);
    }
    setAssigningCollection(null);
  }

  function formatMetrics(metrics: PostMetrics) {
    const parts: string[] = [];
    if (metrics.views) parts.push(`${formatNumber(metrics.views)} views`);
    if (metrics.likes) parts.push(`${formatNumber(metrics.likes)} likes`);
    if (metrics.retweets) parts.push(`${formatNumber(metrics.retweets)} RTs`);
    if (metrics.replies) parts.push(`${formatNumber(metrics.replies)} replies`);
    if (metrics.quotes) parts.push(`${formatNumber(metrics.quotes)} quotes`);
    return parts.join(" · ");
  }

  function formatNumber(n: number): string {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
    if (n >= 1000) return (n / 1000).toFixed(1) + "K";
    return n.toString();
  }

  function getCollectionName(collectionId: string | null) {
    if (!collectionId) return null;
    return collections.find((c) => c.id === collectionId)?.name;
  }

  // Sort by engagement (views as primary, likes as secondary)
  const sortedPosts = [...posts].sort((a, b) => {
    const aScore = (a.metrics.views || 0) + (a.metrics.likes || 0) * 10;
    const bScore = (b.metrics.views || 0) + (b.metrics.likes || 0) * 10;
    return bScore - aScore;
  });

  // Calculate aggregate stats
  const totalViews = posts.reduce((sum, p) => sum + (p.metrics.views || 0), 0);
  const totalLikes = posts.reduce((sum, p) => sum + (p.metrics.likes || 0), 0);
  const avgLikes = posts.length > 0 ? Math.round(totalLikes / posts.length) : 0;

  if (loading) {
    return <div className="text-zinc-500">Loading your posts...</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-white">My Posts</h1>
        <p className="text-zinc-500 mt-1">
          {posts.length} post{posts.length !== 1 ? "s" : ""} captured
        </p>
      </div>

      {posts.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <p className="text-sm text-zinc-500 mb-1">Total Views</p>
            <p className="text-2xl font-semibold text-white">
              {formatNumber(totalViews)}
            </p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <p className="text-sm text-zinc-500 mb-1">Total Likes</p>
            <p className="text-2xl font-semibold text-white">
              {formatNumber(totalLikes)}
            </p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <p className="text-sm text-zinc-500 mb-1">Avg Likes/Post</p>
            <p className="text-2xl font-semibold text-white">{avgLikes}</p>
          </div>
        </div>
      )}

      {posts.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-12 text-center">
          <p className="text-zinc-500 mb-2">No posts yet</p>
          <p className="text-sm text-zinc-600">
            Capture your X posts and mark them as &quot;My Post&quot; in the inbox
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedPosts.map((post, index) => (
            <div
              key={post.id}
              className="bg-zinc-900 border border-zinc-800 rounded-lg p-4"
            >
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-800 text-zinc-400 text-sm font-medium">
                  {index + 1}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-zinc-300 whitespace-pre-wrap mb-3">
                    {post.text_content}
                  </p>

                  {Object.keys(post.metrics).length > 0 && (
                    <p className="text-sm text-zinc-400 mb-3">
                      {formatMetrics(post.metrics)}
                    </p>
                  )}

                  <div className="flex items-center gap-4 text-sm">
                    {getCollectionName(post.collection_id) && (
                      <span className="px-2 py-0.5 bg-zinc-800 text-zinc-400 rounded">
                        {getCollectionName(post.collection_id)}
                      </span>
                    )}

                    {assigningCollection === post.id ? (
                      <select
                        autoFocus
                        className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-sm text-white focus:outline-none"
                        value={post.collection_id || ""}
                        onChange={(e) =>
                          assignToCollection(post.id, e.target.value || null)
                        }
                        onBlur={() => setAssigningCollection(null)}
                      >
                        <option value="">No collection</option>
                        {collections.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <button
                        onClick={() => setAssigningCollection(post.id)}
                        className="text-zinc-500 hover:text-white transition"
                      >
                        {post.collection_id ? "Change collection" : "Add to collection"}
                      </button>
                    )}

                    <a
                      href={post.post_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-zinc-500 hover:text-zinc-300 transition"
                    >
                      View on X
                    </a>

                    <span className="text-zinc-600">
                      {new Date(post.captured_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
