/**
 * Poll model shared across the composer, drafts, and publish paths.
 *
 * X v2 attaches a poll to the tweet-create call as
 *   { poll: { options: string[], duration_minutes: number } }
 * with X's constraints: 2–4 options, each ≤ 25 visible chars, and a duration of
 * 5 minutes to 7 days (10080 minutes). A poll and media are mutually exclusive on
 * the same tweet — the composer enforces that, and `postTweet` prefers the poll.
 *
 * `DraftPoll` is the editing shape stored on the draft payload (camelCase,
 * options may be partially filled while typing). `pollForPublish` validates and
 * normalizes it into the X wire shape, returning null when it isn't a real poll
 * (fewer than 2 non-empty options).
 */

export interface DraftPoll {
  /** 2–4 options while editing; entries may be empty until the user fills them. */
  options: string[];
  /** Poll lifetime in minutes (5..10080). */
  durationMinutes: number;
}

export const MAX_POLL_OPTIONS = 4;
export const MIN_POLL_OPTIONS = 2;
export const MAX_POLL_OPTION_LEN = 25;
export const MIN_POLL_DURATION = 5;
export const MAX_POLL_DURATION = 10080; // 7 days
export const DEFAULT_POLL_DURATION = 1440; // 1 day (X default)

export const POLL_DURATIONS: { label: string; minutes: number }[] = [
  { label: "5 minutes", minutes: 5 },
  { label: "30 minutes", minutes: 30 },
  { label: "1 hour", minutes: 60 },
  { label: "6 hours", minutes: 360 },
  { label: "1 day", minutes: 1440 },
  { label: "3 days", minutes: 4320 },
  { label: "7 days", minutes: 10080 },
];

/** Narrow an unknown (from draft/payload JSON) into a DraftPoll, or null. */
export function parseDraftPoll(raw: unknown): DraftPoll | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.options)) return null;
  const options = r.options.map((o) => String(o ?? "")).slice(0, MAX_POLL_OPTIONS);
  const durationRaw = Number(r.durationMinutes ?? r.duration_minutes ?? DEFAULT_POLL_DURATION);
  return {
    options,
    durationMinutes: Number.isFinite(durationRaw) ? durationRaw : DEFAULT_POLL_DURATION,
  };
}

/**
 * Validate + normalize a draft poll into X's wire shape, or null when it isn't a
 * real poll yet (fewer than 2 non-empty options). Throws on a genuinely invalid
 * poll (an option over the length cap) so the publish path surfaces a clear
 * error rather than letting X reject it opaquely. The duration is clamped to
 * X's accepted range.
 */
export function pollForPublish(
  raw: unknown
): { options: string[]; duration_minutes: number } | null {
  const poll = parseDraftPoll(raw);
  if (!poll) return null;

  const options = poll.options.map((o) => o.trim()).filter(Boolean).slice(0, MAX_POLL_OPTIONS);
  if (options.length < MIN_POLL_OPTIONS) return null;
  if (options.some((o) => o.length > MAX_POLL_OPTION_LEN)) {
    throw new Error(`Poll options must be ${MAX_POLL_OPTION_LEN} characters or fewer`);
  }

  const duration = Math.min(
    MAX_POLL_DURATION,
    Math.max(MIN_POLL_DURATION, Math.round(poll.durationMinutes))
  );
  return { options, duration_minutes: duration };
}
