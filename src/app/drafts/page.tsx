"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type Draft = {
  id: string;
  type: "X_POST" | "X_THREAD" | "REEL_SCRIPT";
  status: "PENDING" | "GENERATED" | "APPROVED" | "REJECTED";
  content: Record<string, unknown>;
  source_ids: string[] | null;
  edited_content: Record<string, unknown> | null;
  created_at: string;
};

function DraftCard({ draft }: { draft: Draft }) {
  const statusColors = {
    PENDING: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    GENERATED: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    APPROVED: "bg-green-500/10 text-green-400 border-green-500/20",
    REJECTED: "bg-red-500/10 text-red-400 border-red-500/20",
  };

  const typeLabels = {
    X_POST: "X Post",
    X_THREAD: "X Thread",
    REEL_SCRIPT: "Reel Script",
  };

  function getPreview() {
    const content = draft.edited_content || draft.content;
    if ("text" in content) return content.text as string;
    if ("tweets" in content) return (content.tweets as string[])[0];
    if ("hook" in content) return content.hook as string;
    return JSON.stringify(content);
  }

  return (
    <Link href={`/drafts/${draft.id}`}>
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 hover:border-zinc-700 transition cursor-pointer">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-1 rounded bg-zinc-800 text-zinc-300">
              {typeLabels[draft.type]}
            </span>
            <span
              className={`text-xs px-2 py-1 rounded border ${statusColors[draft.status]}`}
            >
              {draft.status}
            </span>
          </div>
          <span className="text-xs text-zinc-500">
            {new Date(draft.created_at).toLocaleDateString()}
          </span>
        </div>
        <p className="text-sm text-zinc-300 line-clamp-3">{getPreview()}</p>
      </div>
    </Link>
  );
}

export default function DraftsPage() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  async function fetchDrafts() {
    try {
      const res = await fetch("/api/drafts");
      const data = await res.json();
      setDrafts(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDrafts();
  }, []);

  const filteredDrafts = drafts.filter((d) => {
    if (filter === "all") return true;
    return d.status === filter;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Drafts</h1>
          <p className="text-zinc-400 mt-1">Review and approve generated content</p>
        </div>
        <Link
          href="/drafts/generate"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-md text-sm transition"
        >
          Generate New Draft
        </Link>
      </div>

      <div className="flex gap-2">
        {["all", "GENERATED", "APPROVED", "REJECTED"].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-3 py-1.5 rounded-md text-sm transition ${
              filter === status
                ? "bg-zinc-700 text-white"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            }`}
          >
            {status === "all" ? "All" : status.charAt(0) + status.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-zinc-400">Loading drafts...</div>
      ) : filteredDrafts.length === 0 ? (
        <div className="text-center py-12 text-zinc-400">
          {filter === "all"
            ? "No drafts yet. Generate your first draft."
            : `No ${filter.toLowerCase()} drafts.`}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredDrafts.map((draft) => (
            <DraftCard key={draft.id} draft={draft} />
          ))}
        </div>
      )}
    </div>
  );
}
