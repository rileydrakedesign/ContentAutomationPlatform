"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  Search,
  TrendingUp,
  Reply as ReplyIcon,
  Heart,
  Repeat2,
  MessageCircle,
  BarChart3,
  Sparkles,
  Send,
  ShieldCheck,
} from "lucide-react";
import { HighlightedTextarea } from "@/components/compose/HighlightedTextarea";
import { AssistantScorePanel, AssistantSuggestionList } from "@/components/assistant/AssistantPanel";
import { useAssistant } from "@/components/assistant/useAssistant";
import { useVoiceGuardrails } from "@/components/assistant/useVoiceGuardrails";
import { parseGateError } from "@/lib/utils/gate-error";
import { usePersistentState } from "@/hooks/usePersistentState";

interface ReplyTarget {
  id: string;
  text: string;
  created_at: string | null;
  metrics: {
    like_count?: number;
    retweet_count?: number;
    reply_count?: number;
    impression_count?: number;
  } | null;
  author: { username: string | null; name: string | null } | null;
  reply_eligibility: "open" | "open_mentioned" | "restricted" | "unknown";
}

function metric(n?: number): string {
  if (!n) return "0";
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function ReplyFinderPage() {
  // Persist in-progress reply work across navigation (#8). Search results are
  // server-derived and can go stale; they restore for continuity but a fresh
  // search re-validates them.
  const [query, setQuery] = usePersistentState("reply:query", "");
  const [sort, setSort] = usePersistentState<"relevance" | "traction">("reply:sort", "traction");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [targets, setTargets] = usePersistentState<ReplyTarget[]>("reply:targets", []);
  const [searched, setSearched] = usePersistentState("reply:searched", false);
  const [counts, setCounts] = usePersistentState<{ returned: number; repliable: number } | null>(
    "reply:counts",
    null
  );

  // Active reply composer — one post at a time.
  const [activeId, setActiveId] = usePersistentState<string | null>("reply:activeId", null);
  const [options, setOptions] = usePersistentState<string[]>("reply:options", []);
  const [generating, setGenerating] = useState(false);
  const [replyText, setReplyText] = usePersistentState("reply:text", "");
  const [posting, setPosting] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);

  // Live writing assistant — the same underlines/score/accept-fix loop as the
  // draft editor, running against the user's REPLY voice. Only one composer is
  // open at a time, so a single page-level hook instance tracks the active text.
  const { avoidWords, authenticity } = useVoiceGuardrails("reply");
  const assistant = useAssistant({
    text: replyText,
    onChangeText: setReplyText,
    voiceType: "reply",
    avoidWords,
    authenticity,
    enabled: activeId !== null,
    autoLiveRead: true,
  });

  async function runSearch() {
    if (!query.trim()) return;
    setSearching(true);
    setError(null);
    setActiveId(null);
    try {
      const res = await fetch(
        `/api/search/reply-targets?query=${encodeURIComponent(query.trim())}&sort=${sort}&max_results=25`
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const gateErr = parseGateError(res.status, data);
        setError(gateErr ? gateErr.message : data.error || "Search failed");
        setTargets([]);
        return;
      }
      setTargets(Array.isArray(data.tweets) ? data.tweets : []);
      setCounts({ returned: data.returned_count ?? 0, repliable: data.repliable_count ?? 0 });
      setSearched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }

  function openComposer(t: ReplyTarget) {
    setActiveId(t.id);
    setOptions([]);
    setReplyText("");
    setComposerError(null);
  }

  async function generateReplies(t: ReplyTarget) {
    setGenerating(true);
    setComposerError(null);
    try {
      const res = await fetch("/api/generate-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          post_text: t.text,
          author_handle: t.author?.username || "",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const gateErr = parseGateError(res.status, data);
        setComposerError(gateErr ? gateErr.message : data.error || "Failed to generate replies");
        return;
      }
      const replies: string[] = (data.replies || []).map(
        (r: { text?: string } | string) => (typeof r === "string" ? r : r.text || "")
      );
      setOptions(replies.filter(Boolean));
    } catch (err) {
      setComposerError(err instanceof Error ? err.message : "Failed to generate replies");
    } finally {
      setGenerating(false);
    }
  }

  async function postReply(t: ReplyTarget) {
    if (!replyText.trim()) return;
    setPosting(true);
    setComposerError(null);
    try {
      const url = t.author?.username
        ? `https://x.com/${t.author.username}/status/${t.id}`
        : undefined;
      const res = await fetch("/api/publish/now", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentType: "X_REPLY",
          payload: { text: replyText, inReplyToId: t.id, inReplyToUrl: url },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Some reply restrictions are undetectable pre-flight (the author
        // limited who can reply to this specific conversation). X returns a
        // 403 with a "not allowed to reply" message. Treat it as a clean,
        // expected outcome: clear message + remove the post, not a raw error.
        const raw = String(data.error || "");
        const isReplyForbidden =
          res.status === 403 &&
          /reply to this conversation is not allowed|not allowed to reply|limited who can reply|you have not been mentioned/i.test(
            raw
          );
        if (isReplyForbidden) {
          setComposerError(
            "X won't allow a reply here — the author limited who can reply to this post. Removing it from your list."
          );
          setTargets((prev) => prev.filter((x) => x.id !== t.id));
          setActiveId(null);
          return;
        }
        setComposerError(raw || "Failed to post reply");
        return;
      }
      // Drop the replied-to post from the list and close the composer.
      setTargets((prev) => prev.filter((x) => x.id !== t.id));
      setActiveId(null);
    } catch (err) {
      setComposerError(err instanceof Error ? err.message : "Failed to post reply");
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-heading text-2xl font-semibold text-[var(--color-text-primary)]">
          Reply
        </h1>
        <p className="text-[var(--color-text-secondary)] text-sm mt-1">
          Find high-traction posts you can actually reply to, then write your reply in your
          voice — with the assistant checking it live as you type.
        </p>
      </div>

      {/* Account-safety promise — a buying criterion post-suspension-wave (Gap #3) */}
      <div className="flex items-start gap-2.5 rounded-xl border border-[var(--color-success-500)]/25 bg-[var(--color-success-500)]/5 px-4 py-3">
        <ShieldCheck className="w-4 h-4 text-[var(--color-success-400)] shrink-0 mt-0.5" />
        <p className="text-xs text-[var(--color-text-secondary)]">
          <span className="font-semibold text-[var(--color-text-primary)]">
            Account-safe by design.
          </span>{" "}
          Every reply is human-approved, relevance-targeted, and written in your voice —
          never keyword auto-spam. We only ever show posts you&apos;re actually allowed to
          reply to, so you grow without risking your account.
        </p>
      </div>

      {/* Search */}
      <Card>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1">
              <label className="text-xs text-[var(--color-text-muted)] mb-1 block">
                Search recent posts
              </label>
              <div className="flex items-center gap-2 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] px-3">
                <Search className="w-4 h-4 text-[var(--color-text-muted)]" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && runSearch()}
                  placeholder="e.g. building in public, indie hackers, AI agents"
                  className="flex-1 bg-transparent py-2.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSort(sort === "traction" ? "relevance" : "traction")}
                className={`inline-flex items-center gap-[1ch] px-[2ch] py-[7px] leading-6 rounded-none text-xs font-bold uppercase tracking-[0.08em] border transition-colors duration-100 ${
                  sort === "traction"
                    ? "border-[var(--color-accent-500)]/50 bg-[var(--color-accent-500)]/10 text-[var(--color-accent-400)]"
                    : "border-[var(--color-border-strong)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                }`}
                title="Rank repliable posts by momentum (engagement decayed by age)"
              >
                <TrendingUp className="w-3.5 h-3.5" />
                {sort === "traction" ? "By traction" : "By relevance"}
              </button>
              <Button onClick={runSearch} loading={searching} disabled={!query.trim()} icon={<Search className="w-4 h-4" />}>
                Find posts
              </Button>
            </div>
          </div>

          {error && (
            <div className="mt-3 rounded-xl border border-[var(--color-danger-500)]/30 bg-[var(--color-danger-500)]/5 px-4 py-3">
              <p className="text-sm text-[var(--color-danger-400)]">{error}</p>
            </div>
          )}

          {counts && !error && (
            <p className="mt-3 text-xs text-[var(--color-text-muted)]">
              {counts.repliable} of {counts.returned} posts are repliable — the rest restrict
              replies and are hidden.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {searched && targets.length === 0 && !error && (
        <Card>
          <CardContent>
            <p className="text-sm text-[var(--color-text-muted)]">
              No repliable posts found for that search. Try a broader query.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {targets.map((t) => {
          const isActive = activeId === t.id;
          return (
            <Card key={t.id} hover={!isActive}>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-[var(--color-text-primary)]">
                    {t.author?.name || "@" + (t.author?.username || "unknown")}
                    {t.author?.username && (
                      <span className="text-[var(--color-text-muted)] font-normal ml-1.5">
                        @{t.author.username}
                      </span>
                    )}
                  </span>
                  <Badge variant={t.reply_eligibility === "open" ? "success" : "primary"} size="sm">
                    <ReplyIcon className="w-3 h-3 mr-1" />
                    {t.reply_eligibility === "open_mentioned" ? "you're mentioned" : "repliable"}
                  </Badge>
                </div>

                <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap">{t.text}</p>

                <div className="flex items-center gap-4 text-xs text-[var(--color-text-muted)]">
                  <span className="inline-flex items-center gap-1"><Heart className="w-3 h-3" />{metric(t.metrics?.like_count)}</span>
                  <span className="inline-flex items-center gap-1"><Repeat2 className="w-3 h-3" />{metric(t.metrics?.retweet_count)}</span>
                  <span className="inline-flex items-center gap-1"><MessageCircle className="w-3 h-3" />{metric(t.metrics?.reply_count)}</span>
                  <span className="inline-flex items-center gap-1"><BarChart3 className="w-3 h-3" />{metric(t.metrics?.impression_count)}</span>
                  <a
                    href={t.author?.username ? `https://x.com/${t.author.username}/status/${t.id}` : `https://x.com/i/status/${t.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-auto text-[var(--color-accent-400)] hover:underline"
                  >
                    view on X ↗
                  </a>
                </div>

                {!isActive ? (
                  <Button variant="secondary" size="sm" onClick={() => openComposer(t)} icon={<ReplyIcon className="w-4 h-4" />}>
                    Write a reply
                  </Button>
                ) : (
                  <div className="pt-2 border-t border-[var(--color-border-subtle)] space-y-3">
                    {/* Writing-first: the composer is the main event; generated
                        options are optional starting points that seed it. */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => generateReplies(t)}
                        loading={generating}
                        icon={<Sparkles className="w-4 h-4 text-[var(--color-accent-400)]" />}
                      >
                        {options.length > 0 ? "More starting points" : "Suggest starting points"}
                      </Button>
                      <button onClick={() => setActiveId(null)} className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]">
                        cancel
                      </button>
                    </div>

                    {options.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs text-[var(--color-text-muted)]">
                          Starting points — pick one, then make it yours below.
                        </p>
                        <div className="grid grid-cols-1 gap-2">
                          {options.map((opt, i) => (
                            <button
                              key={i}
                              onClick={() => setReplyText(opt)}
                              className={`text-left text-sm rounded-lg border px-3 py-2 transition-colors ${
                                replyText === opt
                                  ? "border-[var(--color-accent-500)] bg-[var(--color-accent-500)]/10 text-[var(--color-text-primary)]"
                                  : "border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-default)]"
                              }`}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Editor + inline score share one row (reply cards are
                        narrower than the create page, so the score column is
                        slimmer); suggestions flow full-width below. */}
                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_200px] lg:items-center">
                      <HighlightedTextarea
                        value={replyText}
                        onChange={setReplyText}
                        findings={assistant.report.findings}
                        onAccept={assistant.accept}
                        onDismiss={assistant.dismiss}
                        placeholder="Write your reply — the assistant checks voice and clarity as you type…"
                        minHeightClass="min-h-[100px]"
                      />
                      <AssistantScorePanel
                        report={assistant.report}
                        hasContent={replyText.trim().length > 0}
                        checking={assistant.checking}
                        stale={assistant.stale}
                        liveError={assistant.liveError}
                        scoreUnavailable={assistant.scoreUnavailable}
                      />
                    </div>
                    <AssistantSuggestionList
                      report={assistant.report}
                      hasContent={replyText.trim().length > 0}
                      checking={assistant.checking}
                      onAccept={assistant.accept}
                      onDismiss={assistant.dismiss}
                    />

                    {composerError && (
                      <p className="text-sm text-[var(--color-danger-400)]">{composerError}</p>
                    )}

                    <Button
                      onClick={() => postReply(t)}
                      loading={posting}
                      disabled={posting || !replyText.trim()}
                      icon={<Send className="w-4 h-4" />}
                    >
                      {posting ? "Posting…" : "Post reply"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
