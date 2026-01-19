"use client";

import { useState, useEffect } from "react";
import { CapturedPost, PostMetrics } from "@/types/captured";

export default function InboxPage() {
  const [posts, setPosts] = useState<CapturedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPosts, setSelectedPosts] = useState<Set<string>>(new Set());
  const [triaging, setTriaging] = useState(false);

  async function fetchPosts() {
    try {
      const res = await fetch("/api/captured?status=inbox");
      const data = await res.json();
      setPosts(data);
    } catch (error) {
      console.error("Failed to fetch inbox:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPosts();
  }, []);

  function toggleSelect(id: string) {
    const newSelected = new Set(selectedPosts);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedPosts(newSelected);
  }

  function selectAll() {
    if (selectedPosts.size === posts.length) {
      setSelectedPosts(new Set());
    } else {
      setSelectedPosts(new Set(posts.map((p) => p.id)));
    }
  }

  async function bulkTriage(triagedAs: "my_post" | "inspiration") {
    if (selectedPosts.size === 0) return;
    setTriaging(true);

    try {
      const promises = Array.from(selectedPosts).map((id) =>
        fetch(`/api/captured/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ triaged_as: triagedAs }),
        })
      );

      await Promise.all(promises);
      setSelectedPosts(new Set());
      await fetchPosts();
    } catch (error) {
      console.error("Failed to triage posts:", error);
    } finally {
      setTriaging(false);
    }
  }

  async function promoteToInspiration(id: string) {
    try {
      const res = await fetch(`/api/captured/${id}/promote`, {
        method: "POST",
      });
      if (res.ok) {
        await fetchPosts();
      }
    } catch (error) {
      console.error("Failed to promote post:", error);
    }
  }

  async function deletePost(id: string) {
    if (!confirm("Delete this post from inbox?")) return;

    try {
      await fetch(`/api/captured/${id}`, { method: "DELETE" });
      await fetchPosts();
    } catch (error) {
      console.error("Failed to delete post:", error);
    }
  }

  function formatMetrics(metrics: PostMetrics) {
    const parts: string[] = [];
    if (metrics.likes) parts.push(`${formatNumber(metrics.likes)} likes`);
    if (metrics.retweets) parts.push(`${formatNumber(metrics.retweets)} RTs`);
    if (metrics.replies) parts.push(`${formatNumber(metrics.replies)} replies`);
    if (metrics.views) parts.push(`${formatNumber(metrics.views)} views`);
    return parts.join(" · ");
  }

  function formatNumber(n: number): string {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
    if (n >= 1000) return (n / 1000).toFixed(1) + "K";
    return n.toString();
  }

  if (loading) {
    return (
      <div className="text-zinc-500">Loading inbox...</div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Inbox</h1>
          <p className="text-zinc-500 mt-1">
            {posts.length} post{posts.length !== 1 ? "s" : ""} waiting to be triaged
          </p>
        </div>
      </div>

      {posts.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={selectAll}
              className="text-sm text-zinc-400 hover:text-white transition"
            >
              {selectedPosts.size === posts.length ? "Deselect all" : "Select all"}
            </button>

            {selectedPosts.size > 0 && (
              <>
                <span className="text-zinc-600">|</span>
                <span className="text-sm text-zinc-400">
                  {selectedPosts.size} selected
                </span>
                <button
                  onClick={() => bulkTriage("my_post")}
                  disabled={triaging}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-500 transition disabled:opacity-50"
                >
                  Mark as My Post
                </button>
                <button
                  onClick={() => bulkTriage("inspiration")}
                  disabled={triaging}
                  className="px-3 py-1 text-sm bg-purple-600 text-white rounded hover:bg-purple-500 transition disabled:opacity-50"
                >
                  Mark as Inspiration
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {posts.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-12 text-center">
          <p className="text-zinc-500 mb-2">Your inbox is empty</p>
          <p className="text-sm text-zinc-600">
            Install the Chrome extension to start capturing posts from X
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <div
              key={post.id}
              className={`bg-zinc-900 border rounded-lg p-4 ${
                selectedPosts.has(post.id)
                  ? "border-blue-500"
                  : "border-zinc-800"
              }`}
            >
              <div className="flex items-start gap-4">
                <input
                  type="checkbox"
                  checked={selectedPosts.has(post.id)}
                  onChange={() => toggleSelect(post.id)}
                  className="mt-1 rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-blue-500"
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    {post.author_name && (
                      <span className="font-medium text-white">
                        {post.author_name}
                      </span>
                    )}
                    <span className="text-zinc-500">@{post.author_handle}</span>
                    {post.is_own_post && (
                      <span className="px-2 py-0.5 text-xs bg-blue-500/20 text-blue-400 rounded">
                        Your post
                      </span>
                    )}
                  </div>

                  <p className="text-zinc-300 whitespace-pre-wrap mb-3">
                    {post.text_content}
                  </p>

                  {Object.keys(post.metrics).length > 0 && (
                    <p className="text-xs text-zinc-500 mb-3">
                      {formatMetrics(post.metrics)}
                    </p>
                  )}

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => promoteToInspiration(post.id)}
                      className="text-sm text-purple-400 hover:text-purple-300 transition"
                    >
                      Promote to Inspiration
                    </button>
                    <a
                      href={post.post_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-zinc-500 hover:text-zinc-300 transition"
                    >
                      View on X
                    </a>
                    <button
                      onClick={() => deletePost(post.id)}
                      className="text-sm text-red-400 hover:text-red-300 transition"
                    >
                      Delete
                    </button>
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
