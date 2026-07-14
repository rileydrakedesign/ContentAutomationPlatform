"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { TopicInput } from "./TopicInput";
import { PatternSelector } from "./PatternSelector";
import { DraftsList } from "./DraftsList";
import { HighlightedTextarea } from "@/components/compose/HighlightedTextarea";
import { AssistantScorePanel, AssistantSuggestionList } from "@/components/assistant/AssistantPanel";
import { useAssistant } from "@/components/assistant/useAssistant";
import { useVoiceGuardrails } from "@/components/assistant/useVoiceGuardrails";
import { InspirationPost } from "@/types/inspiration";
import {
  FileText,
  List,
  PenSquare,
  FolderOpen,
  Lightbulb,
  ArrowRight,
  Wand2,
  X,
  Quote,
  ThumbsUp,
  ThumbsDown,
  Edit3,
  Plus,
  Trash2,
  RefreshCw,
  Zap,
} from "lucide-react";
import { useSubscription } from "@/components/auth/SubscriptionProvider";
import { AiUsageCounter } from "@/components/ui/AiUsageCounter";
import { parseGateError } from "@/lib/utils/gate-error";
import { usePersistentState } from "@/hooks/usePersistentState";
import { ThreadTweetEditor } from "@/components/compose/ThreadTweetEditor";
import { MediaUploader } from "@/components/compose/MediaUploader";
import { LinkPreview } from "@/components/compose/LinkPreview";
import { PollEditor } from "@/components/compose/PollEditor";
import { PublishActions } from "@/components/compose/PublishActions";
import type { AttachedMedia } from "@/lib/x-api/media";
import type { DraftPoll } from "@/lib/x-api/poll";

type DraftType = "X_POST" | "X_THREAD";

interface GeneratedDraft {
  type: string;
  content: {
    text?: string;
    tweets?: string[];
    posts?: string[];
  };
  topic: string;
  applied_patterns?: string[];
  metadata?: {
    hook_type?: string;
    patterns_applied?: string[];
  };
}

// The exact inputs of a generation, saved so Regenerate can replay them verbatim.
interface GenQuery {
  topic: string;
  draftType: DraftType;
  patternIds: string[];
  inspiration: { text: string; author: string } | null;
}

