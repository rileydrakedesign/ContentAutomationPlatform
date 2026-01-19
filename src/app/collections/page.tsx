"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Collection, CapturedPost } from "@/types/captured";

export default function CollectionsPage() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [postCounts, setPostCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [creating, setCreating] = useState(false);

  async function fetchData() {
    try {
      const [collectionsRes, postsRes] = await Promise.all([
        fetch("/api/collections"),
        fetch("/api/captured"),
      ]);
      const [collectionsData, postsData]: [Collection[], CapturedPost[]] =
        await Promise.all([collectionsRes.json(), postsRes.json()]);

      setCollections(collectionsData);

      // Count posts per collection
      const counts: Record<string, number> = {};
      postsData.forEach((post) => {
        if (post.collection_id) {
          counts[post.collection_id] = (counts[post.collection_id] || 0) + 1;
        }
      });
      setPostCounts(counts);
    } catch (error) {
      console.error("Failed to fetch collections:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  async function createCollection(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;

    setCreating(true);
    try {
      const res = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          description: newDescription.trim() || null,
        }),
      });

      if (res.ok) {
        setNewName("");
        setNewDescription("");
        setShowCreateForm(false);
        await fetchData();
      }
    } catch (error) {
      console.error("Failed to create collection:", error);
    } finally {
      setCreating(false);
    }
  }

  async function deleteCollection(id: string, name: string) {
    if (!confirm(`Delete collection "${name}"? Posts will be unassigned, not deleted.`))
      return;

    try {
      await fetch(`/api/collections/${id}`, { method: "DELETE" });
      await fetchData();
    } catch (error) {
      console.error("Failed to delete collection:", error);
    }
  }

  if (loading) {
    return <div className="text-zinc-500">Loading collections...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Collections</h1>
          <p className="text-zinc-500 mt-1">Organize your captured posts</p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-4 py-2 bg-white text-zinc-900 font-medium rounded hover:bg-zinc-200 transition"
        >
          New Collection
        </button>
      </div>

      {showCreateForm && (
        <form
          onSubmit={createCollection}
          className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 mb-6"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g., Best performers, Thread ideas..."
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">
                Description (optional)
              </label>
              <input
                type="text"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="What this collection is for..."
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={creating || !newName.trim()}
                className="px-4 py-2 bg-white text-zinc-900 font-medium rounded hover:bg-zinc-200 transition disabled:opacity-50"
              >
                {creating ? "Creating..." : "Create"}
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 bg-zinc-800 text-white rounded hover:bg-zinc-700 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      {collections.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-12 text-center">
          <p className="text-zinc-500 mb-2">No collections yet</p>
          <p className="text-sm text-zinc-600">
            Create a collection to organize your captured posts
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {collections.map((collection) => (
            <div
              key={collection.id}
              className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 hover:border-zinc-700 transition"
            >
              <div className="flex items-start justify-between mb-2">
                <Link
                  href={`/collections/${collection.id}`}
                  className="text-lg font-medium text-white hover:underline"
                >
                  {collection.name}
                </Link>
                <button
                  onClick={() => deleteCollection(collection.id, collection.name)}
                  className="text-sm text-zinc-500 hover:text-red-400 transition"
                >
                  Delete
                </button>
              </div>

              {collection.description && (
                <p className="text-sm text-zinc-500 mb-3">{collection.description}</p>
              )}

              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-400">
                  {postCounts[collection.id] || 0} post
                  {(postCounts[collection.id] || 0) !== 1 ? "s" : ""}
                </span>
                <Link
                  href={`/collections/${collection.id}`}
                  className="text-sm text-zinc-500 hover:text-white transition"
                >
                  View posts
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
