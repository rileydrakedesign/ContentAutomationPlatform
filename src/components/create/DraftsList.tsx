"use client";

import { useState, useEffect } from "react";
import { DraftCard } from "./DraftCard";

type Draft = {
  id: string;
  type: "X_POST" | "X_THREAD" | "REEL_SCRIPT";
  status: "DRAFT" | "POSTED" | "SCHEDULED" | "REJECTED";
  content: Record<string, unknown>;
  edited_content: Record<string, unknown> | null;
  created_at: string;
};

export function DraftsList() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);

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

  async function handleDelete(id: string) {
    if (!confirm("Delete this draft?")) return;

    try {
      await fetch(`/api/drafts/${id}`, { method: "DELETE" });
      await fetchDrafts();
    } catch (error) {
      console.error("Failed to delete draft:", error);
    }
  }

  if (loading) {
    return <div className="text-slate-500 py-8 text-center">Loading drafts...</div>;
  }

  return (
    <div className="space-y-4">
      {drafts.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          No drafts yet. Create your first draft above.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {drafts.map((draft) => (
            <DraftCard
              key={draft.id}
              draft={draft}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
