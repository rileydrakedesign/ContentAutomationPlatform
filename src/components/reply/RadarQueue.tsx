"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Radar, RefreshCw, Reply as ReplyIcon, Clock, X } from "lucide-react";

/**
 * The Radar daily queue (PRD §3.4, beta): "your 20-minute reply session,
 * pre-hunted." Bounded, ranked, each card says why it's here, one primary
 * action. States (new/snoozed/replied/skipped) feed the outcome loop. Renders
 * nothing for non-beta users (403 NOT_BETA).
 */

export interface QueueItem {
  id: string;
  state: "new" | "snoozed";
  score: number;
  reasons: string[];
  watch_label: string | null;
  post: {
    post_id: string;
    text: string;
    author_username: string | null;
    author_name: string | null;
    author_followers: number | null;
    posted_at: string | null;
    metrics: {
      like_count?: number;
      retweet_count?: number;
      reply_count?: number;
      impression_count?: number;
    } | null;
  };
}

export function RadarQueue({
  onWriteReply,
  refreshNonce,
}: {
  /** Hand the target to the composer flow; the parent owns the reply UX. */
  onWriteReply: (item: QueueItem) => void;
  /** Bump to force a refetch (e.g. after a handoff marks an item replied). */
  refreshNonce: number;
}) {
  const [enabled, setEnabled] = useState(true);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [lastSweptAt, setLastSweptAt] = useState<string | null>(null);
  const [unitsPaused, setUnitsPaused] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [sweeping, setSweeping] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch("/api/radar/queue");
      if (res.status === 403) {
        setEnabled(false);
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
      setLastSweptAt(data.last_swept_at ?? null);
      setUnitsPaused(data.units_paused ?? 0);
    } catch {
      // queue is additive — never break the page
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue, refreshNonce]);

  async function sweepNow() {
    setSweeping(true);
    setNotice(null);
    try {
      const res = await fetch("/api/radar/sweep", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice(data.error || "Sweep failed.");
        return;
      }
      const s = data.summary || {};
      setNotice(
        s.queued > 0
          ? `Swept ${s.units_swept} watches — ${s.queued} new targets.`
          : `Swept ${s.units_swept} watches — nothing new since last sweep.`
      );
      await fetchQueue();
    } catch {
      setNotice("Sweep failed.");
    } finally {
      setSweeping(false);
    }
  }

  async function setState(item: QueueItem, state: "snoozed" | "skipped" | "new") {
    // Optimistic: the queue should feel instant.
    setItems((prev) =>
      state === "skipped"
        ? prev.filter((i) => i.id !== item.id)
        : prev.map((i) => (i.id === item.id ? { ...i, state: state as QueueItem["state"] } : i))
    );
    try {
      await fetch(`/api/radar/queue/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state }),
      });
    } catch {
      // refetch will reconcile on next load
    }
  }

  if (!enabled || !loaded) return null;

  const fresh = items.filter((i) => i.state === "new");
  const snoozed = items.filter((i) => i.state === "snoozed");

  return (
    <Card>
      <CardContent>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-primary-500)]/10 flex items-center justify-center">
            <Radar className="w-4 h-4 text-[var(--color-primary-400)]" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Your queue
            </h3>
            <p className="text-xs text-[var(--color-text-muted)]">
              {lastSweptAt
                ? `We watched while you were gone — last sweep ${new Date(lastSweptAt).toLocaleString()}`
                : "First sweep seeds watches from your niche automatically"}
              {unitsPaused > 0 && ` · ${unitsPaused} watch${unitsPaused > 1 ? "es" : ""} paused (daily budget)`}
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={sweepNow}
            loading={sweeping}
            icon={<RefreshCw className="w-4 h-4" />}
          >
            Sweep now
          </Button>
        </div>

        {notice && <p className="text-xs text-[var(--color-text-muted)] mb-2">{notice}</p>}

        {fresh.length === 0 && snoozed.length === 0 ? (
          <p className="text-sm text-[var(--color-text-secondary)] mt-2">
            Queue&apos;s empty. Hit &ldquo;Sweep now&rdquo; — the first sweep builds your watches
            from your analyzed niche and hunts fresh targets.
          </p>
        ) : (
          <div className="space-y-3 mt-3">
            {[...fresh, ...snoozed].map((item) => (
              <div
                key={item.id}
                className={`rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] px-4 py-3 space-y-2 ${
                  item.state === "snoozed" ? "opacity-60" : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[var(--color-text-primary)]">
                    {item.post.author_name || "@" + (item.post.author_username || "unknown")}
                    {item.post.author_username && (
                      <span className="text-[var(--color-text-muted)] font-normal ml-1.5">
                        @{item.post.author_username}
                      </span>
                    )}
                  </span>
                  {item.watch_label && (
                    <Badge variant="primary" size="sm">
                      {item.watch_label}
                    </Badge>
                  )}
                  {item.state === "snoozed" && (
                    <Badge variant="default" size="sm">
                      snoozed
                    </Badge>
                  )}
                </div>

                <p className="text-sm text-[var(--color-text-secondary)] line-clamp-3 whitespace-pre-wrap">
                  {item.post.text}
                </p>

                {item.reasons.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {item.reasons.map((reason) => (
                      <span
                        key={reason}
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] border border-[var(--color-success-500)]/25 bg-[var(--color-success-500)]/5 text-[var(--color-success-400)]"
                      >
                        {reason}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-0.5">
                  <Button
                    size="sm"
                    onClick={() => onWriteReply(item)}
                    icon={<ReplyIcon className="w-4 h-4" />}
                  >
                    Write reply
                  </Button>
                  {item.state === "new" ? (
                    <button
                      onClick={() => setState(item, "snoozed")}
                      className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] px-2 py-1"
                    >
                      <Clock className="w-3.5 h-3.5" /> Snooze
                    </button>
                  ) : (
                    <button
                      onClick={() => setState(item, "new")}
                      className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] px-2 py-1"
                    >
                      <Clock className="w-3.5 h-3.5" /> Unsnooze
                    </button>
                  )}
                  <button
                    onClick={() => setState(item, "skipped")}
                    className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-danger-400)] px-2 py-1"
                  >
                    <X className="w-3.5 h-3.5" /> Skip
                  </button>
                  <a
                    href={
                      item.post.author_username
                        ? `https://x.com/${item.post.author_username}/status/${item.post.post_id}`
                        : `https://x.com/i/status/${item.post.post_id}`
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="ml-auto text-xs text-[var(--color-primary-400)] hover:underline"
                  >
                    view on X ↗
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
