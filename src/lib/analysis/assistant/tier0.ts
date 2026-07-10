/**
 * Tier 0 — the instant, deterministic, FREE check layer (GRAMMARLY_PIVOT_UX.md §6).
 *
 * Pure functions, no network, no LLM. Runs on every keystroke and carries 100%
 * of the "live" feel. This is the same intelligence as computeAlgorithmFlags()
 * (prepublish-read.ts) but it returns *anchored* findings (spans to underline)
 * plus badges, chips, and a deterministic Reach sub-score — and it's client-safe
 * so the identical code runs in the dashboard and ported into the extension.
 *
 * Design rules it enforces:
 *   - Underlines are always "fix this span" (warning palette). Positive signals
 *     (reply hook present, has media) are Badges, never underlines.
 *   - Absence (no reply hook) is a Chip, never an underline.
 *   - optimization_authenticity quiets the soft reach nags for authenticity-first
 *     users; the hard penalties (link, bait) always show.
 */

import { findLinks, tweetLengthInfo, DEFAULT_TWEET_LIMIT } from "@/lib/x-api/tweet-text";
import { REPLY_DRIVING, ENGAGEMENT_BAIT, claimNote } from "@/lib/analysis/x-algorithm";
import type {
  AssistantReport,
  Badge,
  Finding,
  Scores,
  SuggestionChip,
} from "./types";

// REPLY_DRIVING / ENGAGEMENT_BAIT are imported from x-algorithm.ts — one source of
// truth shared with prepublish-read.ts so the deterministic layers can't drift
// (parity test in x-algorithm.test.ts). x-algorithm.ts is pure, so this module
// stays client-safe and bundles into the extension unchanged.

// Low-signal filler the clarity linter flags (suggestion only). Conservative on
// purpose — over-flagging is the failure mode of a writing assistant.
const FILLER_WORDS = ["very", "really", "just", "actually", "basically", "literally"];

export interface Tier0Input {
  text: string;
  isThread?: boolean;
  hasMedia?: boolean;
  /** Words the user's guardrails say to avoid — exact-match underlined as voice. */
  avoidWords?: string[];
  /** 0-100; >70 = authenticity-first → quiet the soft reach nags. */
  authenticity?: number;
  /** Per-account character limit (Premium raises it). */
  limit?: number;
}

function lower(s: string): string {
  return s.toLowerCase();
}

/**
 * Widen a [start,end) removal range to also swallow one adjacent space, so a
 * one-click "remove" doesn't leave a double space or a leading gap. Prefers a
 * trailing space; falls back to a leading one.
 */
function removalRange(text: string, start: number, end: number): { start: number; end: number } {
  if (text[end] === " ") return { start, end: end + 1 };
  if (start > 0 && text[start - 1] === " ") return { start: start - 1, end };
  return { start, end };
}

/** All case-insensitive occurrences of `needle` in `text` as spans. */
function findAll(text: string, needle: string): { start: number; end: number; quote: string }[] {
  if (!needle) return [];
  const hay = lower(text);
  const ndl = lower(needle);
  const out: { start: number; end: number; quote: string }[] = [];
  let from = 0;
  for (;;) {
    const idx = hay.indexOf(ndl, from);
    if (idx === -1) break;
    out.push({ start: idx, end: idx + ndl.length, quote: text.slice(idx, idx + ndl.length) });
    from = idx + ndl.length;
  }
  return out;
}

/**
 * Run the full deterministic pass. Returns a complete AssistantReport whose
 * scores.voice / scores.performance are null (those need a Live Read); reach and
 * post (provisional) are computed here.
 */
