"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Draft = {
  id: string;
  type: "X_POST" | "X_THREAD" | "REEL_SCRIPT";
  status: "DRAFT" | "POSTED" | "SCHEDULED" | "REJECTED";
  content: Record<string, unknown>;
  source_ids: string[] | null;
  edited_content: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

function XPostEditor({
  content,
  onChange,
}: {
  content: { text: string };
  onChange: (content: { text: string }) => void;
}) {
  // Defensive: ensure text exists
  const text = content?.text ?? "";
  const charCount = text.length;
  const maxChars = 25000;
  const isOverLimit = charCount > maxChars;

  return (
    <div className="space-y-2">
      <textarea
        value={text}
        onChange={(e) => onChange({ text: e.target.value })}
        className="w-full bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary-500)] focus:ring-1 focus:ring-[var(--color-primary-500)] transition min-h-[200px]"
      />
      <div className={`text-sm ${isOverLimit ? "text-[var(--color-danger-400)]" : "text-[var(--color-text-secondary)]"}`}>
        {charCount.toLocaleString()}/{maxChars.toLocaleString()} characters
      </div>
    </div>
  );
}

function XThreadEditor({
  content,
  onChange,
}: {
  content: { tweets?: string[]; posts?: string[] };
  onChange: (content: { tweets: string[] }) => void;
}) {
  // Defensive: accept either { tweets: string[] } (canonical) or legacy { posts: string[] }
  const tweets = content.tweets ?? content.posts ?? [""];

  function updateTweet(index: number, value: string) {
    const newTweets = [...tweets];
    newTweets[index] = value;
    onChange({ tweets: newTweets });
  }

  function addTweet() {
    onChange({ tweets: [...tweets, ""] });
  }

  function removeTweet(index: number) {
    const newTweets = tweets.filter((_, i) => i !== index);
    onChange({ tweets: newTweets });
  }

  return (
    <div className="space-y-4">
      {tweets.map((tweet, index) => (
        <div key={index} className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--color-text-secondary)]">Tweet {index + 1}</span>
            {tweets.length > 1 && (
              <button
                onClick={() => removeTweet(index)}
                className="text-xs text-[var(--color-danger-400)] hover:text-[var(--color-danger-300)]"
              >
                Remove
              </button>
            )}
          </div>
          <textarea
            value={tweet}
            onChange={(e) => updateTweet(index, e.target.value)}
            className="w-full bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary-500)] focus:ring-1 focus:ring-[var(--color-primary-500)] transition"
            rows={3}
          />
          <div className={`text-xs ${tweet.length > 25000 ? "text-[var(--color-danger-400)]" : "text-[var(--color-text-muted)]"}`}>
            {tweet.length.toLocaleString()}/25,000
          </div>
        </div>
      ))}
      {tweets.length < 6 && (
        <button
          onClick={addTweet}
          className="text-sm text-[var(--color-primary-400)] hover:text-[var(--color-primary-300)]"
        >
          + Add Tweet
        </button>
      )}
    </div>
  );
}

type ReelScriptContent = {
  hook: string;
  body: string;
  callToAction: string;
  estimatedDuration: string;
};

function ReelScriptEditor({
  content,
  onChange,
}: {
  content: ReelScriptContent;
  onChange: (content: ReelScriptContent) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Hook (3-5 seconds)</label>
        <textarea
          value={content.hook}
          onChange={(e) => onChange({ ...content, hook: e.target.value })}
          className="w-full bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary-500)] focus:ring-1 focus:ring-[var(--color-primary-500)] transition"
          rows={2}
        />
      </div>
      <div>
        <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Body</label>
        <textarea
          value={content.body}
          onChange={(e) => onChange({ ...content, body: e.target.value })}
          className="w-full bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary-500)] focus:ring-1 focus:ring-[var(--color-primary-500)] transition"
          rows={4}
        />
      </div>
      <div>
        <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Call to Action</label>
        <textarea
          value={content.callToAction}
          onChange={(e) => onChange({ ...content, callToAction: e.target.value })}
          className="w-full bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary-500)] focus:ring-1 focus:ring-[var(--color-primary-500)] transition"
          rows={2}
        />
      </div>
      <div>
        <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Estimated Duration</label>
        <input
          type="text"
          value={content.estimatedDuration}
          onChange={(e) => onChange({ ...content, estimatedDuration: e.target.value })}
          className="w-full bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary-500)] focus:ring-1 focus:ring-[var(--color-primary-500)] transition"
        />
      </div>
    </div>
  );
}

