"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Search, TrendingUp } from "lucide-react";
import { parseGateError } from "@/lib/utils/gate-error";
import { usePersistentState } from "@/hooks/usePersistentState";
import type { RadarTarget } from "./types";

// The bound IS the product promise (PRD §3.4): a curated session, not a feed.
const RESULT_BOUND = 15;

interface SearchTweet {
  id: string;
  text: string;
  created_at: string | null;
  metrics: RadarTarget["metrics"];
  author: { username: string | null; name: string | null; followers_count?: number | null } | null;
  opportunity?: { score: number; reasons: string[] };
}

function toHuntTarget(t: SearchTweet): RadarTarget {
  return {
    key: `hunt:${t.id}`,
    queueId: null,
    postId: t.id,
    text: t.text,
    authorUsername: t.author?.username ?? null,
    authorName: t.author?.name ?? null,
    authorFollowers: t.author?.followers_count ?? null,
    postedAt: t.created_at,
    metrics: t.metrics ?? null,
    score: t.opportunity?.score ?? 0,
    reasons: t.opportunity?.reasons ?? [],
    watchLabel: null,
    state: "new",
    skipReason: null,
  };
}

/**
 * The manual escape hatch, demoted below the queue: the radar hunts for
 * you, but the search box is still here when you want to hunt yourself.
 * Results feed the same rail (as client-only targets), not their own list.
 */
export function HuntManually({
  onResults,
}: {
  onResults: (targets: RadarTarget[]) => void;
}) {
  const [open, setOpen] = usePersistentState("radar:huntOpen", false);
  const [query, setQuery] = usePersistentState("radar:huntQuery", "");
  const [sort, setSort] = usePersistentState<"relevance" | "traction">("radar:huntSort", "traction");
  const [searching, setSearching] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function runSearch() {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setNotice(null);
    try {
      const res = await fetch(
        `/api/search/reply-targets?query=${encodeURIComponent(q)}&sort=${sort}&max_results=${RESULT_BOUND}`
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const gateErr = parseGateError(res.status, data);
        setNotice(gateErr ? gateErr.message : data.error || "Search failed");
        return;
      }
      const tweets: SearchTweet[] = Array.isArray(data.tweets) ? data.tweets : [];
      onResults(tweets.map(toHuntTarget));
      setNotice(
        tweets.length === 0
          ? "No repliable posts found — try a broader query."
          : `${data.repliable_count ?? tweets.length} repliable post${tweets.length === 1 ? "" : "s"} added to the queue.`
      );
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="border-t border-[var(--color-border-default)]">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-4 py-2 text-xs uppercase tracking-[0.12em] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors duration-100"
      >
        <span className="inline-flex items-center gap-[1ch]">
          <Search className="w-3.5 h-3.5" /> Hunt manually
        </span>
        <span aria-hidden>{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="px-4 pb-3 space-y-2 animate-fade-in">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
            placeholder="e.g. building in public, AI agents…"
            className="w-full bg-transparent border-b border-[var(--color-border-default)] focus:border-[var(--color-text-secondary)] py-1.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none caret-[var(--color-accent-500)] transition-colors duration-100"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSort(sort === "traction" ? "relevance" : "traction")}
              title="Rank by opportunity: momentum × author band × reply competition"
              className={`inline-flex items-center gap-[1ch] px-[1.5ch] leading-6 text-xs uppercase tracking-[0.08em] border transition-colors duration-100 ${
                sort === "traction"
                  ? "border-[var(--color-accent-600)] text-[var(--color-accent-400)]"
                  : "border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              <TrendingUp className="w-3 h-3" />
              {sort === "traction" ? "opportunity" : "relevance"}
            </button>
            <Button
              size="sm"
              variant="secondary"
              onClick={runSearch}
              loading={searching}
              disabled={!query.trim()}
            >
              Find posts
            </Button>
          </div>
          {notice && <p className="text-xs text-[var(--color-text-muted)]">{notice}</p>}
        </div>
      )}
    </div>
  );
}