export function runTier0(input: Tier0Input): AssistantReport {
  const { text } = input;
  const limit = input.limit ?? DEFAULT_TWEET_LIMIT;
  const authenticityFirst = (input.authenticity ?? 0) > 70;
  const charInfo = tweetLengthInfo(text, limit);
  const low = lower(text);

  const findings: Finding[] = [];
  const badges: Badge[] = [];
  const chips: SuggestionChip[] = [];

  // ── Reach: external link (penalty) — underline each URL. ──────────────────
  // findLinks (not findUrls): drops an email's domain (me@google.com) so the
  // external-link penalty doesn't misfire on it. The char counter / billing keep
  // using findUrls, so "what counts as a link for length" is unaffected.
  const urls = findLinks(text);
  for (const u of urls) {
    const rng = removalRange(text, u.start, u.end);
    findings.push({
      id: `link:${u.start}`,
      class: "reach",
      severity: "problem",
      title: "Link in the main post",
      why: claimNote("link_reach_gap"),
      span: { quote: text.slice(rng.start, rng.end), start: rng.start, end: rng.end },
      replacement: "",
      source: "tier0",
      signal: "external_link",
    });
  }

  // ── Reach: engagement-bait — underline each phrase. ───────────────────────
  for (const phrase of ENGAGEMENT_BAIT) {
    for (const m of findAll(text, phrase)) {
      const rng = removalRange(text, m.start, m.end);
      findings.push({
        id: `bait:${m.start}`,
        class: "reach",
        severity: "warning",
        title: "Reads as engagement-bait",
        why: claimNote("negative_feedback_costly"),
        span: { quote: text.slice(rng.start, rng.end), start: rng.start, end: rng.end },
        replacement: "",
        source: "tier0",
        signal: "negative_feedback",
      });
    }
  }

  // ── Voice: guardrail avoid-words — underline each. ────────────────────────
  for (const word of input.avoidWords ?? []) {
    for (const m of findAll(text, word)) {
      findings.push({
        id: `avoid:${m.start}`,
        class: "voice",
        severity: "warning",
        title: `Avoid-word: "${m.quote}"`,
        why: "You told us to avoid this word in your voice guardrails.",
        span: m,
        source: "tier0",
        signal: "guardrail",
      });
    }
  }

  // ── Reach: hashtag overuse — underline the 3rd+ tag, removable. ────────────
  // 1–2 tags are fine; a pile of them reads as spammy and suppresses reach.
  const hashtagRe = /(^|\s)(#\w+)/g;
  const tags: { start: number; end: number }[] = [];
  let hm: RegExpExecArray | null;
  while ((hm = hashtagRe.exec(text)) !== null) {
    const start = hm.index + hm[1].length; // skip the leading whitespace
    tags.push({ start, end: start + hm[2].length });
  }
  const hashtagSpam = tags.length >= 3;
  if (hashtagSpam) {
    for (const t of tags.slice(2)) {
      const rng = removalRange(text, t.start, t.end);
      findings.push({
        id: `hashtag:${t.start}`,
        class: "reach",
        severity: "suggestion",
        title: "Extra hashtag",
        why: "More than 1–2 hashtags reads as spammy and can suppress reach. One well-chosen tag is plenty.",
        span: { quote: text.slice(rng.start, rng.end), start: rng.start, end: rng.end },
        replacement: "",
        source: "tier0",
        signal: "hashtag_spam",
      });
    }
  }

  // ── Reach: leading @mention — limits distribution (X treats it like a reply). ─
  // Card + underline only; there's no safe one-click rewrite, so we surface it
  // without an Accept and let the writer restructure the opener.
  const leadMention = /^(\s*)(@\w+)/.exec(text);
  if (leadMention) {
    const start = leadMention[1].length;
    findings.push({
      id: `lead-mention:${start}`,
      class: "reach",
      severity: "warning",
      title: "Starts with an @mention",
      why: "Opening with @handle makes X treat this like a reply and shows it to far fewer people. Lead with your point and move the @ later (or into a reply).",
      span: { quote: leadMention[2], start, end: start + leadMention[2].length },
      source: "tier0",
      signal: "leading_mention",
    });
  }

  // ── Correctness (X-native): markdown that won't render on X. ──────────────
  // X shows posts as plain text — markdown syntax appears literally, symbols and
  // all. This is "objectively wrong for X" (not spelling/grammar), so it's a
  // correctness finding with a one-click strip. High-precision patterns only.
  const mdRules: { re: RegExp; replacement: (m: RegExpExecArray) => string; title: string }[] = [
    { re: /\*\*([^*\n]+)\*\*/g, replacement: (m) => m[1], title: "Bold markdown won't render on X" },
    { re: /__([^_\n]+)__/g, replacement: (m) => m[1], title: "Bold markdown won't render on X" },
    { re: /`([^`\n]+)`/g, replacement: (m) => m[1], title: "Backticks won't render on X" },
    { re: /\[([^\]\n]+)\]\(([^)\s]+)\)/g, replacement: (m) => `${m[1]} ${m[2]}`, title: "Markdown link won't render on X" },
    { re: /^(#{1,6})\s+/gm, replacement: () => "", title: "Markdown heading won't render on X" },
  ];
  for (const rule of mdRules) {
    const re = new RegExp(rule.re.source, rule.re.flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      findings.push({
        id: `md:${start}`,
        class: "correctness",
        severity: "warning",
        title: rule.title,
        why: "X shows posts as plain text — this markdown appears literally, symbols and all.",
        span: { quote: text.slice(start, end), start, end },
        replacement: rule.replacement(m),
        source: "tier0",
        signal: "markdown",
      });
      if (m.index === re.lastIndex) re.lastIndex++; // zero-width guard
    }
  }

  // ── Clarity: filler words (suggestion, quiet) — underline + delete on accept.
  // Whole-word match only, to avoid flagging "justice" for "just".
  for (const w of FILLER_WORDS) {
    const re = new RegExp(`\\b${w}\\b`, "gi");
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const start = m.index;
      // Eat one trailing space so "really matters" → "matters", not "  matters".
      const end = start + m[0].length + (text[start + m[0].length] === " " ? 1 : 0);
      findings.push({
        id: `filler:${start}`,
        class: "clarity",
        severity: "suggestion",
        title: `Trim "${m[0]}"`,
        why: "Filler words dilute a tweet. Cutting them makes the line land harder.",
        span: { quote: text.slice(start, end), start, end },
        replacement: "",
        source: "tier0",
        signal: "filler",
      });
    }
  }

  // ── Badges: positive / state signals (never underlines). ──────────────────
  const hasReplyHook = REPLY_DRIVING.some((p) => low.includes(p));
  if (hasReplyHook) {
    badges.push({
      id: "reply-hook",
      status: "good",
      label: "Invites replies",
      detail: claimNote("reply_over_like"),
    });
  } else if (!authenticityFirst) {
    badges.push({
      id: "reply-hook",
      status: "caution",
      label: "No reply hook",
      detail: "Nothing here invites a reply. A question or a clear stance is the biggest lever you have.",
    });
    chips.push({
      id: "chip:reply-hook",
      kind: "nudge",
      label: "End with a question",
      detail: "A genuine question is the strongest reach lever you have.",
    });
  }

  if (input.hasMedia) {
    badges.push({
      id: "media",
      status: "good",
      label: "Has native media",
      detail: claimNote("media_rewarded"),
    });
  }

  const dwellWorthy = input.isThread || text.trim().length >= 180;
  if (dwellWorthy) {
    badges.push({
      id: "dwell",
      status: "good",
      label: input.isThread ? "Thread — built for dwell" : "Substantial read",
      detail: claimNote("dwell_rewarded"),
    });
  }

  // Wall of text: long single-block copy kills the dwell the length could earn —
  // readers scroll past what they can't skim. Formatting is the writer's call
  // (no safe one-click restructure), so this is a badge + nudge chip, and it
  // costs reach points until line breaks appear (the edit itself moves the score).
  const wallOfText = !input.isThread && text.trim().length >= 200 && !text.includes("\n");
  if (wallOfText) {
    badges.push({
      id: "wall-of-text",
      status: "caution",
      label: "Wall of text",
      detail: "One unbroken block gets scrolled past — line breaks are what turn length into dwell time.",
    });
    chips.push({
      id: "chip:line-breaks",
      kind: "nudge",
      label: "Break it into lines",
      detail: "Short lines with air between them hold the reader — dwell is rewarded (~20× a like).",
    });
  }

  if (charInfo.isOverLimit) {
    badges.push({
      id: "over-limit",
      status: "caution",
      label: `${Math.abs(charInfo.remaining)} over the limit`,
      detail: `This is ${charInfo.weighted}/${limit} X-weighted characters (links count as 23).`,
    });
  }

  // ── Reach sub-score (deterministic, 0-100). ───────────────────────────────
  const reach = computeReachScore({
    hasLink: urls.length > 0,
    hasBait: findings.some((f) => f.signal === "negative_feedback"),
    hasReplyHook,
    dwellWorthy,
    overLimit: charInfo.isOverLimit,
    hasMedia: Boolean(input.hasMedia),
    hashtagSpam,
    leadingMention: Boolean(leadMention),
    wallOfText,
    authenticityFirst,
  });

  const scores: Scores = {
    // Pre-Live-Read the headline is the reach sub-score (the only holistic signal
    // we can compute for free); flagged provisional until voice + performance land.
    post: reach,
    postProvisional: true,
    voice: null,
    performance: null,
    reach,
  };

  return { findings, badges, chips, scores, charInfo };
}

function computeReachScore(s: {
  hasLink: boolean;
  hasBait: boolean;
  hasReplyHook: boolean;
  dwellWorthy: boolean;
  overLimit: boolean;
  hasMedia: boolean;
  hashtagSpam: boolean;
  leadingMention: boolean;
  wallOfText: boolean;
  authenticityFirst: boolean;
}): number {
  let score = 70; // neutral baseline
  if (s.hasReplyHook) score += 18;
  else if (!s.authenticityFirst) score -= 15;
  if (s.dwellWorthy) score += 6;
  if (s.hasMedia) score += 6;
  if (s.hasLink) score -= 25; // the big documented penalty
  if (s.hasBait) score -= 20;
  if (s.leadingMention) score -= 18; // reply-style opener buries reach
  if (s.hashtagSpam) score -= 8;
  if (s.overLimit) score -= 12;
  if (s.wallOfText) score -= 5; // unbroken block forfeits the dwell credit
  return Math.max(0, Math.min(100, Math.round(score)));
}
