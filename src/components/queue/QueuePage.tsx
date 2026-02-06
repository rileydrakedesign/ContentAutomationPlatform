"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatRelativeTime } from "@/lib/utils/formatting";

type ScheduledPost = {
  id: string;
  content_type: "X_POST" | "X_THREAD";
  scheduled_for: string;
  status: "scheduled" | "publishing" | "posted" | "failed" | "cancelled";
  posted_post_ids: string[] | null;
  error: string | null;
  job_id?: string | null;
  created_at: string;
};

function statusBadgeVariant(status: ScheduledPost["status"]) {
  if (status === "posted") return "success" as const;
  if (status === "failed") return "danger" as const;
  if (status === "publishing") return "primary" as const;
  if (status === "cancelled") return "default" as const;
  return "default" as const;
}

export function QueuePage() {
  const [items, setItems] = useState<ScheduledPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/publish/list?limit=100");
    const data = await res.json();
    setItems(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    async function boot() {
      try {
        await load();
      } finally {
        setLoading(false);
      }
    }
    boot();
  }, []);

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-heading text-2xl font-semibold text-[var(--color-text-primary)]">Queue</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">Scheduled posts and publish status</p>
        </div>
        <Link
          href="/create"
          className="text-sm text-[var(--color-primary-400)] hover:text-[var(--color-primary-300)]"
        >
          Create
        </Link>
      </div>

      {loading ? (
        <div className="text-sm text-[var(--color-text-muted)]">Loading…</div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-sm text-[var(--color-text-secondary)]">No scheduled posts yet.</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              Schedule from any draft’s Publish panel.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Card key={item.id} className="hover:border-[var(--color-border-strong)] transition-all duration-200">
              <CardContent>
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="default">{item.content_type === "X_POST" ? "Post" : "Thread"}</Badge>
                      <Badge variant={statusBadgeVariant(item.status)}>{item.status}</Badge>
                      {item.status === "failed" && (
                        <span className="text-xs text-[var(--color-text-muted)]">retry available</span>
                      )}
                    </div>
                    <div className="text-sm text-[var(--color-text-primary)] font-mono tabular-nums">
                      {new Date(item.scheduled_for).toLocaleString()}
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)]">
                      created {formatRelativeTime(item.created_at)}
                    </div>
                    {item.error && (
                      <div className="text-xs text-[var(--color-danger-400)] mt-2">{item.error}</div>
                    )}

                    <div className="mt-3 flex flex-wrap gap-2">
                      {(item.status === "scheduled" || item.status === "failed") && (
                        <button
                          onClick={async () => {
                            setWorkingId(item.id);
                            try {
                              const endpoint = item.status === "failed" ? "/api/publish/retry" : "/api/publish/cancel";
                              const res = await fetch(endpoint, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ id: item.id }),
                              });
                              if (res.ok) {
                                await load();
                              }
                            } finally {
                              setWorkingId(null);
                            }
                          }}
                          disabled={workingId === item.id}
                          className={`px-3 py-1.5 rounded-md text-xs font-medium border transition ${
                            item.status === "failed"
                              ? "bg-[var(--color-primary-500)]/10 text-[var(--color-primary-400)] border-[var(--color-primary-500)]/20 hover:bg-[var(--color-primary-500)]/15"
                              : "bg-[var(--color-danger-500)]/10 text-[var(--color-danger-400)] border-[var(--color-danger-500)]/20 hover:bg-[var(--color-danger-500)]/15"
                          }`}
                        >
                          {workingId === item.id ? "Working…" : item.status === "failed" ? "Retry" : "Cancel"}
                        </button>
                      )}
                    </div>
                  </div>

                  {Array.isArray(item.posted_post_ids) && item.posted_post_ids.length > 0 && (
                    <div className="text-xs text-[var(--color-text-muted)] text-right">
                      <div>posted ids</div>
                      <div className="font-mono">
                        {item.posted_post_ids.slice(0, 2).join(", ")}
                        {item.posted_post_ids.length > 2 ? "…" : ""}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
