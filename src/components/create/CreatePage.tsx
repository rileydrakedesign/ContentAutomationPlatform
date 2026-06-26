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
import { VoiceCheckPanel } from "./VoiceCheckPanel";
import { HighlightedTextarea } from "@/components/compose/HighlightedTextarea";
import { AssistantPanel } from "@/components/assistant/AssistantPanel";
import { useAssistant } from "@/components/assistant/useAssistant";
import { isAssistantEnabled } from "@/lib/assistant/flag";
import {
  AgenticChain,
  type ChainStepView,
  type ChainSource,
  type ChainScore,
  type ChainRead,
} from "./AgenticChain";
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
  Bot,
} from "lucide-react";
import { useSubscription } from "@/components/auth/SubscriptionProvider";
import { AiUsageCounter } from "@/components/ui/AiUsageCounter";
import { parseGateError } from "@/lib/utils/gate-error";
import {
  usePersistentState,
  writePersistedValue,
  removePersistedValue,
} from "@/hooks/usePersistentState";
import { CharCounter } from "@/components/compose/CharCounter";

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

type GenMode = "quick" | "agent";

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
  // Agentic chain view (live SSE): step timeline, sources, voice scores, and
  // the streaming draft text. Ephemeral per run — not persisted.
  const [chainSteps, setChainSteps] = useState<ChainStepView[]>([]);
  const [chainSources, setChainSources] = useState<ChainSource[]>([]);
  const [chainScores, setChainScores] = useState<ChainScore[]>([]);
  const [chainRead, setChainRead] = useState<ChainRead | null>(null);
  const [liveDraft, setLiveDraft] = useState("");
  const [chainActive, setChainActive] = useState(false);
  // Generation mode: "quick" (one-shot) vs "agent" (research + refine pipeline).
  const [mode, setMode] = usePersistentState<GenMode>("create:mode", "agent");
  // The last query run, so Regenerate replays it exactly (same mode + inputs).
  const [lastQuery, setLastQuery] = useState<{ mode: GenMode; query: GenQuery } | null>(null);
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

  // Writing assistant (Grammarly-for-tweets) for the manual compose tab.
  const assistantOn = isAssistantEnabled();
  const composeAssistant = useAssistant({
    text: composeText,
    onChangeText: setComposeText,
    voiceType: "post",
    enabled: assistantOn && composeType === "X_POST" && activeTab === "compose",
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

  // Merge a step event into the chain, keyed by step + iteration so a step's
  // running→done transition updates in place rather than appending a row.
  const upsertStep = (prev: ChainStepView[], ev: ChainStepView): ChainStepView[] => {
    const key = (s: ChainStepView) => `${s.step}:${s.iteration ?? 0}`;
    const idx = prev.findIndex((s) => key(s) === key(ev));
    if (idx === -1) return [...prev, ev];
    const next = [...prev];
    next[idx] = ev;
    return next;
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

  // Apply a chain progress event shared by the streaming and polled paths
  // (step / research / voice_score). draft_delta, complete and error are handled
  // by each path directly since they differ (live text vs. final result).
  const applyAgenticEvent = (ev: Record<string, unknown>) => {
    switch (ev.type) {
      case "step":
        setChainSteps((prev) =>
          upsertStep(prev, {
            step: ev.step as ChainStepView["step"],
            status: ev.status as ChainStepView["status"],
            label: String(ev.label),
            iteration: ev.iteration as number | undefined,
          })
        );
        break;
      case "research":
        setChainSources((ev.sources as ChainSource[]) || []);
        break;
      case "voice_score": {
        const sc: ChainScore = {
          iteration: (ev.iteration as number) ?? 0,
          score: (ev.score as number) ?? 0,
        };
        setChainScores((prev) =>
          [...prev.filter((s) => s.iteration !== sc.iteration), sc].sort(
            (a, b) => a.iteration - b.iteration
          )
        );
        break;
      }
    }
  };

  // Poll an async (QStash-queued) agentic job and drive the same chain UI from
  // its accumulated progress. Used when generate-agentic returns mode:"async".
  const consumeAgenticJob = async (jobId: string, append: boolean) => {
    let applied = 0;
    for (let i = 0; i < 200; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      let res: Response;
      try {
        res = await fetch(`/api/drafts/generation-jobs/${jobId}`);
      } catch {
        continue;
      }
      if (!res.ok) continue;
      const job = await res.json();
      const events: Array<Record<string, unknown>> = Array.isArray(job.progress) ? job.progress : [];
      for (; applied < events.length; applied++) applyAgenticEvent(events[applied]);
      if (job.status === "done") {
        const option = job.result?.option as GeneratedDraft | undefined;
        if (option) applyOption(option, append);
        return;
      }
      if (job.status === "failed") {
        setError(String(job.error || "Generation failed"));
        return;
      }
    }
    setError("Generation timed out. Please try again.");
  };

  // Read the agentic SSE stream and drive the chain UI. On `complete`, fold the
  // option into the variation history so the existing result card renders it.
  const consumeAgenticStream = async (
    body: ReadableStream<Uint8Array>,
    append: boolean
  ) => {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let liveText = "";
    let liveIter = -1;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split("\n\n");
      buffer = frames.pop() || "";

      for (const frame of frames) {
        const dataLine = frame.split("\n").find((l) => l.startsWith("data:"));
        if (!dataLine) continue;
        const payload = dataLine.slice(5).trim();
        if (!payload) continue;

        let ev: Record<string, unknown>;
        try {
          ev = JSON.parse(payload);
        } catch {
          continue;
        }

        switch (ev.type) {
          case "draft_delta": {
            const iter = (ev.iteration as number) ?? 0;
            if (iter !== liveIter) {
              liveIter = iter;
              liveText = "";
            }
            liveText += String(ev.text);
            setLiveDraft(liveText);
            break;
          }
          case "voice_score": {
            const sc: ChainScore = {
              iteration: (ev.iteration as number) ?? 0,
              score: (ev.score as number) ?? 0,
            };
            setChainScores((prev) =>
              [...prev.filter((s) => s.iteration !== sc.iteration), sc].sort(
                (a, b) => a.iteration - b.iteration
              )
            );
            break;
          }
          case "read":
            setChainRead((ev.read as ChainRead) || null);
            break;
          case "complete": {
            const option = ev.option as GeneratedDraft;
            // The read also rides in metadata so it survives a reload of the
            // finished option, not just the live stream.
            const read = (option as { metadata?: { prepublish_read?: ChainRead } })?.metadata
              ?.prepublish_read;
            if (read) setChainRead(read);
            applyOption(option, append);
            break;
          }
          case "error":
            setError(String(ev.message || "Generation failed"));
            break;
          default:
            applyAgenticEvent(ev);
        }
      }
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

  // Agent mode: streamed research → draft → voice-check → refine pipeline.
  const runAgent = async (q: GenQuery, append: boolean) => {
    setChainSteps([]);
    setChainSources([]);
    setChainScores([]);
    setChainRead(null);
    setLiveDraft("");
    setChainActive(true);
    try {
      const res = await fetch("/api/drafts/generate-agentic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyFromQuery(q)),
      });
      if (!res.ok) {
        await setGenError(res, "Failed to generate drafts");
        return;
      }
      // Async (QStash-queued) mode returns JSON with a jobId to poll; the
      // synchronous mode streams Server-Sent Events.
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const data = await res.json();
        if (data.mode === "async" && data.jobId) {
          await consumeAgenticJob(data.jobId, append);
        } else {
          setError(String(data.error || "Failed to generate drafts"));
        }
        return;
      }
      if (!res.body) {
        await setGenError(res, "Failed to generate drafts");
        return;
      }
      await consumeAgenticStream(res.body, append);
    } finally {
      setChainActive(false);
    }
  };

  // Fresh generation in the selected mode. Records the exact query so a later
  // Regenerate replays it verbatim.
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
    setChainSteps([]);
    setChainSources([]);
    setChainScores([]);
    setChainRead(null);
    setLiveDraft("");
    setLastQuery({ mode, query: q });
    try {
      if (mode === "agent") await runAgent(q, false);
      else await runQuick(q, false);
      refetchSubscription();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate");
    } finally {
      setGenerating(false);
    }
  };

  // Regenerate: replay the last query exactly (same mode + inputs), appending a
  // new variation. No feedback, no steering — a fresh attempt at the same ask.
  const handleRegenerate = async () => {
    if (!lastQuery) return;
    setRegenerating(true);
    setError(null);
    try {
      if (lastQuery.mode === "agent") await runAgent(lastQuery.query, true);
      else await runQuick(lastQuery.query, true);
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

  const [savingDraft, setSavingDraft] = useState(false);

  // Hand the generated post off to the transient editor (no DB write yet). It
  // only becomes a draft if the user explicitly clicks "Save Draft" there —
  // saving is a deliberate action, not a side-effect of editing/publishing.
  const handleUseDraft = (draft: GeneratedDraft) => {
    setSavingDraft(true);
    writePersistedValue("draft:new:seed", {
      type: draft.type,
      content: draft.content,
      topic: draft.topic,
      appliedPatterns: draft.applied_patterns,
      metadata: draft.metadata,
    });
    removePersistedValue("draft:new:buf");
    router.push("/drafts/new");
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

  const getDraftText = (draft: GeneratedDraft): string => {
    if (typeof draft.content.text === "string") return draft.content.text;
    if (Array.isArray(draft.content.tweets)) return draft.content.tweets.join("\n\n");
    if (Array.isArray(draft.content.posts)) return draft.content.posts.join("\n\n");
    return "";
  };

  const applyVoiceEditToDraft = (index: number, newText: string) => {
    setGeneratedDrafts((prev) =>
      prev.map((d, i) => {
        if (i !== index) return d;
        if (Array.isArray(d.content.tweets)) {
          return { ...d, content: { ...d.content, tweets: newText.split(/\n{2,}/) } };
        }
        if (Array.isArray(d.content.posts)) {
          return { ...d, content: { ...d.content, posts: newText.split(/\n{2,}/) } };
        }
        return { ...d, content: { ...d.content, text: newText } };
      })
    );
  };

  // Carry the manually-composed post to the transient editor — same deliberate
  // save model as the AI flow: it's only persisted if the user saves it there.
  const handleContinueCompose = () => {
    const content =
      composeType === "X_POST"
        ? { text: composeText }
        : { tweets: composeThreadTweets };

    const isEmpty =
      composeType === "X_POST"
        ? !composeText.trim()
        : composeThreadTweets.every((t) => !t.trim());

    if (isEmpty) {
      setComposeError("Write something first");
      return;
    }

    setSavingCompose(true);
    setComposeError(null);
    writePersistedValue("draft:new:seed", {
      type: composeType,
      content,
      metadata: { generation_type: "manual" },
    });
    removePersistedValue("draft:new:buf");
    router.push("/drafts/new");
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
                    <div className="w-8 h-8 rounded-lg bg-[var(--color-primary-500)]/10 flex items-center justify-center">
                      <Lightbulb className="w-4 h-4 text-[var(--color-primary-400)]" />
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
                        relative p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer text-left
                        ${draftType === "X_POST"
                          ? "border-[var(--color-primary-500)] bg-[var(--color-primary-500)]/10"
                          : "border-[var(--color-border-default)] hover:border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)]"
                        }
                      `}
                    >
                      {draftType === "X_POST" && (
                        <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-[var(--color-primary-500)]" />
                      )}
                      <FileText className={`w-5 h-5 mb-2 ${draftType === "X_POST" ? "text-[var(--color-primary-400)]" : "text-[var(--color-text-secondary)]"}`} />
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
                        relative p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer text-left
                        ${draftType === "X_THREAD"
                          ? "border-[var(--color-primary-500)] bg-[var(--color-primary-500)]/10"
                          : "border-[var(--color-border-default)] hover:border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)]"
                        }
                      `}
                    >
                      {draftType === "X_THREAD" && (
                        <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-[var(--color-primary-500)]" />
                      )}
                      <List className={`w-5 h-5 mb-2 ${draftType === "X_THREAD" ? "text-[var(--color-primary-400)]" : "text-[var(--color-text-secondary)]"}`} />
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

              {/* Generation mode: Quick vs Agent */}
              <Card>
                <CardContent className="py-3">
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
                    Mode
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setMode("quick")}
                      className={`relative p-3 rounded-xl border-2 transition-all duration-200 cursor-pointer text-left ${
                        mode === "quick"
                          ? "border-[var(--color-primary-500)] bg-[var(--color-primary-500)]/10"
                          : "border-[var(--color-border-default)] hover:border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)]"
                      }`}
                    >
                      <Zap className={`w-5 h-5 mb-1.5 ${mode === "quick" ? "text-[var(--color-primary-400)]" : "text-[var(--color-text-secondary)]"}`} />
                      <p className={`text-sm font-medium ${mode === "quick" ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-secondary)]"}`}>
                        Quick
                      </p>
                      <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                        One-shot draft · 1 generation
                      </p>
                    </button>

                    <button
                      onClick={() => setMode("agent")}
                      className={`relative p-3 rounded-xl border-2 transition-all duration-200 cursor-pointer text-left ${
                        mode === "agent"
                          ? "border-[var(--color-primary-500)] bg-[var(--color-primary-500)]/10"
                          : "border-[var(--color-border-default)] hover:border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)]"
                      }`}
                    >
                      <Bot className={`w-5 h-5 mb-1.5 ${mode === "agent" ? "text-[var(--color-primary-400)]" : "text-[var(--color-text-secondary)]"}`} />
                      <p className={`text-sm font-medium ${mode === "agent" ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-secondary)]"}`}>
                        Agent
                      </p>
                      <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                        Research + refine · 3 generations
                      </p>
                    </button>
                  </div>
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
                icon={mode === "agent" ? <Bot className="w-5 h-5" /> : <Zap className="w-5 h-5" />}
                className="h-14 text-base"
              >
                {aiLimitReached
                  ? "Daily Limit Reached"
                  : generating
                  ? mode === "agent"
                    ? "Running agent…"
                    : "Generating…"
                  : generatedDrafts.length > 0
                  ? "Start Over"
                  : mode === "agent"
                  ? "Generate with Agent"
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

          {/* Agentic pipeline — live chain while generating, persists after */}
          {(chainActive || chainSteps.length > 0) && (
            <div className="mt-8">
              <AgenticChain
                steps={chainSteps}
                sources={chainSources}
                scores={chainScores}
                liveDraft={liveDraft}
                active={chainActive}
                read={chainRead}
              />
            </div>
          )}

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
                        <RefreshCw className={`w-4 h-4 ${regenerating ? "animate-spin" : ""}`} />
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
                        className={`flex items-center justify-center w-8 h-8 rounded-full border transition-all ${
                          feedbackMap[index] === 'like'
                            ? 'border-green-500/50 bg-green-500/10 text-green-400'
                            : 'border-[var(--color-border-default)] text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-secondary)]'
                        }`}
                        title="Like this generation"
                      >
                        <ThumbsUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleFeedback(index, 'dislike')}
                        className={`flex items-center justify-center w-8 h-8 rounded-full border transition-all ${
                          feedbackMap[index] === 'dislike'
                            ? 'border-red-500/50 bg-red-500/10 text-red-400'
                            : 'border-[var(--color-border-default)] text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-secondary)]'
                        }`}
                        title="Dislike this generation"
                      >
                        <ThumbsDown className="w-4 h-4" />
                      </button>
                    </div>

                    <VoiceCheckPanel
                      text={getDraftText(draft)}
                      voiceType="post"
                      onApplyEdit={(newText) => applyVoiceEditToDraft(index, newText)}
                      className="mb-3"
                    />

                    <Button
                      fullWidth
                      onClick={() => handleUseDraft(draft)}
                      disabled={savingDraft}
                      icon={<ArrowRight className="w-4 h-4" />}
                      iconPosition="right"
                    >
                      {savingDraft ? "Opening…" : "Edit & Publish"}
                    </Button>
                  </CardContent>
                </Card>

                {/* Refine the current draft with feedback (lightweight; no pipeline) */}
                <Card>
                  <CardContent className="py-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Wand2 className="w-4 h-4 text-[var(--color-primary-400)]" />
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
                      className="w-full h-10 px-3 text-sm bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-primary-500)] transition-colors"
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
          <div className="max-w-2xl mx-auto space-y-6">
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
                      relative p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer text-left
                      ${composeType === "X_POST"
                        ? "border-[var(--color-primary-500)] bg-[var(--color-primary-500)]/10"
                        : "border-[var(--color-border-default)] hover:border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)]"
                      }
                    `}
                  >
                    {composeType === "X_POST" && (
                      <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-[var(--color-primary-500)]" />
                    )}
                    <FileText className={`w-5 h-5 mb-2 ${composeType === "X_POST" ? "text-[var(--color-primary-400)]" : "text-[var(--color-text-secondary)]"}`} />
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
                      relative p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer text-left
                      ${composeType === "X_THREAD"
                        ? "border-[var(--color-primary-500)] bg-[var(--color-primary-500)]/10"
                        : "border-[var(--color-border-default)] hover:border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)]"
                      }
                    `}
                  >
                    {composeType === "X_THREAD" && (
                      <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-[var(--color-primary-500)]" />
                    )}
                    <List className={`w-5 h-5 mb-2 ${composeType === "X_THREAD" ? "text-[var(--color-primary-400)]" : "text-[var(--color-text-secondary)]"}`} />
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
                  <div className="w-8 h-8 rounded-lg bg-[var(--color-primary-500)]/10 flex items-center justify-center">
                    <Edit3 className="w-4 h-4 text-[var(--color-primary-400)]" />
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

                {composeType === "X_POST" && assistantOn ? (
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">
                    <HighlightedTextarea
                      value={composeText}
                      onChange={setComposeText}
                      findings={composeAssistant.report.findings}
                      onAccept={composeAssistant.accept}
                      onDismiss={composeAssistant.dismiss}
                      placeholder="What's on your mind?"
                      minHeightClass="min-h-[180px]"
                    />
                    <AssistantPanel
                      report={composeAssistant.report}
                      checking={composeAssistant.checking}
                      stale={composeAssistant.stale}
                      liveError={composeAssistant.liveError}
                      onAccept={composeAssistant.accept}
                      onDismiss={composeAssistant.dismiss}
                      onDeepCheck={composeAssistant.runDeepCheck}
                    />
                  </div>
                ) : composeType === "X_POST" ? (
                  <div className="space-y-2">
                    <textarea
                      value={composeText}
                      onChange={(e) => setComposeText(e.target.value)}
                      placeholder="What's on your mind?"
                      className="w-full min-h-[180px] bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] rounded-xl px-4 py-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-primary-500)] transition-colors resize-y"
                    />
                    <CharCounter text={composeText} />
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
                              onClick={() =>
                                setComposeThreadTweets((prev) =>
                                  prev.filter((_, i) => i !== index)
                                )
                              }
                              className="flex items-center gap-1 text-xs text-[var(--color-danger-400)] hover:text-[var(--color-danger-300)] transition-colors"
                            >
                              <Trash2 className="w-3 h-3" />
                              Remove
                            </button>
                          )}
                        </div>
                        <textarea
                          value={tweet}
                          onChange={(e) => {
                            const updated = [...composeThreadTweets];
                            updated[index] = e.target.value;
                            setComposeThreadTweets(updated);
                          }}
                          placeholder={index === 0 ? "Start your thread..." : "Continue the thread..."}
                          className="w-full min-h-[100px] bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] rounded-xl px-4 py-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-primary-500)] transition-colors resize-y"
                        />
                        <CharCounter text={tweet} />
                      </div>
                    ))}
                    {composeThreadTweets.length < 25 && (
                      <button
                        onClick={() => setComposeThreadTweets((prev) => [...prev, ""])}
                        className="flex items-center gap-1.5 text-sm text-[var(--color-primary-400)] hover:text-[var(--color-primary-300)] transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Add tweet
                      </button>
                    )}
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-[var(--color-border-subtle)]">
                  <VoiceCheckPanel
                    text={
                      composeType === "X_POST"
                        ? composeText
                        : composeThreadTweets.filter((t) => t.trim()).join("\n\n")
                    }
                    voiceType="post"
                    onApplyEdit={(newText) => {
                      if (composeType === "X_POST") {
                        setComposeText(newText);
                      } else {
                        setComposeThreadTweets(newText.split(/\n{2,}/));
                      }
                    }}
                  />
                </div>
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

            {/* Save Draft Button */}
            <Button
              onClick={handleContinueCompose}
              loading={savingCompose}
              disabled={
                composeType === "X_POST"
                  ? !composeText.trim()
                  : composeThreadTweets.every((t) => !t.trim())
              }
              fullWidth
              glow
              icon={<ArrowRight className="w-5 h-5" />}
              iconPosition="right"
              className="h-14 text-base"
            >
              {savingCompose ? "Opening…" : "Continue to Publish"}
            </Button>

            <p className="text-xs text-center text-[var(--color-text-muted)]">
              Edit, save as a draft, publish, or schedule on the next screen — nothing
              is saved until you choose to
            </p>
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
