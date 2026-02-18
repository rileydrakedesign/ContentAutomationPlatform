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
import { InspirationPost } from "@/types/inspiration";
import {
  Sparkles,
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
} from "lucide-react";

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

export function CreatePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialTab = searchParams.get("tab") === "drafts" ? "drafts" : "new";
  const inspirationId = searchParams.get("inspiration");

  const [topic, setTopic] = useState("");
  const [selectedPatterns, setSelectedPatterns] = useState<string[]>([]);
  const [draftType, setDraftType] = useState<DraftType>("X_POST");
  const [generating, setGenerating] = useState(false);
  const [generatedDrafts, setGeneratedDrafts] = useState<GeneratedDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [inspirationPost, setInspirationPost] = useState<InspirationPost | null>(null);
  const [loadingInspiration, setLoadingInspiration] = useState(false);
  const [feedbackMap, setFeedbackMap] = useState<Record<number, 'like' | 'dislike' | null>>({});
  const [inspirationList, setInspirationList] = useState<Array<{ id: string; raw_content: string; author_handle: string | null; created_at: string }>>([]);
  const [inspirationPickerOpen, setInspirationPickerOpen] = useState(false);
  const [inspirationSearch, setInspirationSearch] = useState("");
  const [loadingInspirationList, setLoadingInspirationList] = useState(false);

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

  const handleGenerate = async () => {
    if (!topic.trim() || topic.length < 3) {
      setError("Please enter a topic (at least 3 characters)");
      return;
    }

    setGenerating(true);
    setError(null);
    setGeneratedDrafts([]);
    setFeedbackMap({});

    try {
      const requestBody: Record<string, unknown> = {
        topic: topic.trim(),
        draftType,
        patternIds: selectedPatterns,
        generateCount: 3,
      };

      // Add inspiration post if available
      if (inspirationPost) {
        requestBody.inspirationPost = {
          text: inspirationPost.raw_content,
          author: inspirationPost.author_handle || "",
        };
      }

      const res = await fetch("/api/drafts/generate-from-topic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to generate drafts");
      }

      const data = await res.json();
      setGeneratedDrafts(data.options || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate");
    } finally {
      setGenerating(false);
    }
  };

  const [savingDraft, setSavingDraft] = useState(false);

  const handleUseDraft = async (draft: GeneratedDraft) => {
    setSavingDraft(true);
    try {
      const res = await fetch("/api/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: draft.type,
          content: draft.content,
          topic: draft.topic,
          appliedPatterns: draft.applied_patterns,
          metadata: draft.metadata,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save draft");
      }
      const saved = await res.json();
      router.push(`/drafts/${saved.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save draft");
    } finally {
      setSavingDraft(false);
    }
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

  return (
    <div className="animate-fade-in">
      <Tabs defaultValue={initialTab}>
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-heading text-2xl font-semibold text-[var(--color-text-primary)]">
                Create
              </h1>
              <p className="text-[var(--color-text-secondary)] text-sm mt-1">
                Generate content from topics using your patterns
              </p>
            </div>
            <TabsList>
              <TabsTrigger value="new" icon={<PenSquare className="w-4 h-4" />}>
                New Draft
              </TabsTrigger>
              <TabsTrigger value="drafts" icon={<FolderOpen className="w-4 h-4" />}>
                All Drafts
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        <TabsContent value="new">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Topic & Format */}
            <div className="lg:col-span-2 space-y-6">
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
            <div className="lg:col-span-1 space-y-6">
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
                <CardContent>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-[var(--color-success-500)]/10 flex items-center justify-center">
                      <Wand2 className="w-4 h-4 text-[var(--color-success-400)]" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                        Patterns
                      </h3>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        Apply your winning patterns
                      </p>
                    </div>
                  </div>
                  <PatternSelector
                    selectedPatterns={selectedPatterns}
                    onSelectionChange={setSelectedPatterns}
                  />
                </CardContent>
              </Card>

              {/* Generate Button */}
              <Button
                onClick={handleGenerate}
                loading={generating}
                disabled={!topic.trim()}
                fullWidth
                glow
                icon={<Sparkles className="w-5 h-5" />}
                className="h-14 text-base"
              >
                {generating ? "Generating..." : "Generate Drafts"}
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

          {/* Generated Drafts - Full Width */}
          {generatedDrafts.length > 0 && (
            <div className="mt-8 space-y-4">
              <div className="flex items-center gap-3">
                <h3 className="text-heading text-lg font-semibold text-[var(--color-text-primary)]">
                  Generated Drafts
                </h3>
                <Badge variant="success">{generatedDrafts.length}</Badge>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {generatedDrafts.map((draft, index) => (
                  <Card key={index} hover className="group">
                    <CardContent>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs font-medium text-[var(--color-text-muted)]">
                          Option {index + 1}
                        </span>
                        {draft.metadata?.hook_type && (
                          <Badge variant="primary">
                            {draft.metadata.hook_type}
                          </Badge>
                        )}
                      </div>

                      {(() => {
                        const c = draft.content as unknown as Record<string, unknown>;
                        const threadItems =
                          Array.isArray(c.tweets) ? (c.tweets as string[]) :
                          Array.isArray(c.posts) ? (c.posts as string[]) :
                          [];

                        return (
                          <>
                            <p className="text-sm text-[var(--color-text-secondary)] line-clamp-4 mb-4">
                              {draftType === "X_THREAD"
                                ? (threadItems[0] || "")
                                : draft.content.text || ""}
                            </p>

                            {draftType === "X_THREAD" && threadItems.length > 1 && (
                              <p className="text-xs text-[var(--color-text-muted)] mb-4">
                                + {threadItems.length - 1} more posts in thread
                              </p>
                            )}
                          </>
                        );
                      })()}

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

                      <Button
                        variant="secondary"
                        size="sm"
                        fullWidth
                        onClick={() => handleUseDraft(draft)}
                        disabled={savingDraft}
                        icon={<ArrowRight className="w-4 h-4" />}
                        iconPosition="right"
                      >
                        {savingDraft ? "Saving..." : "Select & Edit"}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
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