export default function DraftEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editedContent, setEditedContent] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [scheduleAt, setScheduleAt] = useState<string>("");
  const [publishMessage, setPublishMessage] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDraft() {
      try {
        const res = await fetch(`/api/drafts/${id}`);
        if (res.ok) {
          const data = await res.json();
          setDraft(data);
          setEditedContent(data.edited_content || data.content);
        }
      } finally {
        setLoading(false);
      }
    }
    fetchDraft();
  }, [id]);

  async function saveEdits() {
    setSaving(true);
    try {
      const res = await fetch(`/api/drafts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ editedContent }),
      });
      if (res.ok) {
        const data = await res.json();
        setDraft(data);
      }
    } finally {
      setSaving(false);
    }
  }

  async function publishNow() {
    if (!draft || !editedContent) return;
    if (draft.type !== "X_POST" && draft.type !== "X_THREAD") return;

    setPublishing(true);
    setPublishMessage(null);

    try {
      const res = await fetch("/api/publish/now", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftId: draft.id,
          contentType: draft.type,
          payload: editedContent,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        router.push("/create?tab=drafts");
        return;
      } else {
        setPublishMessage(data.error || "Failed to publish");
      }
    } catch {
      setPublishMessage("Failed to publish");
    } finally {
      setPublishing(false);
    }
  }

  async function schedulePublish() {
    if (!draft || !editedContent) return;
    if (draft.type !== "X_POST" && draft.type !== "X_THREAD") return;

    if (!scheduleAt) {
      setPublishMessage("Pick a schedule time");
      return;
    }

    setPublishing(true);
    setPublishMessage(null);

    try {
      const res = await fetch("/api/publish/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftId: draft.id,
          contentType: draft.type,
          payload: editedContent,
          scheduledFor: new Date(scheduleAt).toISOString(),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        router.push("/create?tab=drafts");
        return;
      } else {
        setPublishMessage(data.error || "Failed to schedule");
      }
    } catch {
      setPublishMessage("Failed to schedule");
    } finally {
      setPublishing(false);
    }
  }

  if (loading) {
    return <div className="text-center py-12 text-[var(--color-text-secondary)]">Loading draft...</div>;
  }

  if (!draft) {
    return <div className="text-center py-12 text-[var(--color-text-secondary)]">Draft not found</div>;
  }

  const typeLabels = {
    X_POST: "X Post",
    X_THREAD: "X Thread",
    REEL_SCRIPT: "Reel Script",
  };

  const statusColors: Record<string, string> = {
    DRAFT: "bg-[var(--color-warning-500)]/10 text-[var(--color-warning-400)] border-[var(--color-warning-500)]/20",
    POSTED: "bg-[var(--color-success-500)]/10 text-[var(--color-success-400)] border-[var(--color-success-500)]/20",
    SCHEDULED: "bg-[var(--color-primary-500)]/10 text-[var(--color-primary-400)] border-[var(--color-primary-500)]/20",
    REJECTED: "bg-[var(--color-danger-500)]/10 text-[var(--color-danger-400)] border-[var(--color-danger-500)]/20",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/drafts" className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
            &larr; Back
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-1 rounded-lg bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)]">
              {typeLabels[draft.type]}
            </span>
            <span
              className={`text-xs px-2 py-1 rounded-lg border ${statusColors[draft.status]}`}
            >
              {draft.status}
            </span>
          </div>
        </div>
        <div className="text-sm text-[var(--color-text-secondary)]">
          Created {new Date(draft.created_at).toLocaleString()}
        </div>
      </div>

      <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] rounded-xl p-4">
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Edit Content</h2>

        {draft.type === "X_POST" && editedContent && (
          <XPostEditor
            content={editedContent as { text: string }}
            onChange={setEditedContent}
          />
        )}

        {draft.type === "X_THREAD" && editedContent && (
          <XThreadEditor
            content={editedContent as { tweets: string[] }}
            onChange={setEditedContent}
          />
        )}

        {draft.type === "REEL_SCRIPT" && editedContent && (
          <ReelScriptEditor
            content={editedContent as ReelScriptContent}
            onChange={setEditedContent}
          />
        )}
      </div>

      <div className="flex items-center">
        <button
          onClick={saveEdits}
          disabled={saving}
          className="px-4 py-2 bg-[var(--color-bg-elevated)] hover:bg-[var(--color-bg-hover)] border border-[var(--color-border-default)] disabled:opacity-50 rounded-lg text-sm transition"
        >
          {saving ? "Saving..." : "Save Edits"}
        </button>
      </div>

      {(draft.type === "X_POST" || draft.type === "X_THREAD") && (
        <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] rounded-xl p-4">
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Publish</h2>

          {publishMessage && (
            <div className="mb-3 text-sm text-[var(--color-text-secondary)]">
              {publishMessage}
            </div>
          )}

          <div className="flex flex-col md:flex-row gap-3 md:items-end md:justify-between">
            <div className="flex flex-col gap-2">
              <label className="text-xs text-[var(--color-text-secondary)]">Schedule time</label>
              <input
                type="datetime-local"
                value={scheduleAt}
                onChange={(e) => setScheduleAt(e.target.value)}
                className="bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary-500)] focus:ring-1 focus:ring-[var(--color-primary-500)] transition"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={publishNow}
                disabled={publishing}
                className="px-4 py-2 bg-[var(--color-primary-500)] text-white rounded-lg text-sm font-medium hover:bg-[var(--color-primary-600)] disabled:opacity-60 transition"
              >
                {publishing ? "Working..." : "Post now"}
              </button>
              <button
                onClick={schedulePublish}
                disabled={publishing || !scheduleAt}
                className="px-4 py-2 bg-[var(--color-bg-elevated)] hover:bg-[var(--color-bg-hover)] border border-[var(--color-border-default)] disabled:opacity-50 rounded-lg text-sm font-medium transition"
              >
                Schedule
              </button>
            </div>
          </div>

          <p className="mt-3 text-xs text-[var(--color-text-muted)]">
            Requires: X connected + BYO X API credentials saved.
          </p>
        </div>
      )}
    </div>
  );
}
