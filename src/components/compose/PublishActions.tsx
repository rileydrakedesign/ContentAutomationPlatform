"use client";

import { useState } from "react";

/**
 * The ONE publish surface — reply-audience setting, schedule picker, and the
 * Post now / Schedule actions — shared by every composer (the Create page's
 * Write tab and the saved-draft editor). Extracted from DraftEditor so
 * publishing lives WHERE the user writes instead of forcing a hop to a second
 * compose box that cold-starts the assistant session.
 *
 * The host owns the content payload and what happens after success (cleanup +
 * navigation); this component owns the publish calls, their in-flight state,
 * and their error copy.
 */
export function PublishActions({
  contentType,
  payload,
  draftId,
  canPublish,
  replySettings,
  onReplySettingsChange,
  onPublished,
}: {
  contentType: "X_POST" | "X_THREAD";
  /** The full content payload to publish (text/media/poll or tweets). */
  payload: Record<string, unknown>;
  /** Saved-draft id; omit for a transient composition (never becomes a row). */
  draftId?: string;
  /** False while there's no publishable text. */
  canPublish: boolean;
  replySettings: string;
  onReplySettingsChange: (value: string) => void;
  /** Success: the host clears its buffers and navigates. */
  onPublished: (kind: "now" | "scheduled") => void;
}) {
  const [scheduleAt, setScheduleAt] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function run(kind: "now" | "scheduled") {
    if (!canPublish) return;
    if (kind === "scheduled" && !scheduleAt) {
      setMessage("Pick a schedule time");
      return;
    }
    setPublishing(true);
    setMessage(null);
    try {
      const res = await fetch(kind === "now" ? "/api/publish/now" : "/api/publish/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftId: draftId || undefined,
          contentType,
          payload: { ...payload, replySettings },
          ...(kind === "scheduled"
            ? { scheduledFor: new Date(scheduleAt).toISOString() }
            : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        onPublished(kind);
        return;
      }
      setMessage(
        (data as { error?: string }).error ||
          (kind === "now" ? "Failed to publish" : "Failed to schedule")
      );
    } catch {
      setMessage(kind === "now" ? "Failed to publish" : "Failed to schedule");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] rounded-xl p-4">
      <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Publish</h2>

      {message && (
        <div className="mb-3 text-sm text-[var(--color-text-secondary)]">{message}</div>
      )}

      {/* Reply-audience setting — native X composer option */}
      <div className="mb-4 flex items-center gap-2">
        <label className="text-xs text-[var(--color-text-secondary)]">Who can reply</label>
        <select
          value={replySettings || "everyone"}
          onChange={(e) => onReplySettingsChange(e.target.value)}
          className="bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] rounded-lg px-2 py-1.5 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent-500)]"
        >
          <option value="everyone">Everyone</option>
          <option value="following">Accounts you follow</option>
          <option value="mentionedUsers">Only accounts you mention</option>
        </select>
      </div>

      <div className="flex flex-col md:flex-row gap-3 md:items-end md:justify-between">
        <div className="flex flex-col gap-2">
          <label className="text-xs text-[var(--color-text-secondary)]">Schedule time</label>
          <input
            type="datetime-local"
            value={scheduleAt}
            onChange={(e) => setScheduleAt(e.target.value)}
            className="bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent-500)] focus:ring-1 focus:ring-[var(--color-accent-500)] transition-colors duration-100"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => run("now")}
            disabled={publishing || !canPublish}
            className="px-4 py-2 bg-[var(--color-primary-500)] text-[var(--color-text-inverse)] rounded-lg text-sm font-medium hover:bg-[var(--color-primary-600)] disabled:opacity-60 transition-colors duration-100"
          >
            {publishing ? "Working..." : "Post now"}
          </button>
          <button
            onClick={() => run("scheduled")}
            disabled={publishing || !scheduleAt || !canPublish}
            className="px-4 py-2 bg-[var(--color-bg-elevated)] hover:bg-[var(--color-bg-hover)] border border-[var(--color-border-default)] disabled:opacity-50 rounded-lg text-sm font-medium transition-colors duration-100"
          >
            Schedule
          </button>
        </div>
      </div>

      <p className="mt-3 text-xs text-[var(--color-text-muted)]">
        Requires X connected. The editor checks voice, reach, and correctness as
        you write — post or schedule when you&apos;re happy with it.
      </p>
    </div>
  );
}
