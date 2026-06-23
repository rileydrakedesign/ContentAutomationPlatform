"use client";

import { tweetLengthInfo, DEFAULT_TWEET_LIMIT } from "@/lib/x-api/tweet-text";

/**
 * X-accurate visible character counter. Counts URLs as 23 and CJK as 2 (via
 * weightedTweetLength), shows the count vs limit, and warns near/over the cap.
 */
export function CharCounter({
  text,
  limit = DEFAULT_TWEET_LIMIT,
  className = "",
}: {
  text: string;
  limit?: number;
  className?: string;
}) {
  const info = tweetLengthInfo(text, limit);
  const near = info.remaining <= 20 && !info.isOverLimit;

  const color = info.isOverLimit
    ? "text-[var(--color-danger-400)]"
    : near
      ? "text-[var(--color-warning-400)]"
      : "text-[var(--color-text-muted)]";

  return (
    <div className={`flex items-center justify-end gap-2 text-xs ${className}`}>
      {info.urlCount > 0 && (
        <span className="text-[var(--color-text-muted)]" title="Each link counts as 23 characters on X">
          {info.urlCount} link{info.urlCount > 1 ? "s" : ""} · 23 each
        </span>
      )}
      <span className={color}>
        {info.weighted.toLocaleString()}/{limit.toLocaleString()}
        {info.isOverLimit && (
          <span className="ml-1 font-medium">({Math.abs(info.remaining)} over)</span>
        )}
      </span>
    </div>
  );
}
