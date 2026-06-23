"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AudioLines } from "lucide-react";
import { useVoiceCheck } from "@/components/create/useVoiceCheck";
import { VoiceCheckResult } from "@/components/create/VoiceCheckResult";
import { isVoiceCheckSurfaced } from "@/lib/voice/publish-gate";
import {
  readPersistedValue,
  writePersistedValue,
  removePersistedValue,
} from "@/hooks/usePersistentState";
import { CharCounter } from "@/components/compose/CharCounter";
import { MediaUploader } from "@/components/compose/MediaUploader";
import { LinkPreview } from "@/components/compose/LinkPreview";
import { parseAttachedMedia, type AttachedMedia } from "@/lib/x-api/media";

type Draft = {
  id: string;
  type: "X_POST" | "X_THREAD";
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
  content: { text: string; media?: unknown };
  onChange: (content: { text: string; media?: AttachedMedia[] }) => void;
}) {
  // Defensive: ensure text exists
  const text = content?.text ?? "";
  const media = parseAttachedMedia(content?.media);

  return (
    <div className="space-y-2">
      <textarea
        value={text}
        onChange={(e) => onChange({ text: e.target.value, media })}
        className="w-full bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary-500)] focus:ring-1 focus:ring-[var(--color-primary-500)] transition min-h-[200px]"
      />
      {/* X-accurate weighted counter (URLs = 23, CJK = 2) */}
      <CharCounter text={text} />

      {/* Link preview for the first URL (URLs still count as 23 above) */}
      <LinkPreview text={text} />

      {/* Media: image/GIF/video with alt text — stored on the draft content */}
      <div className="pt-2">
        <MediaUploader media={media} onChange={(m) => onChange({ text, media: m })} />
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
          <CharCounter text={tweet} />
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

export default function DraftEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editedContent, setEditedContent] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [restoredUnsaved, setRestoredUnsaved] = useState(false);
  const [saving, setSaving] = useState(false);
  // sessionStorage key holding this draft's in-progress (unsaved) edits.
  const bufferKey = `draft:${id}:buf`;
  const [publishing, setPublishing] = useState(false);
  const [scheduleAt, setScheduleAt] = useState<string>("");
  const [publishMessage, setPublishMessage] = useState<string | null>(null);

  // Ambient voice-check: the score must be surfaced before publish/schedule.
  const { checking, result, checkedText, error: voiceError, check, markChecked } = useVoiceCheck("post");

  function currentText(): string {
    if (!editedContent) return "";
    if (draft?.type === "X_POST") return String(editedContent.text || "");
    const tweets = (editedContent.tweets ?? editedContent.posts ?? []) as string[];
    return tweets.filter((t) => t && t.trim()).join("\n\n");
  }

  const text = currentText();
  // "Surfaced" = the score the user is looking at matches the text they'll ship.
  const voiceChecked = isVoiceCheckSurfaced({
    hasResult: result !== null,
    checkedText,
    currentText: text,
  });

  function applyVoiceEdit(newText: string) {
    if (!draft) return;
    if (draft.type === "X_POST") {
      setEditedContent({ text: newText });
    } else {
      setEditedContent({ tweets: newText.split(/\n{2,}/) });
    }
    markChecked(newText);
  }

  useEffect(() => {
    async function fetchDraft() {
      try {
        const res = await fetch(`/api/drafts/${id}`);
        if (res.ok) {
          const data = await res.json();
          setDraft(data);
          const serverContent = data.edited_content || data.content;
          // Re-validate against the server (handoff #8.3): prefer persisted
          // unsaved edits only when they actually differ from what's stored
          // server-side, and tell the user we restored them.
          const buffered = readPersistedValue<Record<string, unknown> | null>(bufferKey, null);
          if (buffered && JSON.stringify(buffered) !== JSON.stringify(serverContent)) {
            setEditedContent(buffered);
            setRestoredUnsaved(true);
          } else {
            setEditedContent(serverContent);
          }
        }
      } finally {
        setLoading(false);
      }
    }
    fetchDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Mirror in-progress edits to sessionStorage so navigating away mid-edit
  // doesn't lose them. Only after the initial load to avoid clobbering.
  useEffect(() => {
    if (loading || !editedContent) return;
    writePersistedValue(bufferKey, editedContent);
  }, [editedContent, loading, bufferKey]);

  function discardUnsaved() {
    if (!draft) return;
    const serverContent = draft.edited_content || draft.content;
    setEditedContent(serverContent);
    removePersistedValue(bufferKey);
    setRestoredUnsaved(false);
  }

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
        // Saved — the buffer now matches the server, clear the "unsaved" state.
        removePersistedValue(bufferKey);
        setRestoredUnsaved(false);
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
        removePersistedValue(bufferKey);
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
        removePersistedValue(bufferKey);
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

  // Voice-check is optional everywhere (handoff #6). Two clearly-labeled paths:
  // a direct Post/Schedule that ships immediately, and a "Voice-check &…" that
  // runs the 3-credit check and surfaces the score first (the user then ships
  // with the same Post/Schedule action). Nothing blocks an un-checked draft.
  async function handlePostNow() {
    if (!text.trim()) return;
    await publishNow();
  }

  async function handleSchedule() {
    if (!scheduleAt) {
      setPublishMessage("Pick a schedule time");
      return;
    }
    if (!text.trim()) return;
    await schedulePublish();
  }

  // Optional: run the voice check and surface the score (does not publish).
  async function handleVoiceCheck() {
    if (!text.trim()) return;
    await check(text);
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

      {restoredUnsaved && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-warning-500)]/30 bg-[var(--color-warning-500)]/5 px-4 py-2.5">
          <p className="text-xs text-[var(--color-text-secondary)]">
            Restored your unsaved edits from before you navigated away. Save to keep them.
          </p>
          <button
            onClick={discardUnsaved}
            className="text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] shrink-0"
          >
            Discard
          </button>
        </div>
      )}

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

          {/* Reply-audience setting — native X composer option */}
          <div className="mb-4 flex items-center gap-2">
            <label className="text-xs text-[var(--color-text-secondary)]">Who can reply</label>
            <select
              value={String((editedContent?.replySettings as string) || "everyone")}
              onChange={(e) =>
                setEditedContent((prev) => ({ ...(prev || {}), replySettings: e.target.value }))
              }
              className="bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] rounded-lg px-2 py-1.5 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary-500)]"
            >
              <option value="everyone">Everyone</option>
              <option value="following">Accounts you follow</option>
              <option value="mentionedUsers">Only accounts you mention</option>
            </select>
          </div>

          {/* Ambient voice-check — surfaced before publish */}
          {voiceError && (
            <div className="mb-3 rounded-xl border border-[var(--color-danger-500)]/30 bg-[var(--color-danger-500)]/5 px-4 py-3">
              <p className="text-sm text-[var(--color-danger-400)]">{voiceError}</p>
            </div>
          )}
          {result ? (
            <VoiceCheckResult
              result={result}
              currentText={text}
              checkedText={checkedText}
              onApplyEdit={applyVoiceEdit}
              className="mb-4"
            />
          ) : (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] px-4 py-3">
              <AudioLines className="w-4 h-4 text-[var(--color-primary-400)] shrink-0 mt-0.5" />
              <p className="text-xs text-[var(--color-text-secondary)]">
                Post directly, or run an optional voice check (3 credits) first to
                see how well this sounds like you — and what&apos;s working — before
                it ships.
              </p>
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

            <div className="flex flex-wrap gap-2">
              {/* Primary: post immediately, no check required */}
              <button
                onClick={handlePostNow}
                disabled={publishing || checking || !text.trim()}
                className="px-4 py-2 bg-[var(--color-primary-500)] text-white rounded-lg text-sm font-medium hover:bg-[var(--color-primary-600)] disabled:opacity-60 transition"
              >
                {publishing ? "Working..." : "Post now"}
              </button>
              <button
                onClick={handleSchedule}
                disabled={publishing || checking || !scheduleAt}
                className="px-4 py-2 bg-[var(--color-bg-elevated)] hover:bg-[var(--color-bg-hover)] border border-[var(--color-border-default)] disabled:opacity-50 rounded-lg text-sm font-medium transition"
              >
                Schedule
              </button>
              {/* Secondary: optional voice-check first */}
              <button
                onClick={handleVoiceCheck}
                disabled={publishing || checking || !text.trim() || voiceChecked}
                className="px-4 py-2 bg-transparent hover:bg-[var(--color-bg-hover)] border border-[var(--color-primary-500)]/40 text-[var(--color-primary-400)] disabled:opacity-50 rounded-lg text-sm font-medium transition"
                title="Run a 3-credit voice check and see the score before you post"
              >
                {checking ? "Checking voice…" : voiceChecked ? "Voice-checked ✓" : "Voice-check first"}
              </button>
            </div>
          </div>

          <p className="mt-3 text-xs text-[var(--color-text-muted)]">
            {voiceChecked
              ? "Voice score reviewed for this exact text — post or schedule when ready."
              : "Requires X connected. Voice-check is optional — post directly or check first."}
          </p>
        </div>
      )}
    </div>
  );
}
