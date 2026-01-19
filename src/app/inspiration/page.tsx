"use client";

import { useState, useEffect } from "react";
import type { InspirationPost, VoiceAnalysis, FormatAnalysis } from "@/types/inspiration";

function AnalysisStatusBadge({ status }: { status: string }) {
  const colors = {
    pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    analyzing: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    completed: "bg-green-500/10 text-green-400 border-green-500/20",
    failed: "bg-red-500/10 text-red-400 border-red-500/20",
  };

  return (
    <span className={`text-xs px-2 py-0.5 rounded border ${colors[status as keyof typeof colors] || colors.pending}`}>
      {status === "analyzing" ? "Analyzing..." : status}
    </span>
  );
}

function VoiceAnalysisDisplay({ analysis }: { analysis: VoiceAnalysis }) {
  return (
    <div className="space-y-2 text-sm">
      <div>
        <span className="text-zinc-500">Tone:</span>{" "}
        <span className="text-zinc-300">{analysis.tone.join(", ")}</span>
      </div>
      <div>
        <span className="text-zinc-500">Perspective:</span>{" "}
        <span className="text-zinc-300">{analysis.perspective}</span>
      </div>
      <div>
        <span className="text-zinc-500">Style:</span>{" "}
        <span className="text-zinc-300">{analysis.sentenceStyle}</span>
      </div>
      {analysis.patterns.length > 0 && (
        <div>
          <span className="text-zinc-500">Patterns:</span>
          <ul className="mt-1 space-y-1 text-zinc-400">
            {analysis.patterns.slice(0, 3).map((p, i) => (
              <li key={i} className="text-xs">• {p}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function FormatAnalysisDisplay({ analysis }: { analysis: FormatAnalysis }) {
  return (
    <div className="space-y-2 text-sm">
      <div>
        <span className="text-zinc-500">Structure:</span>{" "}
        <span className="text-zinc-300">{analysis.structure}</span>
      </div>
      <div>
        <span className="text-zinc-500">Length:</span>{" "}
        <span className="text-zinc-300">~{analysis.length} chars</span>
      </div>
      <div>
        <span className="text-zinc-500">Opening:</span>{" "}
        <span className="text-zinc-300">{analysis.openingStyle}</span>
      </div>
      <div>
        <span className="text-zinc-500">Closing:</span>{" "}
        <span className="text-zinc-300">{analysis.closingStyle}</span>
      </div>
    </div>
  );
}

function InspirationCard({
  post,
  onDelete,
  onReanalyze,
}: {
  post: InspirationPost;
  onDelete: (id: string) => void;
  onReanalyze: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <AnalysisStatusBadge status={post.analysis_status} />
          {post.author_handle && (
            <span className="text-xs text-zinc-500">{post.author_handle}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">
            {new Date(post.created_at).toLocaleDateString()}
          </span>
          <button
            onClick={() => onReanalyze(post.id)}
            className="text-xs text-zinc-400 hover:text-blue-400"
            title="Re-analyze"
          >
            ↻
          </button>
          <button
            onClick={() => onDelete(post.id)}
            className="text-xs text-zinc-400 hover:text-red-400"
            title="Delete"
          >
            ×
          </button>
        </div>
      </div>

      {/* Post content preview */}
      <p className={`text-sm text-zinc-300 whitespace-pre-wrap ${expanded ? "" : "line-clamp-3"}`}>
        {post.raw_content}
      </p>
      {post.raw_content.length > 200 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-blue-400 mt-2"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}

      {/* Analysis results */}
      {post.analysis_status === "completed" && (post.voice_analysis || post.format_analysis) && (
        <div className="mt-4 pt-4 border-t border-zinc-800 grid grid-cols-2 gap-4">
          {post.voice_analysis && (
            <div>
              <h4 className="text-xs font-medium text-zinc-400 mb-2">Voice</h4>
              <VoiceAnalysisDisplay analysis={post.voice_analysis} />
            </div>
          )}
          {post.format_analysis && (
            <div>
              <h4 className="text-xs font-medium text-zinc-400 mb-2">Format</h4>
              <FormatAnalysisDisplay analysis={post.format_analysis} />
            </div>
          )}
        </div>
      )}

      {post.source_url && (
        <a
          href={post.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-400 hover:underline block mt-3 truncate"
        >
          {post.source_url}
        </a>
      )}
    </div>
  );
}

function AddInspirationForm({ onSuccess }: { onSuccess: () => void }) {
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/inspiration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim(), url: url.trim() || undefined }),
      });

      if (res.ok) {
        setContent("");
        setUrl("");
        onSuccess();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to add inspiration");
      }
    } catch {
      setError("Failed to add inspiration");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm text-zinc-400 mb-1">
          Paste X Post Content
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Paste the X post you want to use as style inspiration..."
          className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-zinc-600 min-h-[120px]"
        />
      </div>
      <div>
        <label className="block text-sm text-zinc-400 mb-1">
          Source URL (optional)
        </label>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://x.com/username/status/..."
          className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-zinc-600"
        />
      </div>
      {error && (
        <div className="text-sm text-red-400">{error}</div>
      )}
      <button
        type="submit"
        disabled={loading || !content.trim()}
        className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:cursor-not-allowed px-4 py-2 rounded-md text-sm transition"
      >
        {loading ? "Adding & Analyzing..." : "Add Inspiration"}
      </button>
      <p className="text-xs text-zinc-500">
        The post will be automatically analyzed for voice and format characteristics.
      </p>
    </form>
  );
}

export default function InspirationPage() {
  const [posts, setPosts] = useState<InspirationPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  async function fetchPosts() {
    try {
      const res = await fetch("/api/inspiration");
      const data = await res.json();
      setPosts(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPosts();
    // Poll for analysis updates
    const interval = setInterval(() => {
      if (posts.some((p) => p.analysis_status === "analyzing")) {
        fetchPosts();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [posts]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this inspiration post?")) return;

    try {
      const res = await fetch(`/api/inspiration/${id}`, { method: "DELETE" });
      if (res.ok) {
        setPosts(posts.filter((p) => p.id !== id));
      }
    } catch (error) {
      console.error("Failed to delete:", error);
    }
  }

  async function handleReanalyze(id: string) {
    try {
      // Update local state to show analyzing
      setPosts(posts.map((p) => (p.id === id ? { ...p, analysis_status: "analyzing" as const } : p)));

      const res = await fetch(`/api/inspiration/${id}`, { method: "POST" });
      if (res.ok) {
        const updated = await res.json();
        setPosts(posts.map((p) => (p.id === id ? updated : p)));
      }
    } catch (error) {
      console.error("Failed to re-analyze:", error);
      fetchPosts();
    }
  }

  function handleAddSuccess() {
    setShowAddForm(false);
    fetchPosts();
  }

  const analyzedCount = posts.filter((p) => p.analysis_status === "completed").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inspiration Library</h1>
          <p className="text-zinc-400 mt-1">
            {posts.length} posts · {analyzedCount} analyzed
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className={`px-4 py-2 rounded-md text-sm transition ${
            showAddForm
              ? "bg-zinc-700 text-zinc-300"
              : "bg-blue-600 hover:bg-blue-500 text-white"
          }`}
        >
          {showAddForm ? "Cancel" : "+ Add Inspiration"}
        </button>
      </div>

      {showAddForm && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Add Inspiration Post</h2>
          <AddInspirationForm onSuccess={handleAddSuccess} />
        </div>
      )}

      {/* Info box */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
        <p className="text-sm text-zinc-400">
          <strong className="text-zinc-300">How it works:</strong> Add X posts that match the voice and format you want to emulate.
          Each post is analyzed for tone, sentence style, structure, and formatting patterns.
          When generating drafts, select one or more inspiration posts to apply their style to your content.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-zinc-400">Loading inspiration posts...</div>
      ) : posts.length === 0 ? (
        <div className="text-center py-12 text-zinc-400">
          <p>No inspiration posts yet.</p>
          <p className="mt-2 text-sm">Add posts that represent the style you want to emulate.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {posts.map((post) => (
            <InspirationCard
              key={post.id}
              post={post}
              onDelete={handleDelete}
              onReanalyze={handleReanalyze}
            />
          ))}
        </div>
      )}
    </div>
  );
}
