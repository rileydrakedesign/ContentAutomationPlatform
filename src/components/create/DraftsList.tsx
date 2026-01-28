"use client";

import { useState, useEffect, useMemo } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { DraftCard } from "./DraftCard";

type Draft = {
  id: string;
  type: "X_POST" | "X_THREAD" | "REEL_SCRIPT";
  status: "PENDING" | "GENERATED" | "APPROVED" | "REJECTED";
  content: Record<string, unknown>;
  edited_content: Record<string, unknown> | null;
  created_at: string;
};

type StatusFilter = "all" | "GENERATED" | "APPROVED" | "REJECTED";

interface DraftsListProps {
  initialFilter?: StatusFilter;
}

export function DraftsList({ initialFilter = "all" }: DraftsListProps) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>(initialFilter);

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

  const counts = useMemo(() => ({
    all: drafts.length,
    GENERATED: drafts.filter((d) => d.status === "GENERATED").length,
    APPROVED: drafts.filter((d) => d.status === "APPROVED").length,
    REJECTED: drafts.filter((d) => d.status === "REJECTED").length,
  }), [drafts]);

  const filteredDrafts = useMemo(() => {
    if (filter === "all") return drafts;
    return drafts.filter((d) => d.status === filter);
  }, [drafts, filter]);

  async function handleStatusChange(id: string, status: Draft["status"]) {
    try {
      await fetch(`/api/drafts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      await fetchDrafts();
    } catch (error) {
      console.error("Failed to update draft status:", error);
    }
  }

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
      <Tabs value={filter} onValueChange={(v) => setFilter(v as StatusFilter)}>
        <TabsList>
          <TabsTrigger value="all" count={counts.all}>All</TabsTrigger>
          <TabsTrigger value="GENERATED" count={counts.GENERATED}>Generated</TabsTrigger>
          <TabsTrigger value="APPROVED" count={counts.APPROVED}>Approved</TabsTrigger>
          <TabsTrigger value="REJECTED" count={counts.REJECTED}>Rejected</TabsTrigger>
        </TabsList>
      </Tabs>

      {filteredDrafts.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          {filter === "all"
            ? "No drafts yet. Create your first draft above."
            : `No ${filter.toLowerCase()} drafts.`}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredDrafts.map((draft) => (
            <DraftCard
              key={draft.id}
              draft={draft}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
