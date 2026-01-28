"use client";

import { useState } from "react";

interface RefreshButtonProps {
  lastRefreshAt: string | null;
  onRefresh: () => Promise<void>;
}

export function RefreshButton({ lastRefreshAt, onRefresh }: RefreshButtonProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      setMessage(null);

      const res = await fetch("/api/voice/refresh", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to refresh");
      }

      setMessage(`Updated ${data.examples_updated} examples`);
      await onRefresh();

      // Clear message after 3 seconds
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  };

  const formatLastRefresh = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="flex items-center gap-3">
      {message && (
        <span className={`text-sm ${message.includes("failed") ? "text-red-400" : "text-teal-400"}`}>
          {message}
        </span>
      )}
      <div className="text-right">
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="bg-slate-800 hover:bg-slate-700 disabled:bg-slate-800 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          {refreshing ? "Refreshing..." : "Refresh Examples"}
        </button>
        <p className="text-xs text-slate-500 mt-1">
          Last refresh: {formatLastRefresh(lastRefreshAt)}
        </p>
      </div>
    </div>
  );
}
