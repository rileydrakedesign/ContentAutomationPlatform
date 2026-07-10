// Shared shapes for the Radar desk (/reply): the queue rail + reply desk
// operate on one normalized target type, whether it came from the server
// queue (queueId set) or a manual hunt (queueId null → no server state).

// "snoozed" survives in the server enum but the UI no longer offers it
// (owner call 2026-07-10: triage is reply or skip — no parking lot).
export type TriageState = "new" | "snoozed" | "replied" | "skipped";
export type QueueFilter = "new" | "replied";
export type SkipReason = "wrong_topic" | "too_late" | "not_my_crowd";

// Skip reasons are ranking signal, not failure (PRD §3.4 / §10).
export const SKIP_REASONS: { value: SkipReason; label: string }[] = [
  { value: "wrong_topic", label: "wrong topic" },
  { value: "too_late", label: "too late" },
  { value: "not_my_crowd", label: "not my crowd" },
];

export interface PostMetrics {
  like_count?: number;
  retweet_count?: number;
  reply_count?: number;
  impression_count?: number;
}

export interface RadarTarget {
  /** Stable rail key: queue item id, or `hunt:<postId>` for manual finds. */
  key: string;
  /** user_target_queue id — null means a manual hunt result (client-only state). */
  queueId: string | null;
  postId: string;
  text: string;
  authorUsername: string | null;
  authorName: string | null;
  authorFollowers: number | null;
  postedAt: string | null;
  metrics: PostMetrics | null;
  score: number;
  /** Legible Opportunity factors — "your score, explained" (PRD §3.3). */
  reasons: string[];
  /** Source watch; null → manual hunt. */
  watchId: string | null;
  watchLabel: string | null;
  state: TriageState;
  skipReason: SkipReason | null;
}

export interface Watch {
  id: string;
  label: string;
  type: "topic" | "account" | "custom";
  enabled: boolean;
}

export function targetUrl(t: Pick<RadarTarget, "postId" | "authorUsername">): string {
  return t.authorUsername
    ? `https://x.com/${t.authorUsername}/status/${t.postId}`
    : `https://x.com/i/status/${t.postId}`;
}

export function formatMetric(n?: number): string {
  if (!n) return "0";
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

/** Compact freshness stamp for rail rows: "12m" / "3h" / "2d". */
export function formatAge(iso: string | null): string | null {
  if (!iso) return null;
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms) || ms < 0) return null;
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}
