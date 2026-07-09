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
  AudioLines,
  ShieldCheck,
  Copy,
} from "lucide-react";
import { useVoiceCheck } from "@/components/create/useVoiceCheck";
import { VoiceCheckResult } from "@/components/create/VoiceCheckResult";
import { isVoiceCheckSurfaced } from "@/lib/voice/publish-gate";
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

  const { checking, result, checkedText, error: voiceError, check } = useVoiceCheck("reply");

  const voiceChecked = isVoiceCheckSurfaced({
    hasResult: result !== null,
    checkedText,
    currentText: replyText,
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

  // Voice-check is optional (handoff #6): Post reply ships immediately;
  // Voice-check & reply runs the 3-credit check and surfaces the score first.
  async function handleVoiceCheckReply() {
    if (!replyText.trim()) return;
    await check(replyText);
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

  function finishHandoff(t: ReplyTarget) {
    // Drop the handed-off post from the list and close the composer.
    setTargets((prev) => prev.filter((x) => x.id !== t.id));
    setActiveId(null);
  }

  // Default tier: X Web Intent — opens X's composer on the post, prefilled.
  async function replyOnX(t: ReplyTarget) {
    if (!replyText.trim()) return;
    setPosting(true);
    setComposerError(null);
    try {
      await recordHandoff(t);
      const intentUrl = `https://x.com/intent/post?in_reply_to=${encodeURIComponent(
        t.id
      )}&text=${encodeURIComponent(replyText)}`;
      window.open(intentUrl, "_blank", "noopener,noreferrer");
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
          Find high-traction posts you can actually reply to, then reply in your voice.
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
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${
                  sort === "traction"
                    ? "border-[var(--color-primary-500)]/40 bg-[var(--color-primary-500)]/10 text-[var(--color-primary-400)]"
                    : "border-[var(--color-border-default)] text-[var(--color-text-secondary)]"
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
                    className="ml-auto text-[var(--color-primary-400)] hover:underline"
                  >
                    view on X ↗
                  </a>
                </div>

                {!isActive ? (
                  <Button variant="secondary" size="sm" onClick={() => openComposer(t)} icon={<ReplyIcon className="w-4 h-4" />}>
                    Reply in my voice
                  </Button>
                ) : (
                  <div className="pt-2 border-t border-[var(--color-border-subtle)] space-y-3">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => generateReplies(t)}
                        loading={generating}
                        icon={<Sparkles className="w-4 h-4 text-[var(--color-primary-400)]" />}
                      >
                        {options.length > 0 ? "Regenerate options" : "Generate replies"}
                      </Button>
                      <button onClick={() => setActiveId(null)} className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]">
                        cancel
                      </button>
                    </div>

                    {options.length > 0 && (
                      <div className="grid grid-cols-1 gap-2">
                        {options.map((opt, i) => (
                          <button
                            key={i}
                            onClick={() => setReplyText(opt)}
                            className={`text-left text-sm rounded-lg border px-3 py-2 transition-colors ${
                              replyText === opt
                                ? "border-[var(--color-primary-500)] bg-[var(--color-primary-500)]/10 text-[var(--color-text-primary)]"
                                : "border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-default)]"
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    )}

                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Write your reply, or pick a generated option above…"
                      className="w-full min-h-[90px] bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] rounded-xl px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-primary-500)] resize-y"
                    />

                    {voiceError && (
                      <div className="rounded-xl border border-[var(--color-danger-500)]/30 bg-[var(--color-danger-500)]/5 px-4 py-3">
                        <p className="text-sm text-[var(--color-danger-400)]">{voiceError}</p>
                      </div>
                    )}
                    {result && (
                      <VoiceCheckResult
                        result={result}
                        currentText={replyText}
                        checkedText={checkedText}
                        onApplyEdit={setReplyText}
                      />
                    )}
                    {!result && replyText.trim() && (
                      <div className="flex items-start gap-2 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] px-3 py-2">
                        <AudioLines className="w-4 h-4 text-[var(--color-primary-400)] shrink-0 mt-0.5" />
                        <p className="text-xs text-[var(--color-text-secondary)]">
                          &ldquo;Reply on X&rdquo; opens X&apos;s composer prefilled — you hit Post
                          there. Run an optional voice check (3 credits) first to see how well
                          this reply sounds like you.
                        </p>
                      </div>
                    )}

                    {composerError && (
                      <p className="text-sm text-[var(--color-danger-400)]">{composerError}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-2">
                      {/* Primary: hand off to X's composer, prefilled — you post it there */}
                      <Button
                        onClick={() => replyOnX(t)}
                        loading={posting}
                        disabled={posting || checking || !replyText.trim()}
                        icon={<Send className="w-4 h-4" />}
                      >
                        {posting ? "Opening X…" : "Reply on X"}
                      </Button>
                      {/* Fallback: copy the reply + open the post (mobile intent bug) */}
                      <Button
                        variant="secondary"
                        onClick={() => copyAndOpen(t)}
                        disabled={posting || checking || !replyText.trim()}
                        icon={<Copy className="w-4 h-4" />}
                      >
                        Copy & open post
                      </Button>
                      {/* Optional voice-check first */}
                      <Button
                        variant="secondary"
                        onClick={handleVoiceCheckReply}
                        loading={checking}
                        disabled={posting || checking || !replyText.trim() || voiceChecked}
                        icon={<AudioLines className="w-4 h-4" />}
                      >
                        {checking ? "Checking voice…" : voiceChecked ? "Voice-checked ✓" : "Voice check"}
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
