"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { formatRelativeTime } from "@/lib/utils/formatting";
import { useSubscription } from "@/components/auth/SubscriptionProvider";
import { UpgradePrompt } from "@/components/ui/UpgradePrompt";
import { apiFetch } from "@/lib/utils/apiFetch";

type ScheduledPost = {
  id: string;
  content_type: "X_POST" | "X_THREAD";
  scheduled_for: string;
  status: "scheduled" | "publishing" | "posted" | "failed" | "cancelled";
  posted_post_ids: string[] | null;
  error: string | null;
  job_id?: string | null;
  created_at: string;
  payload?: Record<string, unknown> | null;
};

type QueueAction = "cancel" | "retry" | "delete";

function statusBadgeVariant(status: ScheduledPost["status"]) {
  if (status === "posted") return "success" as const;
  if (status === "failed") return "danger" as const;
  if (status === "publishing") return "primary" as const;
  if (status === "cancelled") return "default" as const;
  return "default" as const;
}

function statusLabel(status: ScheduledPost["status"]) {
  switch (status) {
    case "scheduled":
      return "Scheduled";
    case "publishing":
      return "Publishing…";
    case "posted":
      return "Posted";
    case "failed":
      return "Didn't post";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

function statusDotColor(status: ScheduledPost["status"]) {
  if (status === "scheduled") return "bg-[var(--color-primary-400)]";
  if (status === "posted") return "bg-[var(--color-success-400)]";
  if (status === "failed") return "bg-[var(--color-danger-400)]";
  if (status === "cancelled") return "bg-[var(--color-text-muted)]";
  return "bg-[var(--color-primary-400)]";
}

// Turn a raw API/X error into something a human can act on. The raw text is
// still available behind a "details" toggle for debugging.
function friendlyError(raw: string): string {
  const e = raw.toLowerCase();
  if (e.includes("duplicate"))
    return "X rejected this as a duplicate of a recent post. Edit the text and try again.";
  if (e.includes("partially posted"))
    return "Only part of this thread went out before X errored. The rest is kept on the draft so you can finish it — don't retry the whole thread.";
  if (e.includes("401") || e.includes("unauthor") || e.includes("token") || e.includes("reconnect"))
    return "Your X connection expired. Reconnect X in Settings, then retry.";
  if (e.includes("rate limit") || e.includes("429") || e.includes("too many"))
    return "X rate-limited this post. Wait a few minutes, then retry.";
  if (e.includes("forbidden") || e.includes("403"))
    return "X wouldn't allow this post. Check the content and your account status.";
  if (e.includes("media"))
    return "There was a problem with the attached media. Re-add it and try again.";
  return "Something went wrong while posting. You can retry, or edit the draft and reschedule.";
}

// One row per tweet: a single post is [text], a thread is each tweet in order.
function getPostTexts(item: ScheduledPost): string[] {
  if (!item.payload) return [];
  const p = item.payload as Record<string, unknown>;
  if (Array.isArray(p.tweets) || Array.isArray(p.posts)) {
    const arr = (Array.isArray(p.tweets) ? p.tweets : p.posts) as unknown[];
    return arr
      .map((t) => {
        if (typeof t === "string") return t;
        if (t && typeof t === "object" && "text" in t) return String((t as Record<string, unknown>).text || "");
        return "";
      })
      .filter(Boolean);
  }
  if (typeof p.text === "string") return [p.text];
  if (typeof p.content === "string") return [p.content];
  return [];
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function QueueItemCard({
  item,
  workingId,
  onAction,
}: {
  item: ScheduledPost;
  workingId: string | null;
  onAction: (id: string, action: QueueAction) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showErrorDetails, setShowErrorDetails] = useState(false);

  const texts = getPostTexts(item);
  const isThread = item.content_type === "X_THREAD";
  const preview = texts[0] || "";
  const canExpand = isThread ? texts.length > 1 : preview.length > 220;
  const busy = workingId === item.id;

  const canCancel = item.status === "scheduled";
  const canRetry = item.status === "failed";
  const canDelete = item.status !== "publishing";

  return (
    <Card className="hover:border-[var(--color-border-strong)] transition-all duration-200">
      <CardContent>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-2">
            {/* Status row */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="default">{isThread ? "Thread" : "Post"}</Badge>
              <Badge variant={statusBadgeVariant(item.status)}>{statusLabel(item.status)}</Badge>
              {isThread && texts.length > 1 && (
                <span className="text-xs text-[var(--color-text-muted)]">{texts.length} tweets</span>
              )}
            </div>

            {/* Schedule time */}
            <div className="text-sm text-[var(--color-text-primary)] font-mono tabular-nums">
              {new Date(item.scheduled_for).toLocaleString([], {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </div>

            {/* Post text — the actual content, viewable */}
            {preview ? (
              <div className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)]/50 px-3 py-2.5">
                {isThread && expanded ? (
                  <div className="space-y-2">
                    {texts.map((tw, i) => (
                      <div key={i}>
                        <span className="text-[11px] text-[var(--color-text-muted)]">
                          {i + 1}/{texts.length}
                        </span>
                        <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap mt-0.5">
                          {tw}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p
                    className={`text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap ${
                      !expanded ? "line-clamp-3" : ""
                    }`}
                  >
                    {preview}
                  </p>
                )}
                {canExpand && (
                  <button
                    onClick={() => setExpanded((v) => !v)}
                    className="mt-1.5 text-xs font-medium text-[var(--color-primary-400)] hover:text-[var(--color-primary-300)] transition-colors"
                  >
                    {expanded ? "Show less" : isThread ? `Show all ${texts.length} tweets` : "Show more"}
                  </button>
                )}
              </div>
            ) : (
              <p className="text-xs text-[var(--color-text-muted)] italic">No preview available</p>
            )}

            <div className="text-xs text-[var(--color-text-muted)]">
              created {formatRelativeTime(item.created_at)}
            </div>

            {/* Graceful failure message */}
            {item.status === "failed" && item.error && (
              <div className="rounded-lg border border-[var(--color-danger-500)]/20 bg-[var(--color-danger-500)]/5 px-3 py-2">
                <p className="text-xs text-[var(--color-danger-400)]">{friendlyError(item.error)}</p>
                <button
                  onClick={() => setShowErrorDetails((v) => !v)}
                  className="mt-1 text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
                >
                  {showErrorDetails ? "Hide details" : "Details"}
                </button>
                {showErrorDetails && (
                  <p className="mt-1 text-[11px] font-mono text-[var(--color-text-muted)] break-words">
                    {item.error}
                  </p>
                )}
              </div>
            )}

            {/* Posted links */}
            {Array.isArray(item.posted_post_ids) && item.posted_post_ids.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-0.5">
                {item.posted_post_ids.slice(0, 3).map((pid) => (
                  <a
                    key={pid}
                    href={`https://x.com/i/web/status/${pid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[var(--color-primary-400)] hover:text-[var(--color-primary-300)] underline underline-offset-2"
                  >
                    View on X ↗
                  </a>
                ))}
                {item.posted_post_ids.length > 3 && (
                  <span className="text-xs text-[var(--color-text-muted)]">
                    +{item.posted_post_ids.length - 3} more
                  </span>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-2 pt-1">
              {canCancel && (
                <button
                  onClick={() => onAction(item.id, "cancel")}
                  disabled={busy}
                  className="px-3 py-1.5 rounded-md text-xs font-medium border bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] border-[var(--color-border-default)] hover:bg-[var(--color-bg-hover)] disabled:opacity-50 transition"
                >
                  {busy ? "Working…" : "Cancel"}
                </button>
              )}
              {canRetry && (
                <button
                  onClick={() => onAction(item.id, "retry")}
                  disabled={busy}
                  className="px-3 py-1.5 rounded-md text-xs font-medium border bg-[var(--color-primary-500)]/10 text-[var(--color-primary-400)] border-[var(--color-primary-500)]/20 hover:bg-[var(--color-primary-500)]/15 disabled:opacity-50 transition"
                >
                  {busy ? "Working…" : "Retry"}
                </button>
              )}
              {canDelete && (
                <button
                  onClick={() => onAction(item.id, "delete")}
                  disabled={busy}
                  className="px-3 py-1.5 rounded-md text-xs font-medium border bg-transparent text-[var(--color-text-muted)] border-[var(--color-border-default)] hover:text-[var(--color-danger-400)] hover:border-[var(--color-danger-500)]/30 disabled:opacity-50 transition"
                >
                  {busy ? "Working…" : "Delete"}
                </button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function QueuePage() {
  const { canUseFeature } = useSubscription();
  const canSchedule = canUseFeature("scheduling");
  const [items, setItems] = useState<ScheduledPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Calendar state
  const now = new Date();
  const [calendarMonth, setCalendarMonth] = useState(now.getMonth());
  const [calendarYear, setCalendarYear] = useState(now.getFullYear());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  async function load() {
    const data = await apiFetch<ScheduledPost[]>("/api/publish/list?limit=100");
    setItems(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    async function boot() {
      try {
        await load();
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "Failed to load queue");
      } finally {
        setLoading(false);
      }
    }
    boot();
  }, []);

  async function handleAction(id: string, action: QueueAction) {
    if (action === "delete" && !confirm("Delete this post from the queue? This can't be undone.")) {
      return;
    }
    setWorkingId(id);
    setActionError(null);
    try {
      const endpoint =
        action === "retry"
          ? "/api/publish/retry"
          : action === "delete"
            ? "/api/publish/delete"
            : "/api/publish/cancel";
      await apiFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : `Failed to ${action} the post`);
    } finally {
      setWorkingId(null);
    }
  }

  // Group posts by date string (YYYY-MM-DD) for calendar
  const postsByDate = useMemo(() => {
    const map: Record<string, ScheduledPost[]> = {};
    for (const item of items) {
      const dateKey = item.scheduled_for.slice(0, 10);
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(item);
    }
    return map;
  }, [items]);

  // Calendar grid data
  const daysInMonth = getDaysInMonth(calendarYear, calendarMonth);
  const firstDay = getFirstDayOfMonth(calendarYear, calendarMonth);
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  function navigateMonth(delta: number) {
    let m = calendarMonth + delta;
    let y = calendarYear;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setCalendarMonth(m);
    setCalendarYear(y);
    setSelectedDate(null);
  }

  function goToToday() {
    setCalendarMonth(now.getMonth());
    setCalendarYear(now.getFullYear());
    setSelectedDate(null);
  }

  const selectedPosts = selectedDate ? (postsByDate[selectedDate] || []) : [];

  // Surface the most relevant work first in the list: live/queued before history.
  const sortedItems = useMemo(() => {
    const order: Record<ScheduledPost["status"], number> = {
      publishing: 0,
      scheduled: 1,
      failed: 2,
      posted: 3,
      cancelled: 4,
    };
    return [...items].sort((a, b) => {
      const d = order[a.status] - order[b.status];
      if (d !== 0) return d;
      return new Date(a.scheduled_for).getTime() - new Date(b.scheduled_for).getTime();
    });
  }, [items]);

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

      {!canSchedule && (
        <Card>
          <CardContent>
            <UpgradePrompt feature="Post scheduling" variant="overlay" />
          </CardContent>
        </Card>
      )}

      {actionError && (
        <div className="rounded-lg border border-[var(--color-danger-500)]/20 bg-[var(--color-danger-500)]/10 px-4 py-3 text-sm text-[var(--color-danger-400)]">
          {actionError}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-[var(--color-text-muted)]">Loading…</div>
      ) : (
        <Tabs defaultValue="list">
          <TabsList>
            <TabsTrigger value="list">List</TabsTrigger>
            <TabsTrigger value="calendar">Calendar</TabsTrigger>
          </TabsList>

          {/* ── List View ── */}
          <TabsContent value="list" className="mt-4">
            {items.length === 0 ? (
              <Card>
                <CardContent>
                  <p className="text-sm text-[var(--color-text-secondary)]">No scheduled posts yet.</p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">
                    Schedule from any draft&apos;s Publish panel.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {sortedItems.map((item) => (
                  <QueueItemCard
                    key={item.id}
                    item={item}
                    workingId={workingId}
                    onAction={handleAction}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Calendar View ── */}
          <TabsContent value="calendar" className="mt-4 space-y-4">
            {/* Navigation */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => navigateMonth(-1)}
                className="p-2 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                  {MONTH_NAMES[calendarMonth]} {calendarYear}
                </span>
                <button
                  onClick={goToToday}
                  className="px-2 py-1 rounded-md text-xs font-medium text-[var(--color-primary-400)] hover:bg-[var(--color-primary-500)]/10 transition"
                >
                  Today
                </button>
              </div>
              <button
                onClick={() => navigateMonth(1)}
                className="p-2 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>

            {/* Month grid */}
            <div className="grid grid-cols-7 gap-px bg-[var(--color-border-subtle)] rounded-xl overflow-hidden border border-[var(--color-border-subtle)]">
              {/* Day headers */}
              {DAY_HEADERS.map((day) => (
                <div
                  key={day}
                  className="bg-[var(--color-bg-surface)] py-2 text-center text-xs font-medium text-[var(--color-text-muted)]"
                >
                  {day}
                </div>
              ))}

              {/* Empty cells before first day */}
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-start-${i}`} className="bg-[var(--color-bg-base)] min-h-[72px]" />
              ))}

              {/* Day cells */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const postsOnDay = postsByDate[dateStr] || [];
                const isToday = dateStr === todayStr;
                const isSelected = dateStr === selectedDate;

                return (
                  <button
                    key={dateStr}
                    onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                    className={`
                      bg-[var(--color-bg-elevated)] min-h-[72px] p-2 text-left transition-all duration-150 cursor-pointer
                      hover:bg-[var(--color-bg-hover)]
                      ${isSelected ? "ring-2 ring-[var(--color-primary-500)] ring-inset" : ""}
                    `}
                  >
                    <span
                      className={`
                        inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium
                        ${isToday
                          ? "bg-[var(--color-primary-500)] text-white"
                          : "text-[var(--color-text-primary)]"
                        }
                      `}
                    >
                      {day}
                    </span>
                    {postsOnDay.length > 0 && (
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {postsOnDay.slice(0, 3).map((post) => (
                          <span
                            key={post.id}
                            className={`w-2 h-2 rounded-full ${statusDotColor(post.status)}`}
                            title={`${statusLabel(post.status)} — ${new Date(post.scheduled_for).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`}
                          />
                        ))}
                        {postsOnDay.length > 3 && (
                          <span className="text-[10px] leading-none text-[var(--color-text-muted)] ml-0.5">
                            +{postsOnDay.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}

              {/* Empty cells after last day */}
              {(() => {
                const totalCells = firstDay + daysInMonth;
                const remainder = totalCells % 7;
                if (remainder === 0) return null;
                return Array.from({ length: 7 - remainder }).map((_, i) => (
                  <div key={`empty-end-${i}`} className="bg-[var(--color-bg-base)] min-h-[72px]" />
                ));
              })()}
            </div>

            {/* Day detail panel */}
            {selectedDate && (
              <div className="space-y-3 animate-fade-in">
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                  {new Date(selectedDate + "T00:00:00").toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                </h3>
                {selectedPosts.length === 0 ? (
                  <p className="text-xs text-[var(--color-text-muted)]">No posts scheduled for this day.</p>
                ) : (
                  selectedPosts.map((item) => (
                    <QueueItemCard
                      key={item.id}
                      item={item}
                      workingId={workingId}
                      onAction={handleAction}
                    />
                  ))
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
