"use client";

import { useEffect, useState } from "react";
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
  Copy,
} from "lucide-react";
import { HighlightedTextarea } from "@/components/compose/HighlightedTextarea";
import { AssistantScorePanel, AssistantSuggestionList } from "@/components/assistant/AssistantPanel";
import { useAssistant } from "@/components/assistant/useAssistant";
import { useVoiceGuardrails } from "@/components/assistant/useVoiceGuardrails";
import { parseGateError } from "@/lib/utils/gate-error";
import { usePersistentState } from "@/hooks/usePersistentState";
import { compileWatchQueries, type CompiledWatchQuery } from "@/lib/x-api/watch-queries";
import { RadarQueue, type QueueItem } from "./RadarQueue";

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
  author: {
    username: string | null;
    name: string | null;
    followers_count?: number | null;
  } | null;
  reply_eligibility: "open" | "open_mentioned" | "restricted" | "unknown";
  opportunity?: { score: number; reasons: string[] };
}

// The bound IS the product promise (PRD §3.4): a curated session, not a feed.
const RESULT_BOUND = 15;

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

  // Topic watches (G2, v0.5): the user's analyzed niche compiled into
  // one-click queries — discovery never starts from a blank query box. On-
  // demand searches on the user's token; Phase 1 turns these same compiled
  // queries into pooled sweeps.
  const [watches, setWatches] = useState<CompiledWatchQuery[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/niche/profile");
        if (!res.ok) return;
        const data = await res.json().catch(() => ({}));
        const clusters = Array.isArray(data.profile?.topic_clusters)
          ? [...data.profile.topic_clusters].sort(
              (a, b) => (b.avg_engagement || 0) - (a.avg_engagement || 0)
            )
          : [];
        if (!cancelled) setWatches(compileWatchQueries(clusters));
      } catch {
        // no niche yet — the manual search box still works
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function runSearch(explicitQuery?: string) {
    const q = (explicitQuery ?? query).trim();
    if (!q) return;
    if (explicitQuery) setQuery(explicitQuery);
    setSearching(true);
    setError(null);
    setActiveId(null);
    try {
      const res = await fetch(
        `/api/search/reply-targets?query=${encodeURIComponent(q)}&sort=${sort}&max_results=${RESULT_BOUND}`
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

  // The handoff (C1, PRD_CORE §4.4): replies NEVER publish via the X API — the
  // composed reply is handed to X's own composer and the user posts it from
  // their own session (the human keeps the pen; publish-time 403s can't happen
  // because X's composer enforces its own rules). A handoff record is persisted
  // first — the attribution key for the Results pillar — and also powers
  // already-replied dedup, so a handed-off target stops resurfacing.
  function targetUrl(t: ReplyTarget): string {
    return t.author?.username
      ? `https://x.com/${t.author.username}/status/${t.id}`
      : `https://x.com/i/status/${t.id}`;
  }

  async function recordHandoff(t: ReplyTarget) {
    // Best-effort: a failed record must not block the user's reply.
    try {
      await fetch("/api/reply/handoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_post_id: t.id,
          composed_text: replyText,
          target_url: targetUrl(t),
        }),
      });
    } catch {
      // swallow — the handoff itself still proceeds
    }
  }

  // Radar queue integration: targets opened from a queue card carry their
  // queue-item id so the handoff can close the loop (state → replied).
  const [queueItemByPost, setQueueItemByPost] = useState<Record<string, string>>({});
  const [queueRefreshNonce, setQueueRefreshNonce] = useState(0);

  function handleQueueWriteReply(item: QueueItem) {
    const target: ReplyTarget = {
      id: item.post.post_id,
      text: item.post.text,
      created_at: item.post.posted_at,
      metrics: item.post.metrics,
      author: {
        username: item.post.author_username,
        name: item.post.author_name,
        followers_count: item.post.author_followers,
      },
      // Queue items were repliable at sweep time; a publish-time change
      // surfaces in X's own composer after the handoff.
      reply_eligibility: "open",
      opportunity: { score: Number(item.score) || 0, reasons: item.reasons },
    };
    setQueueItemByPost((prev) => ({ ...prev, [target.id]: item.id }));
    setTargets((prev) => [target, ...prev.filter((x) => x.id !== target.id)]);
    setSearched(true);
    openComposer(target);
  }

  function finishHandoff(t: ReplyTarget) {
    // Drop the handed-off post from the list and close the composer.
    setTargets((prev) => prev.filter((x) => x.id !== t.id));
    setActiveId(null);
    // Close the Radar loop: a handoff from a queue card marks it replied.
    const queueItemId = queueItemByPost[t.id];
    if (queueItemId) {
      fetch(`/api/radar/queue/${queueItemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: "replied" }),
      })
        .catch(() => {})
        .finally(() => setQueueRefreshNonce((n) => n + 1));
      setQueueItemByPost((prev) => {
        const next = { ...prev };
        delete next[t.id];
        return next;
      });
    }
  }

  // Best tier: extension assist. bridge.js (the extension's dashboard content
  // script) marks its presence on <html data-afx-extension> and relays the
  // handoff to the extension, which opens the post and prefills X's NATIVE
  // reply composer — where the writing assistant mounts reply-aware for final
  // tweaks. Resolves false (→ intent fallback) if the extension isn't there or
  // doesn't ack in time.
  function handoffViaExtension(t: ReplyTarget): Promise<boolean> {
    if (typeof document === "undefined" || !document.documentElement.dataset.afxExtension) {
      return Promise.resolve(false);
    }
    return new Promise((resolve) => {
      const done = (ok: boolean) => {
        window.removeEventListener("message", onMessage);
        clearTimeout(timer);
        resolve(ok);
      };
      const onMessage = (e: MessageEvent) => {
        if (e.source !== window || e.origin !== window.location.origin) return;
        const d = e.data as { type?: string; target_post_id?: string; ok?: boolean } | null;
        if (d?.type === "AFX_REPLY_HANDOFF_ACK" && d.target_post_id === t.id) done(!!d.ok);
      };
      const timer = setTimeout(() => done(false), 1500);
      window.addEventListener("message", onMessage);
      window.postMessage(
        {
          type: "AFX_REPLY_HANDOFF",
          target_post_id: t.id,
          target_url: targetUrl(t),
          text: replyText,
        },
        window.location.origin
      );
    });
  }

  // Default tier: X Web Intent — opens X's composer on the post, prefilled.
  async function replyOnX(t: ReplyTarget) {
    if (!replyText.trim()) return;
    setPosting(true);
    setComposerError(null);
    try {
      await recordHandoff(t);
      const viaExtension = await handoffViaExtension(t);
      if (!viaExtension) {
        const intentUrl = `https://x.com/intent/post?in_reply_to=${encodeURIComponent(
          t.id
        )}&text=${encodeURIComponent(replyText)}`;
        window.open(intentUrl, "_blank", "noopener,noreferrer");
      }
      finishHandoff(t);
    } finally {
      setPosting(false);
    }
  }

  // Fallback tier: copy the composed reply + open the post (covers the known
  // mobile-app intent bug where the prefill drops).
  async function copyAndOpen(t: ReplyTarget) {
    if (!replyText.trim()) return;
    setComposerError(null);
    try {
      await navigator.clipboard.writeText(replyText);
    } catch {
      setComposerError("Couldn't copy to clipboard — copy the text manually, then reply on X.");
      return;
    }
    await recordHandoff(t);
    window.open(targetUrl(t), "_blank", "noopener,noreferrer");
    finishHandoff(t);
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

      {/* Radar daily queue (beta) — pre-hunted targets; search below stays as
          the manual escape hatch. */}
      <RadarQueue onWriteReply={handleQueueWriteReply} refreshNonce={queueRefreshNonce} />

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
                title="Rank by opportunity: momentum × author band × reply competition — every factor shown on the card"
              >
                <TrendingUp className="w-3.5 h-3.5" />
                {sort === "traction" ? "By opportunity" : "By relevance"}
              </button>
              <Button onClick={() => runSearch()} loading={searching} disabled={!query.trim()} icon={<Search className="w-4 h-4" />}>
                Find posts
              </Button>
            </div>
          </div>

          {/* Your watches — niche-compiled queries, one click to sweep. */}
          {watches.length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-[var(--color-text-muted)] mb-1.5">
                Your watches — compiled from your niche, no query writing needed:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {watches.map((w) => (
                  <button
                    key={w.label}
                    onClick={() => runSearch(w.query)}
                    disabled={searching}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border border-[var(--color-primary-500)]/30 bg-[var(--color-primary-500)]/5 text-[var(--color-primary-400)] hover:bg-[var(--color-primary-500)]/15 transition-colors disabled:opacity-50"
                    title={w.query}
                  >
                    <TrendingUp className="w-3 h-3" />
                    {w.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="mt-3 rounded-xl border border-[var(--color-danger-500)]/30 bg-[var(--color-danger-500)]/5 px-4 py-3">
              <p className="text-sm text-[var(--color-danger-400)]">{error}</p>
            </div>
          )}

          {counts && !error && (
            <p className="mt-3 text-xs text-[var(--color-text-muted)]">
              {counts.repliable} of {counts.returned} posts are repliable — the rest restrict
              replies and are hidden. Ranked, capped at {RESULT_BOUND}: a session, not a feed.
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

                {/* Why this, why now — every score factor legible (PRD §3.3) */}
                {(t.opportunity?.reasons?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {t.opportunity!.reasons.map((reason) => (
                      <span
                        key={reason}
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] border border-[var(--color-success-500)]/25 bg-[var(--color-success-500)]/5 text-[var(--color-success-400)]"
                      >
                        {reason}
                      </span>
                    ))}
                  </div>
                )}

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

                    {/* The handoff (C1, §4.4): replies never publish via the
                        API — the live assistant above covers the checking, so
                        the actions are pure handoff. */}
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Primary: hand off to X's composer, prefilled — you post it there */}
                      <Button
                        onClick={() => replyOnX(t)}
                        loading={posting}
                        disabled={posting || !replyText.trim()}
                        icon={<Send className="w-4 h-4" />}
                      >
                        {posting ? "Opening X…" : "Reply on X"}
                      </Button>
                      {/* Fallback: copy the reply + open the post (mobile intent bug) */}
                      <Button
                        variant="secondary"
                        onClick={() => copyAndOpen(t)}
                        disabled={posting || !replyText.trim()}
                        icon={<Copy className="w-4 h-4" />}
                      >
                        Copy & open post
                      </Button>
                    </div>
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
