"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  readPersistedValue,
  writePersistedValue,
  removePersistedValue,
} from "@/hooks/usePersistentState";
import { HighlightedTextarea } from "@/components/compose/HighlightedTextarea";
import { ThreadTweetEditor } from "@/components/compose/ThreadTweetEditor";
import { AssistantScorePanel, AssistantSuggestionList } from "@/components/assistant/AssistantPanel";
import { useAssistant } from "@/components/assistant/useAssistant";
import { useVoiceGuardrails } from "@/components/assistant/useVoiceGuardrails";
import { MediaUploader } from "@/components/compose/MediaUploader";
import { LinkPreview } from "@/components/compose/LinkPreview";
import { PollEditor } from "@/components/compose/PollEditor";
import { PublishActions } from "@/components/compose/PublishActions";
import { parseAttachedMedia, type AttachedMedia } from "@/lib/x-api/media";
import { parseDraftPoll, type DraftPoll } from "@/lib/x-api/poll";
import { GripVertical, ChevronUp, ChevronDown } from "lucide-react";

export type DraftType = "X_POST" | "X_THREAD";
export type DraftStatus = "DRAFT" | "POSTED" | "SCHEDULED" | "REJECTED";

function XPostEditor({
  content,
  onChange,
}: {
  content: { text: string; media?: unknown; poll?: unknown };
  onChange: (content: { text: string; media?: AttachedMedia[]; poll?: DraftPoll | null }) => void;
}) {
  // Defensive: ensure text exists
  const text = content?.text ?? "";
  const media = parseAttachedMedia(content?.media);
  const poll = parseDraftPoll(content?.poll);

  // X allows media OR a poll on a post, never both.
  function set(updated: { text?: string; media?: AttachedMedia[]; poll?: DraftPoll | null }) {
    onChange({
      text: updated.text ?? text,
      media: updated.media ?? media,
      poll: updated.poll !== undefined ? updated.poll : poll,
    });
  }

  // Writing assistant (Grammarly-for-tweets).
  const { avoidWords, authenticity } = useVoiceGuardrails("post");
  const assistant = useAssistant({
    text,
    onChangeText: (t) => set({ text: t }),
    voiceType: "post",
    hasMedia: media.length > 0,
    avoidWords,
    authenticity,
    enabled: true,
    autoLiveRead: true,
  });

  const composer = (
    <HighlightedTextarea
      value={text}
      onChange={(t) => set({ text: t })}
      findings={assistant.report.findings}
      onAccept={assistant.accept}
      onDismiss={assistant.dismiss}
      minHeightClass="min-h-[200px]"
    />
  );

  const editorBody = (
    <div className="space-y-3">
      {composer}

      {/* Link preview for the first URL (URLs still count as 23 above) */}
      <LinkPreview text={text} />

      {/* Media: image/GIF/video with alt text — hidden while a poll is attached */}
      {!poll && (
        <div className="pt-1">
          <MediaUploader media={media} onChange={(m) => set({ media: m })} />
        </div>
      )}

      {/* Poll — mutually exclusive with media */}
      <PollEditor poll={poll} onChange={(p) => set({ poll: p })} disabled={!poll && media.length > 0} />
    </div>
  );

  // Editor + holistic score share one row (score centered inline); the suggestion
  // list flows full-width below (UX §5).
  const hasContent = text.trim().length > 0;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-center">
        {editorBody}
        <AssistantScorePanel
          report={assistant.report}
          hasContent={hasContent}
          checking={assistant.checking}
          stale={assistant.stale}
          liveError={assistant.liveError}
          scoreUnavailable={assistant.scoreUnavailable}
        />
      </div>
      <AssistantSuggestionList
        report={assistant.report}
        hasContent={hasContent}
        checking={assistant.checking}
        onAccept={assistant.accept}
        onDismiss={assistant.dismiss}
      />
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
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  // Which tweet has the assistant's full attention (score panel + auto L3 read).
  const [focusedIndex, setFocusedIndex] = useState(0);

  // Voice guardrails fetched once for the whole thread, passed to every tweet.
  const { avoidWords, authenticity } = useVoiceGuardrails("post");

  function updateTweet(index: number, value: string) {
    const newTweets = [...tweets];
    newTweets[index] = value;
    onChange({ tweets: newTweets });
  }

  function addTweet() {
    onChange({ tweets: [...tweets, ""] });
    setFocusedIndex(tweets.length);
  }

  function removeTweet(index: number) {
    const newTweets = tweets.filter((_, i) => i !== index);
    onChange({ tweets: newTweets });
    setFocusedIndex((f) => Math.min(f > index ? f - 1 : f, Math.max(0, newTweets.length - 1)));
  }

  // Reorder: drag the grip handle, or use the up/down buttons (keyboard-accessible).
  function move(from: number, to: number) {
    if (to < 0 || to >= tweets.length || from === to) return;
    const next = [...tweets];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange({ tweets: next });
    // Keep the assistant focus on the tweet that moved.
    setFocusedIndex((f) => (f === from ? to : f));
  }

  return (
    <div className="space-y-4">
      {tweets.map((tweet, index) => (
        <div
          key={index}
          onDragOver={(e) => {
            if (dragIndex !== null) e.preventDefault();
          }}
          onDrop={() => {
            if (dragIndex !== null) move(dragIndex, index);
            setDragIndex(null);
          }}
          className={`space-y-1 rounded-lg transition ${
            dragIndex === index ? "opacity-50" : ""
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {/* Drag handle — only the handle is draggable so text selection in
                  the textarea keeps working. */}
              <span
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragEnd={() => setDragIndex(null)}
                className="cursor-grab active:cursor-grabbing text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                title="Drag to reorder"
                aria-label={`Drag tweet ${index + 1} to reorder`}
              >
                <GripVertical className="w-4 h-4" />
              </span>
              <span className="text-sm text-[var(--color-text-secondary)]">Tweet {index + 1}</span>
              {tweets.length > 1 && (
                <span className="flex items-center">
                  <button
                    onClick={() => move(index, index - 1)}
                    disabled={index === 0}
                    className="p-0.5 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] disabled:opacity-30"
                    title="Move up"
                    aria-label={`Move tweet ${index + 1} up`}
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => move(index, index + 1)}
                    disabled={index === tweets.length - 1}
                    className="p-0.5 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] disabled:opacity-30"
                    title="Move down"
                    aria-label={`Move tweet ${index + 1} down`}
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </span>
              )}
            </div>
            {tweets.length > 1 && (
              <button
                onClick={() => removeTweet(index)}
                className="text-xs text-[var(--color-danger-400)] hover:text-[var(--color-danger-300)]"
              >
                Remove
              </button>
            )}
          </div>
          <ThreadTweetEditor
            text={tweet}
            onChangeText={(v) => updateTweet(index, v)}
            index={index}
            total={tweets.length}
            focused={focusedIndex === index}
            onFocus={() => setFocusedIndex(index)}
            avoidWords={avoidWords}
            authenticity={authenticity}
            placeholder={index === 0 ? "Start your thread..." : "Continue the thread..."}
          />
        </div>
      ))}
      {tweets.length < 6 && (
        <button
          onClick={addTweet}
          className="text-sm text-[var(--color-accent-400)] hover:text-[var(--color-accent-400)]"
        >
          + Add Tweet
        </button>
      )}
    </div>
  );
}

export type DraftEditorProps = {
  /** null → unsaved/new (transient): nothing is persisted until "Save Draft". */
  draftId: string | null;
  type: DraftType;
  initialContent: Record<string, unknown>;
  status?: DraftStatus;
  createdAt?: string;
  /** Seed metadata used only when first saving a transient draft. */
  topic?: string | null;
  appliedPatterns?: string[];
  metadata?: Record<string, unknown>;
  /** Called after a transient draft is persisted / discarded so the host can clean its seed. */
  onPersisted?: () => void;
};

export function DraftEditor({
  draftId,
  type,
  initialContent,
  status = "DRAFT",
  createdAt,
  topic,
  appliedPatterns,
  metadata,
  onPersisted,
}: DraftEditorProps) {
  const router = useRouter();
  const isNew = draftId === null;

  const [editedContent, setEditedContent] = useState<Record<string, unknown>>(initialContent);
  const [restoredUnsaved, setRestoredUnsaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  // sessionStorage key holding in-progress (unsaved) edits so a refresh /
  // accidental nav doesn't lose them. For a new draft this is the only place
  // the content lives until the user explicitly saves or publishes.
  const bufferKey = isNew ? "draft:new:buf" : `draft:${draftId}:buf`;
  // Save-path errors only — publish errors live inside PublishActions.
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Restore any in-progress edits once on mount (prefer the buffer only when it
  // actually differs from the content we were handed).
  useEffect(() => {
    const buffered = readPersistedValue<Record<string, unknown> | null>(bufferKey, null);
    if (buffered && JSON.stringify(buffered) !== JSON.stringify(initialContent)) {
      setEditedContent(buffered);
      setRestoredUnsaved(true);
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mirror in-progress edits to sessionStorage. Only after hydration so we don't
  // clobber a restored buffer with the initial content on first render.
  useEffect(() => {
    if (!hydrated) return;
    writePersistedValue(bufferKey, editedContent);
  }, [editedContent, hydrated, bufferKey]);

  function currentText(): string {
    if (type === "X_POST") return String(editedContent.text || "");
    const tweets = (editedContent.tweets ?? editedContent.posts ?? []) as string[];
    return tweets.filter((t) => t && t.trim()).join("\n\n");
  }

  const text = currentText();

  function discardUnsaved() {
    setEditedContent(initialContent);
    removePersistedValue(bufferKey);
    setRestoredUnsaved(false);
  }

  // Save — for a saved draft this PATCHes edits in place; for a new (transient)
  // draft this is the dedicated action that first persists it, then hands the
  // user off to its permanent editor URL.
  async function save() {
    setSaving(true);
    setSaveMessage(null);
    try {
      if (isNew) {
        const res = await fetch("/api/drafts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type,
            content: editedContent,
            topic: topic || undefined,
            appliedPatterns,
            metadata,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setSaveMessage(data.error || "Failed to save draft");
          return;
        }
        const saved = await res.json();
        removePersistedValue(bufferKey);
        onPersisted?.();
        router.replace(`/drafts/${saved.id}`);
      } else {
        const res = await fetch(`/api/drafts/${draftId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ editedContent }),
        });
        if (res.ok) {
          // Saved — the buffer now matches the server, clear the "unsaved" state.
          removePersistedValue(bufferKey);
          setRestoredUnsaved(false);
        } else {
          const data = await res.json().catch(() => ({}));
          setSaveMessage(data.error || "Failed to save edits");
        }
      }
    } finally {
      setSaving(false);
    }
  }

  const typeLabels: Record<DraftType, string> = {
    X_POST: "X Post",
    X_THREAD: "X Thread",
  };

  const statusColors: Record<string, string> = {
    DRAFT: "bg-[var(--color-warning-500)]/10 text-[var(--color-warning-400)] border-[var(--color-warning-500)]/20",
    POSTED: "bg-[var(--color-success-500)]/10 text-[var(--color-success-400)] border-[var(--color-success-500)]/20",
    SCHEDULED: "bg-[var(--color-accent-500)]/10 text-[var(--color-accent-400)] border-[var(--color-accent-500)]/20",
    REJECTED: "bg-[var(--color-danger-500)]/10 text-[var(--color-danger-400)] border-[var(--color-danger-500)]/20",
  };

  const statusLabel = isNew ? "UNSAVED" : status;
  const statusClass = isNew
    ? "bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] border-[var(--color-border-default)]"
    : statusColors[status];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/create?tab=drafts"
            className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          >
            &larr; Back
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-1 rounded-lg bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)]">
              {typeLabels[type]}
            </span>
            <span className={`text-xs px-2 py-1 rounded-lg border ${statusClass}`}>
              {statusLabel}
            </span>
          </div>
        </div>
        {createdAt && !isNew && (
          <div className="text-sm text-[var(--color-text-secondary)]">
            Created {new Date(createdAt).toLocaleString()}
          </div>
        )}
        {isNew && (
          <div className="text-xs text-[var(--color-text-muted)]">
            Not saved — use Save Draft to keep it, or publish directly
          </div>
        )}
      </div>

      {restoredUnsaved && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-warning-500)]/30 bg-[var(--color-warning-500)]/5 px-4 py-2.5">
          <p className="text-xs text-[var(--color-text-secondary)]">
            Restored your unsaved edits from before you navigated away.
            {isNew ? " Save Draft to keep them." : " Save to keep them."}
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

        {type === "X_POST" && (
          <XPostEditor
            content={editedContent as { text: string }}
            onChange={setEditedContent}
          />
        )}

        {type === "X_THREAD" && (
          <XThreadEditor
            content={editedContent as { tweets: string[] }}
            onChange={(c) => setEditedContent(c)}
          />
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving || (isNew && !text.trim())}
          className="px-4 py-2 bg-[var(--color-bg-elevated)] hover:bg-[var(--color-bg-hover)] border border-[var(--color-border-default)] disabled:opacity-50 rounded-lg text-sm transition-colors duration-100"
        >
          {saving ? "Saving..." : isNew ? "Save Draft" : "Save Edits"}
        </button>
        {isNew && (
          <span className="text-xs text-[var(--color-text-muted)]">
            Saving keeps this in All Drafts. You can also post or schedule without saving.
          </span>
        )}
        {saveMessage && (
          <span className="text-xs text-[var(--color-danger-400)]">{saveMessage}</span>
        )}
      </div>

      {(type === "X_POST" || type === "X_THREAD") && (
        <PublishActions
          contentType={type}
          payload={editedContent}
          // A transient draft publishes with no draftId — it never becomes a row.
          draftId={draftId || undefined}
          canPublish={Boolean(text.trim())}
          replySettings={String((editedContent?.replySettings as string) || "everyone")}
          onReplySettingsChange={(v) =>
            setEditedContent((prev) => ({ ...(prev || {}), replySettings: v }))
          }
          onPublished={(kind) => {
            removePersistedValue(bufferKey);
            onPersisted?.();
            router.push(
              kind === "scheduled" ? "/queue" : isNew ? "/create" : "/create?tab=drafts"
            );
          }}
        />
      )}
    </div>
  );
}
