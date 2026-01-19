"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { Collection, CapturedPost, PostMetrics } from "@/types/captured";

interface CollectionWithPosts extends Collection {
  posts: CapturedPost[];
}

export default function CollectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [collection, setCollection] = useState<CollectionWithPosts | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  async function fetchCollection() {
    try {
      const res = await fetch(`/api/collections/${id}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setCollection(data);
      setEditName(data.name);
      setEditDescription(data.description || "");
    } catch (error) {
      console.error("Failed to fetch collection:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCollection();
  }, [id]);

  async function saveEdit() {
    if (!editName.trim()) return;

    try {
      await fetch(`/api/collections/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDescription.trim() || null,
        }),
      });
      setEditing(false);
      await fetchCollection();
    } catch (error) {
      console.error("Failed to update collection:", error);
    }
  }

  async function removeFromCollection(postId: string) {
    try {
      await fetch(`/api/captured/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collection_id: null }),
      });
      await fetchCollection();
    } catch (error) {
      console.error("Failed to remove post:", error);
    }
  }

  function formatMetrics(metrics: PostMetrics) {
    const parts: string[] = [];
    if (metrics.likes) parts.push(`${formatNumber(metrics.likes)} likes`);
    if (metrics.retweets) parts.push(`${formatNumber(metrics.retweets)} RTs`);
    if (metrics.views) parts.push(`${formatNumber(metrics.views)} views`);
    return parts.join(" · ");
  }

  function formatNumber(n: number): string {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
    if (n >= 1000) return (n / 1000).toFixed(1) + "K";
    return n.toString();
  }

  if (loading) {
    return <div className="text-zinc-500">Loading collection...</div>;
  }

  if (!collection) {
    return (
      <div className="text-center py-12">
        <p className="text-zinc-500 mb-4">Collection not found</p>
        <Link href="/collections" className="text-blue-400 hover:underline">
          Back to collections
        </Link>
      </div>
    );
  }

  return (
    <div>
      <Link
        href="/collections"
        className="text-sm text-zinc-500 hover:text-white transition mb-4 inline-block"
      >
        &larr; Back to collections
      </Link>

      <div className="flex items-start justify-between mb-6">
        {editing ? (
          <div className="flex-1 max-w-lg space-y-3">
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white text-xl font-semibold focus:outline-none focus:border-zinc-500"
              autoFocus
            />
            <input
              type="text"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Description (optional)"
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white focus:outline-none focus:border-zinc-500"
            />
            <div className="flex gap-2">
              <button
                onClick={saveEdit}
                className="px-4 py-2 bg-white text-zinc-900 font-medium rounded hover:bg-zinc-200 transition"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  setEditName(collection.name);
                  setEditDescription(collection.description || "");
                }}
                className="px-4 py-2 bg-zinc-800 text-white rounded hover:bg-zinc-700 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div>
            <h1 className="text-2xl font-semibold text-white">{collection.name}</h1>
            {collection.description && (
              <p className="text-zinc-500 mt-1">{collection.description}</p>
            )}
            <p className="text-sm text-zinc-600 mt-2">
              {collection.posts.length} post
              {collection.posts.length !== 1 ? "s" : ""}
            </p>
          </div>
        )}

        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-sm text-zinc-500 hover:text-white transition"
          >
            Edit
          </button>
        )}
      </div>

      {collection.posts.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-12 text-center">
          <p className="text-zinc-500">No posts in this collection</p>
        </div>
      ) : (
        <div className="space-y-4">
          {collection.posts.map((post) => (
            <div
              key={post.id}
              className="bg-zinc-900 border border-zinc-800 rounded-lg p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                {post.author_name && (
                  <span className="font-medium text-white">{post.author_name}</span>
                )}
                <span className="text-zinc-500">@{post.author_handle}</span>
                {post.triaged_as === "my_post" && (
                  <span className="px-2 py-0.5 text-xs bg-blue-500/20 text-blue-400 rounded">
                    Your post
                  </span>
                )}
                {post.triaged_as === "inspiration" && (
                  <span className="px-2 py-0.5 text-xs bg-purple-500/20 text-purple-400 rounded">
                    Inspiration
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

              <div className="flex items-center gap-3 text-sm">
                <a
                  href={post.post_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-zinc-500 hover:text-zinc-300 transition"
                >
                  View on X
                </a>
                <button
                  onClick={() => removeFromCollection(post.id)}
                  className="text-zinc-500 hover:text-red-400 transition"
                >
                  Remove from collection
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
