"use client";

import { Badge } from "@/components/ui/Badge";
import { Heart, Repeat2, MessageCircle, BarChart3 } from "lucide-react";
import { formatAge, formatMetric, targetUrl, type RadarTarget } from "./types";

/**
 * The copy under review: full post in the writing face, every Opportunity
 * factor legible ("your score, explained" — PRD §3.3), and the angle-hint
 * slot that the outcome loop will fill.
 */
export function DeskHeader({ target }: { target: RadarTarget }) {
  const age = formatAge(target.postedAt);
  return (
    <header className="px-6 pt-5 pb-4 border-b border-[var(--color-border-default)] space-y-3">
      <div className="flex items-baseline gap-[1ch] min-w-0">
        <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">
          {target.authorName || "@" + (target.authorUsername || "unknown")}
        </span>
        {target.authorUsername && (
          <span className="text-xs text-[var(--color-text-muted)] truncate">
            @{target.authorUsername}
          </span>
        )}
        {typeof target.authorFollowers === "number" && target.authorFollowers > 0 && (
          <span className="text-xs text-[var(--color-text-muted)] whitespace-nowrap">
            · {formatMetric(target.authorFollowers)} followers
          </span>
        )}
        <a
          href={targetUrl(target)}
          target="_blank"
          rel="noreferrer"
          className="ml-auto text-xs text-[var(--color-accent-400)] hover:underline whitespace-nowrap shrink-0"
        >
          view on X ↗
        </a>
      </div>

      <p className="[font-family:var(--font-writer)] text-lg leading-[30px] text-[var(--color-text-primary)] whitespace-pre-wrap">
        {target.text}
      </p>

      <div className="flex items-center gap-[3ch] text-xs text-[var(--color-text-muted)]">
        <span className="inline-flex items-center gap-1">
          <Heart className="w-3 h-3" />
          {formatMetric(target.metrics?.like_count)}
        </span>
        <span className="inline-flex items-center gap-1">
          <Repeat2 className="w-3 h-3" />
          {formatMetric(target.metrics?.retweet_count)}
        </span>
        <span className="inline-flex items-center gap-1">
          <MessageCircle className="w-3 h-3" />
          {formatMetric(target.metrics?.reply_count)}
        </span>
        <span className="inline-flex items-center gap-1">
          <BarChart3 className="w-3 h-3" />
          {formatMetric(target.metrics?.impression_count)}
        </span>
        {age && <span className="ml-auto whitespace-nowrap">posted {age} ago</span>}
      </div>

      {target.reasons.length > 0 && (
        <div className="flex flex-wrap gap-x-[2ch] gap-y-1">
          {target.reasons.map((reason) => (
            <Badge key={reason} variant="success" size="sm">
              {reason}
            </Badge>
          ))}
          {target.score > 0 && (
            <Badge variant="default" size="sm">
              score {Math.round(target.score)}
            </Badge>
          )}
        </div>
      )}

      {/* Angle-hint slot (PRD §3.4): filled from the user's own patterns once
          the outcome loop lands — "your contrarian-take replies outperform". */}
      <div className="border-l-2 border-[var(--color-warning-500)] pl-[2ch] py-0.5">
        <span className="text-xs uppercase tracking-[0.12em] text-[var(--color-warning-500)] font-bold">
          angle{" "}
        </span>
        <span className="text-xs text-[var(--color-text-muted)] italic">
          — hints learn from your reply outcomes. Coming soon.
        </span>
      </div>
    </header>
  );
}