export function CreatePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabParam = searchParams.get("tab");
  const inspirationId = searchParams.get("inspiration");
  // The editor is the front door: a bare /create lands on the live-assistant
  // Write tab. Generation is an on-ramp — links that carry a generation intent
  // (a seeded topic or an inspiration post) still open AI Generate, and any
  // explicit ?tab= wins.
  const hasGenerationIntent = !!searchParams.get("topic") || !!inspirationId;
  const initialTab =
    tabParam === "drafts"
      ? "drafts"
      : tabParam === "new"
        ? "new"
        : tabParam === "compose"
          ? "compose"
          : hasGenerationIntent
            ? "new"
            : "compose";
  // Controlled tab state so the assistant hook (which lives at page scope, not
  // inside the unmounted TabsContent) can be gated on the Write tab being
  // active — otherwise it would run, and spend, on a hidden tab.
  const [activeTab, setActiveTab] = useState(initialTab);

  // Persist in-progress work so navigating away and back doesn't lose it (#8).
  const [topic, setTopic] = usePersistentState("create:topic", "");
  const [selectedPatterns, setSelectedPatterns] = usePersistentState<string[]>(
    "create:selectedPatterns",
    []
  );
  const [draftType, setDraftType] = usePersistentState<DraftType>("create:draftType", "X_POST");
  const [generating, setGenerating] = useState(false);
  // Variation history: each generate/regenerate appends one full option so a
  // regenerate never destroys a good earlier result (handoff #3.4).
  const [generatedDrafts, setGeneratedDrafts] = usePersistentState<GeneratedDraft[]>(
    "create:variations",
    []
  );
  const [currentVariation, setCurrentVariation] = usePersistentState("create:currentVariation", 0);
  const [regenInstructions, setRegenInstructions] = useState("");
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inspirationPost, setInspirationPost] = useState<InspirationPost | null>(null);
  const [loadingInspiration, setLoadingInspiration] = useState(false);
  const [feedbackMap, setFeedbackMap] = useState<Record<number, 'like' | 'dislike' | null>>({});
  // The last query run, so Regenerate replays it exactly.
  const [lastQuery, setLastQuery] = useState<GenQuery | null>(null);
  const [refining, setRefining] = useState(false);
  const [inspirationList, setInspirationList] = useState<Array<{ id: string; raw_content: string; author_handle: string | null; created_at: string }>>([]);
  const [inspirationPickerOpen, setInspirationPickerOpen] = useState(false);
  const [inspirationSearch, setInspirationSearch] = useState("");
  const [loadingInspirationList, setLoadingInspirationList] = useState(false);

  const { aiLimitReached, refetch: refetchSubscription } = useSubscription();

  // Compose (manual draft) state — persisted so a half-written post survives nav.
  const [composeType, setComposeType] = usePersistentState<DraftType>("create:composeType", "X_POST");
  const [composeText, setComposeText] = usePersistentState("create:composeText", "");
  const [composeThreadTweets, setComposeThreadTweets] = usePersistentState<string[]>(
    "create:composeThread",
    [""]
  );
  const [savingCompose, setSavingCompose] = useState(false);
  const [composeError, setComposeError] = useState<string | null>(null);
  // Which thread tweet has the assistant's full attention (score panel + auto
  // L3 read). Every tweet still gets underlines + the L2 score.
  const [composeFocusedTweet, setComposeFocusedTweet] = useState(0);
  // Full composition parity with the draft editor — the Write tab IS the
  // composer now (publish happens here; no handoff to a second compose box).
  const [composeMedia, setComposeMedia] = usePersistentState<AttachedMedia[]>(
    "create:composeMedia",
    []
  );
  const [composePoll, setComposePoll] = usePersistentState<DraftPoll | null>(
    "create:composePoll",
    null
  );
  const [composeReplySettings, setComposeReplySettings] = usePersistentState(
    "create:composeReplySettings",
    "everyone"
  );
  // Generation provenance riding along when an AI draft is loaded into Write —
  // used only when the user saves it as a draft.
  const [composeSeedMeta, setComposeSeedMeta] = usePersistentState<{
    topic?: string | null;
    appliedPatterns?: string[];
    metadata?: Record<string, unknown>;
  } | null>("create:composeSeed", null);
  // Post-publish confirmation shown in place (no navigation to clear it).
  const [composeNotice, setComposeNotice] = useState<string | null>(null);

  // Writing assistant (Grammarly-for-tweets) for the manual compose tab.
  const { avoidWords, authenticity } = useVoiceGuardrails("post");
  const composeAssistant = useAssistant({
    text: composeText,
    onChangeText: setComposeText,
    voiceType: "post",
    hasMedia: composeMedia.length > 0,
    avoidWords,
    authenticity,
    enabled: composeType === "X_POST" && activeTab === "compose",
    autoLiveRead: true,
  });

  // Fetch available inspiration posts (for manual selection)
  useEffect(() => {
    setLoadingInspirationList(true);
    fetch("/api/inspiration")
      .then((res) => res.json())
      .then((data) => setInspirationList(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoadingInspirationList(false));
  }, []);

  // Fetch inspiration post if ID is provided
  useEffect(() => {
    if (!inspirationId) {
      setInspirationPost(null);
      return;
    }

    setLoadingInspiration(true);
    fetch(`/api/inspiration/${inspirationId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data && !data.error) {
          setInspirationPost(data);
        }
      })
      .catch(console.error)
      .finally(() => setLoadingInspiration(false));
  }, [inspirationId]);

  const clearInspiration = () => {
    setInspirationPost(null);
    // Update URL without inspiration param
    const params = new URLSearchParams(searchParams.toString());
    params.delete("inspiration");
    router.replace(`/create?${params.toString()}`);
  };

  // Apply a finished option to the variation list — append (regenerate/refine)
  // or replace (fresh generate) — and focus it.
  const applyOption = (option: GeneratedDraft, append: boolean) => {
    if (append) {
      setGeneratedDrafts((prev) => {
        const next = [...prev, option];
        setCurrentVariation(next.length - 1);
        return next;
      });
    } else {
      setGeneratedDrafts([option]);
      setCurrentVariation(0);
    }
  };

  // Snapshot the current inputs as a replayable query.
  const currentQuery = (): GenQuery => ({
    topic: topic.trim(),
    draftType,
    patternIds: selectedPatterns,
    inspiration: inspirationPost
      ? { text: inspirationPost.raw_content, author: inspirationPost.author_handle || "" }
      : null,
  });

  const bodyFromQuery = (q: GenQuery): Record<string, unknown> => {
    const b: Record<string, unknown> = {
      topic: q.topic,
      draftType: q.draftType,
      patternIds: q.patternIds,
    };
    if (q.inspiration) b.inspirationPost = q.inspiration;
    return b;
  };

  const setGenError = async (res: Response, fallback: string) => {
    let data: Record<string, unknown> = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }
    const gateErr = parseGateError(res.status, data);
    setError(gateErr ? gateErr.message : String(data.error || fallback));
  };

  // Quick mode: one-shot, non-streaming.
  const runQuick = async (q: GenQuery, append: boolean) => {
    const res = await fetch("/api/drafts/generate-from-topic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bodyFromQuery(q)),
    });
    if (!res.ok) {
      await setGenError(res, "Failed to generate drafts");
      return;
    }
    const data = await res.json();
    const newOptions: GeneratedDraft[] = data.options || [];
    if (newOptions.length === 0) {
      setError("No content was generated. Try again.");
      return;
    }
    applyOption(newOptions[0], append);
  };

  // Fresh generation. Records the exact query so a later Regenerate replays it
  // verbatim.
  const handleGenerate = async () => {
    if (!topic.trim() || topic.length < 3) {
      setError("Please enter a topic (at least 3 characters)");
      return;
    }
    const q = currentQuery();
    setGenerating(true);
    setError(null);
    setGeneratedDrafts([]);
    setFeedbackMap({});
    setLastQuery(q);
    try {
      await runQuick(q, false);
      refetchSubscription();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate");
    } finally {
      setGenerating(false);
    }
  };

  // Regenerate: replay the last query exactly, appending a new variation. No
  // feedback, no steering — a fresh attempt at the same ask.
  const handleRegenerate = async () => {
    if (!lastQuery) return;
    setRegenerating(true);
    setError(null);
    try {
      await runQuick(lastQuery, true);
      refetchSubscription();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to regenerate");
    } finally {
      setRegenerating(false);
    }
  };

  // Refine: take the current variation (Quick or Agent) and revise it per the
  // user's feedback in a single lightweight call. Never runs the pipeline.
  const handleRefine = async () => {
    if (!regenInstructions.trim()) {
      setError("Add some feedback to refine with.");
      return;
    }
    const idx = Math.min(currentVariation, generatedDrafts.length - 1);
    const draft = generatedDrafts[idx];
    if (!draft) return;
    const c = draft.content as { text?: string; tweets?: string[]; posts?: string[] };
    setRefining(true);
    setError(null);
    try {
      const res = await fetch("/api/drafts/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: c.text || "",
          tweets: c.tweets || c.posts || undefined,
          draftType: (draft.type as DraftType) || draftType,
          feedback: regenInstructions.trim(),
          topic: draft.topic || topic.trim(),
        }),
      });
      if (!res.ok) {
        await setGenError(res, "Failed to refine");
        return;
      }
      const data = await res.json();
      if (data.option) {
        applyOption(data.option as GeneratedDraft, true);
        setRegenInstructions("");
      }
      refetchSubscription();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refine");
    } finally {
      setRefining(false);
    }
  };

  // Load a generated post INTO the Write tab (no navigation, no DB write). The
  // Write tab is the one composer: the user lands with the assistant already
  // reading the text and can edit, save, post, or schedule right there.
  const handleUseDraft = (draft: GeneratedDraft) => {
    const t: DraftType = draft.type === "X_THREAD" ? "X_THREAD" : "X_POST";
    const hasWork =
      composeType === "X_POST"
        ? composeText.trim().length > 0
        : composeThreadTweets.some((tw) => tw.trim());
    if (hasWork && !window.confirm("Replace the in-progress post on the Write tab with this draft?")) {
      return;
    }
    setComposeType(t);
    if (t === "X_POST") {
      setComposeText(draft.content.text || "");
    } else {
      const tweets = draft.content.tweets || draft.content.posts || [""];
      setComposeThreadTweets(tweets.length ? tweets : [""]);
      setComposeFocusedTweet(0);
    }
    setComposeMedia([]);
    setComposePoll(null);
    setComposeSeedMeta({
      topic: draft.topic || null,
      appliedPatterns: draft.applied_patterns,
      metadata: draft.metadata,
    });
    setComposeError(null);
    setComposeNotice(null);
    setActiveTab("compose");
  };

  const handleFeedback = async (index: number, feedbackType: 'like' | 'dislike') => {
    const current = feedbackMap[index];
    const newVal = current === feedbackType ? null : feedbackType;
    setFeedbackMap((prev) => ({ ...prev, [index]: newVal }));

    if (!newVal) return;

    const draft = generatedDrafts[index];
    const contentText =
      draft.content.text ||
      (Array.isArray(draft.content.tweets) ? draft.content.tweets.join('\n\n') : '') ||
      (Array.isArray(draft.content.posts) ? draft.content.posts.join('\n\n') : '');

    try {
      await fetch("/api/generation-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedback_type: newVal,
          generation_type: "post",
          content_text: contentText,
          context_prompt: topic,
          metadata: {
            hook_type: draft.metadata?.hook_type,
            patterns_applied: draft.metadata?.patterns_applied || draft.applied_patterns,
          },
        }),
      });
    } catch (err) {
      console.error("Failed to submit feedback:", err);
    }
  };

  // The Write tab's content payload — same shape the draft editor produces, so
  // save/publish/schedule take it verbatim.
  const composeContent = (): Record<string, unknown> =>
    composeType === "X_POST"
      ? { text: composeText, media: composeMedia, poll: composePoll }
      : { tweets: composeThreadTweets };

  const composeIsEmpty =
    composeType === "X_POST"
      ? !composeText.trim()
      : composeThreadTweets.every((t) => !t.trim());

  // After a save or publish the composition is done — clear every buffer so the
  // tab greets the next post fresh.
  const clearCompose = () => {
    setComposeText("");
    setComposeThreadTweets([""]);
    setComposeFocusedTweet(0);
    setComposeMedia([]);
    setComposePoll(null);
    setComposeSeedMeta(null);
  };

  // Save Draft — the deliberate keep-this action (publishing never writes a
  // draft row). Hands off to the saved draft's permanent editor.
  const handleSaveDraft = async () => {
    if (composeIsEmpty) {
      setComposeError("Write something first");
      return;
    }
    setSavingCompose(true);
    setComposeError(null);
    try {
      const res = await fetch("/api/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: composeType,
          content: { ...composeContent(), replySettings: composeReplySettings },
          topic: composeSeedMeta?.topic || undefined,
          appliedPatterns: composeSeedMeta?.appliedPatterns,
          metadata: composeSeedMeta?.metadata ?? { generation_type: "manual" },
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setComposeError((data as { error?: string }).error || "Failed to save draft");
        return;
      }
      const saved = await res.json();
      clearCompose();
      router.push(`/drafts/${saved.id}`);
    } catch (err) {
      setComposeError(err instanceof Error ? err.message : "Failed to save draft");
    } finally {
      setSavingCompose(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-heading text-2xl font-semibold text-[var(--color-text-primary)]">
                Create
              </h1>
              <p className="text-[var(--color-text-secondary)] text-sm mt-1">
                Write your post with the live assistant — or generate a starting point
              </p>
            </div>
            <TabsList>
              <TabsTrigger value="compose" icon={<PenSquare className="w-4 h-4" />}>
                Write
              </TabsTrigger>
              <TabsTrigger value="new" icon={<Wand2 className="w-4 h-4" />}>
                AI Generate
              </TabsTrigger>
              <TabsTrigger value="drafts" icon={<FolderOpen className="w-4 h-4" />}>
                All Drafts
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        <TabsContent value="new">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* Left Column - Topic & Format */}
            <div className="space-y-6">
              {/* Inspiration Post Card (if present) */}
              {(inspirationPost || loadingInspiration) && (
                <Card className="border-[var(--color-accent-500)]/30 bg-[var(--color-accent-500)]/5">
                  <CardContent>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-[var(--color-accent-500)]/10 flex items-center justify-center shrink-0">
                          <Quote className="w-4 h-4 text-[var(--color-accent-400)]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                              Using as Inspiration
                            </h3>
                            <Badge variant="accent" size="sm">Style Reference</Badge>
                          </div>
                          {loadingInspiration ? (
                            <div className="h-16 skeleton rounded" />
                          ) : inspirationPost ? (
                            <>
                              <p className="text-xs text-[var(--color-text-muted)] mb-1">
                                {inspirationPost.author_handle
                                  ? (inspirationPost.author_handle.startsWith("@") ? inspirationPost.author_handle : `@${inspirationPost.author_handle}`)
                                  : "unknown"}
                              </p>
                              <p className="text-sm text-[var(--color-text-secondary)] line-clamp-3">
                                {inspirationPost.raw_content}
                              </p>
                            </>
                          ) : null}
                        </div>
                      </div>
                      <button
                        onClick={clearInspiration}
                        className="p-1.5 rounded-lg hover:bg-[var(--color-bg-hover)] transition-colors"
                      >
                        <X className="w-4 h-4 text-[var(--color-text-muted)]" />
                      </button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Topic Input Card */}
              <Card>
                <CardContent>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-[var(--color-accent-500)]/10 flex items-center justify-center">
                      <Lightbulb className="w-4 h-4 text-[var(--color-accent-400)]" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                        Topic
                      </h3>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        What do you want to write about?
                      </p>
                    </div>
                  </div>
                  <TopicInput value={topic} onChange={setTopic} />
                </CardContent>
              </Card>

              {/* Format Selection Card */}
              <Card>
                <CardContent>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-[var(--color-accent-500)]/10 flex items-center justify-center">
                      <FileText className="w-4 h-4 text-[var(--color-accent-400)]" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                        Format
                      </h3>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        Choose your content format
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setDraftType("X_POST")}
                      className={`
                        relative p-4 rounded-xl border-2 transition-colors duration-100 cursor-pointer text-left
                        ${draftType === "X_POST"
                          ? "border-[var(--color-accent-500)] bg-[var(--color-accent-500)]/10"
                          : "border-[var(--color-border-default)] hover:border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)]"
                        }
                      `}
                    >
                      {draftType === "X_POST" && (
                        <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-[var(--color-primary-500)]" />
                      )}
                      <FileText className={`w-5 h-5 mb-2 ${draftType === "X_POST" ? "text-[var(--color-accent-400)]" : "text-[var(--color-text-secondary)]"}`} />
                      <p className={`text-sm font-medium ${draftType === "X_POST" ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-secondary)]"}`}>
                        Single Post
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                        One standalone post
                      </p>
                    </button>

                    <button
                      onClick={() => setDraftType("X_THREAD")}
                      className={`
                        relative p-4 rounded-xl border-2 transition-colors duration-100 cursor-pointer text-left
                        ${draftType === "X_THREAD"
                          ? "border-[var(--color-accent-500)] bg-[var(--color-accent-500)]/10"
                          : "border-[var(--color-border-default)] hover:border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)]"
                        }
                      `}
                    >
                      {draftType === "X_THREAD" && (
                        <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-[var(--color-primary-500)]" />
                      )}
                      <List className={`w-5 h-5 mb-2 ${draftType === "X_THREAD" ? "text-[var(--color-accent-400)]" : "text-[var(--color-text-secondary)]"}`} />
                      <p className={`text-sm font-medium ${draftType === "X_THREAD" ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-secondary)]"}`}>
                        Thread
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                        Multiple connected posts
                      </p>
                    </button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Patterns & Generate */}
            <div className="space-y-6">
              {/* Inspiration Picker */}
              {!inspirationId && (
                <Card>
                  <CardContent>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-[var(--color-accent-500)]/10 flex items-center justify-center">
                        <Quote className="w-4 h-4 text-[var(--color-accent-400)]" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                          Inspiration
                        </h3>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          Optionally inject a saved inspiration post
                        </p>
                      </div>
                    </div>

                    {loadingInspirationList ? (
                      <div className="h-9 skeleton" />
                    ) : inspirationList.length === 0 ? (
                      <p className="text-xs text-[var(--color-text-muted)]">No saved inspiration yet.</p>
                    ) : (
                      <div className="space-y-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          fullWidth
                          onClick={() => {
                            setInspirationPickerOpen(true);
                            setInspirationSearch("");
                          }}
                        >
                          {inspirationPost ? "Change inspiration" : "Add inspiration"}
                        </Button>
                        <p className="text-[11px] text-[var(--color-text-muted)]">
                          pick from your saved inspirations (searchable)
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Pattern Selection Card */}
              <Card>
                <CardContent className="py-3">
                  <div className="flex items-center gap-2 mb-3">
                    <Wand2 className="w-4 h-4 text-[var(--color-success-400)]" />
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                      Patterns
                    </h3>
                  </div>
                  <PatternSelector
                    selectedPatterns={selectedPatterns}
                    onSelectionChange={setSelectedPatterns}
                  />
                </CardContent>
              </Card>

              {/* AI Usage + Generate Button */}
              <AiUsageCounter className="mb-2" />
              <Button
                onClick={handleGenerate}
                loading={generating}
                disabled={!topic.trim() || aiLimitReached}
                fullWidth
                glow
                icon={<Zap className="w-5 h-5" />}
                className="h-14 text-base"
              >
                {aiLimitReached
                  ? "Daily Limit Reached"
                  : generating
                  ? "Generating…"
                  : generatedDrafts.length > 0
                  ? "Start Over"
                  : "Generate Post"}
              </Button>

              {/* Error Display */}
              {error && (
                <Card className="border-[var(--color-danger-500)]/30 bg-[var(--color-danger-500)]/5">
                  <CardContent className="py-3">
                    <p className="text-sm text-[var(--color-danger-400)]">{error}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Generated Post — single full view with regenerate + history */}
          {generatedDrafts.length > 0 && (() => {
            const index = Math.min(currentVariation, generatedDrafts.length - 1);
            const draft = generatedDrafts[index];
            const c = draft.content as unknown as Record<string, unknown>;
            const threadItems =
              Array.isArray(c.tweets) ? (c.tweets as string[]) :
              Array.isArray(c.posts) ? (c.posts as string[]) :
              [];
            const isThread = draft.type === "X_THREAD";

            return (
              <div className="mt-8 max-w-2xl mx-auto space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-heading text-lg font-semibold text-[var(--color-text-primary)]">
                    Generated {isThread ? "Thread" : "Post"}
                  </h3>
                  <div className="flex items-center gap-2">
                    {/* Variation history nav */}
                    {generatedDrafts.length > 1 && (
                      <>
                        <button
                          onClick={() => setCurrentVariation((i) => Math.max(0, i - 1))}
                          disabled={index === 0}
                          className="px-2 py-1 rounded-md border border-[var(--color-border-default)] text-xs text-[var(--color-text-secondary)] disabled:opacity-40 hover:border-[var(--color-border-strong)] transition-colors"
                          title="Previous variation"
                        >
                          ←
                        </button>
                        <span className="text-xs text-[var(--color-text-muted)]">
                          Variation {index + 1} of {generatedDrafts.length}
                        </span>
                        <button
                          onClick={() => setCurrentVariation((i) => Math.min(generatedDrafts.length - 1, i + 1))}
                          disabled={index === generatedDrafts.length - 1}
                          className="px-2 py-1 rounded-md border border-[var(--color-border-default)] text-xs text-[var(--color-text-secondary)] disabled:opacity-40 hover:border-[var(--color-border-strong)] transition-colors"
                          title="Next variation"
                        >
                          →
                        </button>
                      </>
                    )}
                    {/* Regenerate: re-run the exact last query as a new variation */}
                    {lastQuery && (
                      <button
                        onClick={handleRegenerate}
                        disabled={regenerating || aiLimitReached}
                        title="Regenerate — re-run the same prompt"
                        className="flex items-center justify-center w-8 h-8 rounded-md border border-[var(--color-border-default)] text-[var(--color-text-secondary)] disabled:opacity-40 hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)] transition-colors"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <Card>
                  <CardContent>
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      {draft.metadata?.hook_type && (
                        <Badge variant="primary">{draft.metadata.hook_type}</Badge>
                      )}
                      {(draft.metadata?.patterns_applied?.length ?? 0) > 0 &&
                        draft.metadata!.patterns_applied!.map((name, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 rounded-full border border-[var(--color-success-500)]/30 bg-[var(--color-success-500)]/5 px-2 py-0.5 text-[11px] text-[var(--color-success-400)]"
                          >
                            <Wand2 className="w-2.5 h-2.5" />
                            {name}
                          </span>
                        ))}
                    </div>

                    {/* Full post text — no clamp */}
                    {isThread ? (
                      <div className="space-y-3 mb-4">
                        {threadItems.map((tw, i) => (
                          <div
                            key={i}
                            className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)]/40 px-3 py-2"
                          >
                            <span className="text-[11px] text-[var(--color-text-muted)]">
                              {i + 1}/{threadItems.length}
                            </span>
                            <p className="text-sm text-[var(--color-text-primary)] whitespace-pre-wrap mt-1">
                              {tw}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-base text-[var(--color-text-primary)] whitespace-pre-wrap mb-4 leading-relaxed">
                        {draft.content.text || ""}
                      </p>
                    )}

                    {/* Feedback */}
                    <div className="flex items-center gap-2 mb-3">
                      <button
                        onClick={() => handleFeedback(index, 'like')}
                        className={`flex items-center justify-center w-8 h-8 rounded-full border transition-colors duration-100 ${
                          feedbackMap[index] === 'like'
                            ? 'border-[var(--color-success-500)]/50 bg-[var(--color-success-500)]/10 text-[var(--color-success-400)]'
                            : 'border-[var(--color-border-default)] text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-secondary)]'
                        }`}
                        title="Like this generation"
                      >
                        <ThumbsUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleFeedback(index, 'dislike')}
                        className={`flex items-center justify-center w-8 h-8 rounded-full border transition-colors duration-100 ${
                          feedbackMap[index] === 'dislike'
                            ? 'border-[var(--color-danger-500)]/50 bg-[var(--color-danger-500)]/10 text-[var(--color-danger-400)]'
                            : 'border-[var(--color-border-default)] text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-secondary)]'
                        }`}
                        title="Dislike this generation"
                      >
                        <ThumbsDown className="w-4 h-4" />
                      </button>
                    </div>

                    <Button
                      fullWidth
                      onClick={() => handleUseDraft(draft)}
                      icon={<ArrowRight className="w-4 h-4" />}
                      iconPosition="right"
                    >
                      Edit & Publish
                    </Button>
                  </CardContent>
                </Card>

                {/* Refine the current draft with feedback (lightweight; no pipeline) */}
                <Card>
                  <CardContent className="py-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Wand2 className="w-4 h-4 text-[var(--color-accent-400)]" />
                      <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">
                        Refine this draft
                      </h4>
                    </div>
                    <input
                      value={regenInstructions}
                      onChange={(e) => setRegenInstructions(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !refining && !aiLimitReached && regenInstructions.trim()) handleRefine();
                      }}
                      placeholder='Feedback: "make it longer, add bullet points", "punchier hook", "less formal"…'
                      className="w-full h-10 px-3 text-sm bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent-500)] transition-colors"
                    />
                    <Button
                      variant="secondary"
                      fullWidth
                      loading={refining}
                      disabled={refining || aiLimitReached || !regenInstructions.trim()}
                      onClick={handleRefine}
                      icon={<Wand2 className="w-4 h-4" />}
                    >
                      {refining ? "Refining…" : "Refine with feedback"}
                    </Button>
                    <p className="text-[11px] text-[var(--color-text-muted)]">
                      Refine edits the current draft from your feedback (your
                      feedback takes priority). To re-run the original prompt from
                      scratch, use the regenerate ↻ button above. Variations are
                      kept — flip between them.
                    </p>
                  </CardContent>
                </Card>
              </div>
            );
          })()}
        </TabsContent>

        <TabsContent value="compose">
          <div className="max-w-3xl mx-auto space-y-6">
            {/* Format Selection */}
            <Card>
              <CardContent>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-[var(--color-accent-500)]/10 flex items-center justify-center">
                    <FileText className="w-4 h-4 text-[var(--color-accent-400)]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                      Format
                    </h3>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      Choose your content format
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setComposeType("X_POST")}
                    className={`
                      relative p-4 rounded-xl border-2 transition-colors duration-100 cursor-pointer text-left
                      ${composeType === "X_POST"
                        ? "border-[var(--color-accent-500)] bg-[var(--color-accent-500)]/10"
                        : "border-[var(--color-border-default)] hover:border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)]"
                      }
                    `}
                  >
                    {composeType === "X_POST" && (
                      <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-[var(--color-primary-500)]" />
                    )}
                    <FileText className={`w-5 h-5 mb-2 ${composeType === "X_POST" ? "text-[var(--color-accent-400)]" : "text-[var(--color-text-secondary)]"}`} />
                    <p className={`text-sm font-medium ${composeType === "X_POST" ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-secondary)]"}`}>
                      Single Post
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                      One standalone post
                    </p>
                  </button>

                  <button
                    onClick={() => setComposeType("X_THREAD")}
                    className={`
                      relative p-4 rounded-xl border-2 transition-colors duration-100 cursor-pointer text-left
                      ${composeType === "X_THREAD"
                        ? "border-[var(--color-accent-500)] bg-[var(--color-accent-500)]/10"
                        : "border-[var(--color-border-default)] hover:border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)]"
                      }
                    `}
                  >
                    {composeType === "X_THREAD" && (
                      <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-[var(--color-primary-500)]" />
                    )}
                    <List className={`w-5 h-5 mb-2 ${composeType === "X_THREAD" ? "text-[var(--color-accent-400)]" : "text-[var(--color-text-secondary)]"}`} />
                    <p className={`text-sm font-medium ${composeType === "X_THREAD" ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-secondary)]"}`}>
                      Thread
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                      Multiple connected posts
                    </p>
                  </button>
                </div>
              </CardContent>
            </Card>

            {/* Compose Editor */}
            <Card>
              <CardContent>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-[var(--color-accent-500)]/10 flex items-center justify-center">
                    <Edit3 className="w-4 h-4 text-[var(--color-accent-400)]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                      Write your post
                    </h3>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      The assistant flags voice drift and reach risks as you type
                    </p>
                  </div>
                </div>

                {composeType === "X_POST" ? (
                  <div className="space-y-4">
                    {/* Editor + holistic score share one row; the score block is
                        centered inline with the editor. Suggestions flow below. */}
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-center">
                      <div className="space-y-3">
                        <HighlightedTextarea
                          value={composeText}
                          onChange={setComposeText}
                          findings={composeAssistant.report.findings}
                          onAccept={composeAssistant.accept}
                          onDismiss={composeAssistant.dismiss}
                          placeholder="What's on your mind?"
                          minHeightClass="min-h-[180px]"
                        />

                        {/* Link preview for the first URL (URLs still count as 23 above) */}
                        <LinkPreview text={composeText} />

                        {/* Media — hidden while a poll is attached (X allows one, not both) */}
                        {!composePoll && (
                          <div className="pt-1">
                            <MediaUploader media={composeMedia} onChange={setComposeMedia} />
                          </div>
                        )}

                        {/* Poll — mutually exclusive with media */}
                        <PollEditor
                          poll={composePoll}
                          onChange={setComposePoll}
                          disabled={!composePoll && composeMedia.length > 0}
                        />
                      </div>
                      <AssistantScorePanel
                        report={composeAssistant.report}
                        hasContent={composeText.trim().length > 0}
                        checking={composeAssistant.checking}
                        stale={composeAssistant.stale}
                        liveError={composeAssistant.liveError}
                        scoreUnavailable={composeAssistant.scoreUnavailable}
                      />
                    </div>
                    <AssistantSuggestionList
                      report={composeAssistant.report}
                      hasContent={composeText.trim().length > 0}
                      checking={composeAssistant.checking}
                      onAccept={composeAssistant.accept}
                      onDismiss={composeAssistant.dismiss}
                    />
                  </div>
                ) : (
                  <div className="space-y-3">
                    {composeThreadTweets.map((tweet, index) => (
                      <div key={index} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-[var(--color-text-muted)]">
                            Tweet {index + 1}
                          </span>
                          {composeThreadTweets.length > 1 && (
                            <button
                              onClick={() => {
                                setComposeThreadTweets((prev) =>
                                  prev.filter((_, i) => i !== index)
                                );
                                setComposeFocusedTweet((f) =>
                                  Math.min(
                                    f > index ? f - 1 : f,
                                    Math.max(0, composeThreadTweets.length - 2)
                                  )
                                );
                              }}
                              className="flex items-center gap-1 text-xs text-[var(--color-danger-400)] hover:text-[var(--color-danger-300)] transition-colors"
                            >
                              <Trash2 className="w-3 h-3" />
                              Remove
                            </button>
                          )}
                        </div>
                        <ThreadTweetEditor
                          text={tweet}
                          onChangeText={(v) => {
                            const updated = [...composeThreadTweets];
                            updated[index] = v;
                            setComposeThreadTweets(updated);
                          }}
                          index={index}
                          total={composeThreadTweets.length}
                          focused={composeFocusedTweet === index}
                          onFocus={() => setComposeFocusedTweet(index)}
                          avoidWords={avoidWords}
                          authenticity={authenticity}
                          placeholder={index === 0 ? "Start your thread..." : "Continue the thread..."}
                        />
                      </div>
                    ))}
                    {composeThreadTweets.length < 25 && (
                      <button
                        onClick={() => {
                          setComposeThreadTweets((prev) => [...prev, ""]);
                          setComposeFocusedTweet(composeThreadTweets.length);
                        }}
                        className="flex items-center gap-1.5 text-sm text-[var(--color-accent-400)] hover:text-[var(--color-accent-400)] transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Add tweet
                      </button>
                    )}
                  </div>
                )}

              </CardContent>
            </Card>

            {/* Error Display */}
            {composeError && (
              <Card className="border-[var(--color-danger-500)]/30 bg-[var(--color-danger-500)]/5">
                <CardContent className="py-3">
                  <p className="text-sm text-[var(--color-danger-400)]">{composeError}</p>
                </CardContent>
              </Card>
            )}

            {/* Post-publish confirmation (publishing keeps you right here) */}
            {composeNotice && (
              <Card className="border-[var(--color-success-500)]/30 bg-[var(--color-success-500)]/5">
                <CardContent className="py-3 flex items-center justify-between gap-3">
                  <p className="text-sm text-[var(--color-success-400)]">{composeNotice}</p>
                  <button
                    onClick={() => setComposeNotice(null)}
                    className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] shrink-0"
                  >
                    Dismiss
                  </button>
                </CardContent>
              </Card>
            )}

            {/* Save (keep it in All Drafts) — publishing below never writes a row */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleSaveDraft}
                disabled={savingCompose || composeIsEmpty}
                className="px-4 py-2 bg-[var(--color-bg-elevated)] hover:bg-[var(--color-bg-hover)] border border-[var(--color-border-default)] disabled:opacity-50 rounded-lg text-sm transition-colors duration-100"
              >
                {savingCompose ? "Saving..." : "Save Draft"}
              </button>
              <span className="text-xs text-[var(--color-text-muted)]">
                Saving keeps this in All Drafts. You can also post or schedule without saving.
              </span>
            </div>

            {/* Publish where you write — same surface, same assistant session */}
            <PublishActions
              contentType={composeType}
              payload={composeContent()}
              canPublish={!composeIsEmpty}
              replySettings={composeReplySettings}
              onReplySettingsChange={setComposeReplySettings}
              onPublished={(kind) => {
                clearCompose();
                if (kind === "scheduled") {
                  router.push("/queue");
                } else {
                  setComposeNotice("Posted to X. The composer is clear for your next post.");
                }
              }}
            />
          </div>
        </TabsContent>

        <TabsContent value="drafts">
          <DraftsList />
        </TabsContent>
      </Tabs>

      {/* Inspiration Picker Modal */}
      {inspirationPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-[var(--color-border-subtle)]">
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Select inspiration</h3>
                <p className="text-xs text-[var(--color-text-muted)]">choose one post to inject into this draft</p>
              </div>
              <button
                onClick={() => setInspirationPickerOpen(false)}
                className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <input
                value={inspirationSearch}
                onChange={(e) => setInspirationSearch(e.target.value)}
                placeholder="Search..."
                className="w-full h-9 px-3 text-sm bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] rounded-lg"
              />

              <div className="max-h-[60vh] overflow-y-auto space-y-2 pr-1">
                {inspirationList
                  .filter((p) => {
                    if (!inspirationSearch.trim()) return true;
                    const q = inspirationSearch.toLowerCase();
                    return (
                      (p.raw_content || "").toLowerCase().includes(q) ||
                      (p.author_handle || "").toLowerCase().includes(q)
                    );
                  })
                  .slice(0, 80)
                  .map((p) => (
                    <button
                      key={p.id}
                      onClick={async () => {
                        setLoadingInspiration(true);
                        try {
                          const res = await fetch(`/api/inspiration/${p.id}`);
                          const d = await res.json();
                          setInspirationPost(d && !d.error ? d : null);
                          setInspirationPickerOpen(false);
                        } finally {
                          setLoadingInspiration(false);
                        }
                      }}
                      className="w-full text-left p-3 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] hover:border-[var(--color-border-default)] transition-colors"
                    >
                      <div className="flex items-center justify-between gap-3 mb-1">
                        <span className="text-xs text-[var(--color-text-muted)]">
                          {p.author_handle ? (p.author_handle.startsWith("@") ? p.author_handle : `@${p.author_handle}`) : "unknown"}
                        </span>
                        <span className="text-xs text-[var(--color-text-muted)]">click to select</span>
                      </div>
                      <p className="text-sm text-[var(--color-text-secondary)] line-clamp-3">
                        {p.raw_content}
                      </p>
                    </button>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
