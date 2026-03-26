"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
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
  payload?: Record<string, unknown> | null;
};

function statusBadgeVariant(status: ScheduledPost["status"]) {
  if (status === "posted") return "success" as const;
  if (status === "failed") return "danger" as const;
  if (status === "publishing") return "primary" as const;
  if (status === "cancelled") return "default" as const;
  return "default" as const;
}

function statusDotColor(status: ScheduledPost["status"]) {
  if (status === "scheduled") return "bg-[var(--color-primary-400)]";
  if (status === "posted") return "bg-[var(--color-success-400)]";
  if (status === "failed") return "bg-[var(--color-danger-400)]";
  if (status === "cancelled") return "bg-[var(--color-text-muted)]";
  return "bg-[var(--color-primary-400)]";
}

function getPostPreview(item: ScheduledPost): string {
  if (!item.payload) return "";
  const p = item.payload as Record<string, unknown>;
  if (typeof p.text === "string") return p.text;
  if (Array.isArray(p.tweets) && p.tweets.length > 0) {
    const first = p.tweets[0];
    if (typeof first === "string") return first;
    if (first && typeof first === "object" && "text" in first && typeof (first as Record<string, unknown>).text === "string")
      return (first as Record<string, unknown>).text as string;
  }
  if (typeof p.content === "string") return p.content;
  return "";
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

function ActionButton({
  item,
  workingId,
  onAction,
}: {
  item: ScheduledPost;
  workingId: string | null;
  onAction: (id: string, action: "cancel" | "retry") => void;
}) {
  if (item.status !== "scheduled" && item.status !== "failed") return null;
  const action = item.status === "failed" ? "retry" : "cancel";
  return (
    <button
      onClick={() => onAction(item.id, action)}
      disabled={workingId === item.id}
      className={`px-3 py-1.5 rounded-md text-xs font-medium border transition ${
        action === "retry"
          ? "bg-[var(--color-primary-500)]/10 text-[var(--color-primary-400)] border-[var(--color-primary-500)]/20 hover:bg-[var(--color-primary-500)]/15"
          : "bg-[var(--color-danger-500)]/10 text-[var(--color-danger-400)] border-[var(--color-danger-500)]/20 hover:bg-[var(--color-danger-500)]/15"
      }`}
    >
      {workingId === item.id ? "Working…" : action === "retry" ? "Retry" : "Cancel"}
    </button>
  );
}

export function QueuePage() {
  const [items, setItems] = useState<ScheduledPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);

  // Calendar state
  const now = new Date();
  const [calendarMonth, setCalendarMonth] = useState(now.getMonth());
  const [calendarYear, setCalendarYear] = useState(now.getFullYear());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

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

  async function handleAction(id: string, action: "cancel" | "retry") {
    setWorkingId(id);
    try {
      const endpoint = action === "retry" ? "/api/publish/retry" : "/api/publish/cancel";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) await load();
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
                    Schedule from any draft's Publish panel.
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
                            <ActionButton item={item} workingId={workingId} onAction={handleAction} />
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
                            title={`${post.status} — ${new Date(post.scheduled_for).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`}
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
                  selectedPosts.map((item) => {
                    const preview = getPostPreview(item);
                    return (
                      <Card key={item.id} className="hover:border-[var(--color-border-strong)] transition-all duration-200">
                        <CardContent>
                          <div className="flex items-start justify-between gap-4">
                            <div className="space-y-1 min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="default">{item.content_type === "X_POST" ? "Post" : "Thread"}</Badge>
                                <Badge variant={statusBadgeVariant(item.status)}>{item.status}</Badge>
                                <span className="text-xs text-[var(--color-text-muted)] font-mono tabular-nums">
                                  {new Date(item.scheduled_for).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                                </span>
                              </div>
                              {preview && (
                                <p className="text-sm text-[var(--color-text-secondary)] truncate mt-1">
                                  {preview.length > 120 ? preview.slice(0, 120) + "…" : preview}
                                </p>
                              )}
                              {item.error && (
                                <div className="text-xs text-[var(--color-danger-400)] mt-1">{item.error}</div>
                              )}
                              <div className="mt-2 flex flex-wrap gap-2">
                                <ActionButton item={item} workingId={workingId} onAction={handleAction} />
                              </div>
                            </div>
                            {Array.isArray(item.posted_post_ids) && item.posted_post_ids.length > 0 && (
                              <div className="text-xs text-[var(--color-text-muted)] text-right shrink-0">
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
                    );
                  })
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
