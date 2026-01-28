"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { CapturedPost } from "@/types/captured";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { PostCard } from "./PostCard";

type LibraryFilter = "my_posts" | "inspiration";

export function LibraryPage() {
  const searchParams = useSearchParams();
  const initialFilter = (searchParams.get("filter") as LibraryFilter) || "my_posts";

  const [posts, setPosts] = useState<CapturedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<LibraryFilter>(initialFilter);

  async function fetchPosts() {
    try {
      const res = await fetch("/api/captured");
      const data = await res.json();
      setPosts(data);
    } catch (error) {
      console.error("Failed to fetch posts:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPosts();
  }, []);

  // Calculate counts
  const counts = useMemo(() => ({
    my_posts: posts.filter((p) => p.triaged_as === "my_post").length,
    inspiration: posts.filter((p) => p.triaged_as === "inspiration").length,
  }), [posts]);

  // Filter posts
  const filteredPosts = useMemo(() => {
    return posts.filter((p) => p.triaged_as === filter);
  }, [posts, filter]);

  // Sort by date (most recent first)
  const sortedPosts = useMemo(() => {
    return [...filteredPosts].sort((a, b) =>
      new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime()
    );
  }, [filteredPosts]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this post?")) return;

    try {
      await fetch(`/api/captured/${id}`, { method: "DELETE" });
      await fetchPosts();
    } catch (error) {
      console.error("Failed to delete post:", error);
    }
  }

  async function handlePromoteToInspiration(id: string) {
    try {
      const res = await fetch(`/api/captured/${id}/promote`, { method: "POST" });
      if (res.ok) {
        await fetchPosts();
      }
    } catch (error) {
      console.error("Failed to promote post:", error);
    }
  }

  if (loading) {
    return <div className="text-slate-500">Loading library...</div>;
  }

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-white">Library</h1>
        <p className="text-slate-500 mt-1">Your posts and inspiration</p>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as LibraryFilter)}>
        <TabsList className="mb-4">
          <TabsTrigger value="my_posts" count={counts.my_posts}>
            My Posts
          </TabsTrigger>
          <TabsTrigger value="inspiration" count={counts.inspiration}>
            Inspiration
          </TabsTrigger>
        </TabsList>

        <TabsContent value="my_posts">
          {sortedPosts.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-12 text-center">
              <p className="text-slate-500 mb-2">No posts yet</p>
              <p className="text-sm text-slate-600">
                Connect your X account in Settings to sync your posts
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedPosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onDelete={handleDelete}
                  onPromoteToInspiration={handlePromoteToInspiration}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="inspiration">
          {sortedPosts.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-12 text-center">
              <p className="text-slate-500 mb-2">No inspiration saved</p>
              <p className="text-sm text-slate-600">
                Promote your top-performing posts to use as style references
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedPosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
