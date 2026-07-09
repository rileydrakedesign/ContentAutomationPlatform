/**
 * Opportunity Score 2.0, v0.5 subset (PRD_CORE §3.3): the factors computable
 * from a single search payload on the user's own token — author band,
 * competition, freshness, traction. The Phase-1 factors that need the sweep
 * pipeline (topic-fit embeddings vs watch centroids, velocity from metric
 * snapshots, learned per-user bands) slot in here later without changing the
 * shape.
 *
 * Every factor emits a plain-words reason string — "your score, explained" is
 * the positioning (never a black-box number). Ranking base is the canonical
 * opportunityTraction (weightedEngagement ÷ age, engagement.ts — the same
 * signal the extension pill renders) with replies capped at REPLY_HEAT_CAP for
 * targeting (see below), scaled by context multipliers.
 */
import { opportunityTraction, weightedEngagement } from "@/lib/utils/engagement";
import type { EnrichedSearchTweet } from "./search-mapping";

export interface OpportunityAssessment {
  /** Ranking score: canonical traction × context multipliers. */
  score: number;
  /** Plain-words factor reasons, strongest first — shown on the card. */
  reasons: string[];
}

// The proven engage-back band from the validated playbook: replies to 10k–100k
// accounts get seen AND answered. Mega accounts bury replies; tiny accounts
// rarely move the needle.
const BAND_MIN = 10_000;
const BAND_MAX = 100_000;

function authorBandFactor(t: EnrichedSearchTweet): { mult: number; reason: string | null } {
  const followers = t.author?.followers_count;
  if (followers == null) return { mult: 1, reason: null };
  const compact = followers >= 1000 ? `${Math.round(followers / 1000)}k` : String(followers);
  if (followers >= BAND_MIN && followers <= BAND_MAX) {
    return { mult: 1.5, reason: `${compact} followers — the proven 10k–100k engage-back band` };
  }
  if (followers > BAND_MAX) {
    return { mult: 0.7, reason: `${compact} followers — big account, replies get buried fast` };
  }
  if (followers < 1000) {
    return { mult: 0.85, reason: null };
  }
  return { mult: 1, reason: null };
}

function competitionFactor(t: EnrichedSearchTweet): { mult: number; reason: string | null } {
  const replies = t.metrics?.reply_count ?? 0;
  const views = t.metrics?.impression_count ?? 0;
  if (replies >= 100) {
    return { mult: 0.35, reason: `Crowded — ${replies} replies already` };
  }
  if (views > 0 && replies < 30 && views / (replies + 1) > 1500) {
    return {
      mult: 1.2,
      reason: `Early — ${replies} ${replies === 1 ? "reply" : "replies"} on ${views.toLocaleString()} views`,
    };
  }
  if (views === 0 && replies < 5) {
    return { mult: 1.1, reason: "Low reply competition" };
  }
  return { mult: 1, reason: null };
}

// Replies signal conversation heat, but for REPLY-TARGETING they double as
// competition: past this point another reply adds nothing for the would-be
// replier (the canonical 10× reply weight would otherwise let a 200-reply
// post buy its way past the crowd penalty — the exact "buried" post §3.3
// ranks down). This cap exists ONLY in the opportunity ranking; the canonical
// weightedEngagement/tractionScore stay untouched everywhere else.
const REPLY_HEAT_CAP = 30;

function opportunityBase(t: EnrichedSearchTweet, nowMs: number): number {
  const pm = t.metrics;
  if (!pm) return 0;
  const createdMs = t.created_at ? Date.parse(t.created_at) : NaN;
  const ageHours = Number.isFinite(createdMs) ? (nowMs - createdMs) / 3_600_000 : 1;
  return opportunityTraction(
    {
      likes: pm.like_count,
      retweets: pm.retweet_count,
      replies: Math.min(pm.reply_count ?? 0, REPLY_HEAT_CAP),
      bookmarks: pm.bookmark_count,
      impressions: pm.impression_count,
    },
    ageHours
  );
}

function freshnessReason(t: EnrichedSearchTweet, nowMs: number): string | null {
  const createdMs = t.created_at ? Date.parse(t.created_at) : NaN;
  if (!Number.isFinite(createdMs)) return null;
  const ageMin = Math.max(0, Math.round((nowMs - createdMs) / 60_000));
  if (ageMin < 60) return `Fresh — ${ageMin} min old`;
  if (ageMin < 6 * 60) return `${Math.round(ageMin / 60)}h old — reply window still open`;
  return null;
}

/**
 * Velocity (§3.3 "freshness + velocity"): Δ weighted engagement between two
 * metric snapshots of the same post — the candidate-pool sweeps store the
 * previous snapshot precisely for this. "Accelerating" beats "big": a post
 * gaining engagement NOW is where a reply gets seen.
 */
export interface MetricsSnapshot {
  like_count?: number;
  retweet_count?: number;
  reply_count?: number;
  bookmark_count?: number;
  impression_count?: number;
}

function snapshotEngagement(m: MetricsSnapshot): number {
  // Canonical weights via engagement.ts — never a local copy (G5).
  return weightedEngagement({
    likes: m.like_count,
    retweets: m.retweet_count,
    replies: m.reply_count,
    bookmarks: m.bookmark_count,
    impressions: m.impression_count,
  });
}

const VELOCITY_MIN_INTERVAL_MS = 10 * 60 * 1000; // need a real interval to divide by

export function velocityFactor(
  latest: MetricsSnapshot,
  prev: MetricsSnapshot,
  prevSweptAtMs: number,
  nowMs: number
): { mult: number; reason: string | null } {
  const dtMs = nowMs - prevSweptAtMs;
  if (!Number.isFinite(dtMs) || dtMs < VELOCITY_MIN_INTERVAL_MS) {
    return { mult: 1, reason: null };
  }
  const delta = snapshotEngagement(latest) - snapshotEngagement(prev);
  const perHour = delta / (dtMs / 3_600_000);
  if (perHour >= 30) {
    return { mult: 1.3, reason: `Accelerating — +${Math.round(perHour)} engagement/hour` };
  }
  if (perHour <= 1) {
    return { mult: 0.9, reason: null }; // gone quiet — quietly rank down
  }
  return { mult: 1, reason: null };
}

export function assessOpportunity(
  t: EnrichedSearchTweet,
  nowMs: number,
  extras: { prevMetrics?: MetricsSnapshot | null; prevSweptAtMs?: number | null } = {}
): OpportunityAssessment {
  const base = opportunityBase(t, nowMs);
  const band = authorBandFactor(t);
  const competition = competitionFactor(t);
  const velocity =
    extras.prevMetrics && extras.prevSweptAtMs && t.metrics
      ? velocityFactor(t.metrics, extras.prevMetrics, extras.prevSweptAtMs, nowMs)
      : { mult: 1, reason: null as string | null };

  const reasons: string[] = [];
  if (velocity.reason) reasons.push(velocity.reason);
  if (band.reason) reasons.push(band.reason);
  if (competition.reason) reasons.push(competition.reason);
  const fresh = freshnessReason(t, nowMs);
  if (fresh) reasons.push(fresh);

  return {
    score: base * band.mult * competition.mult * velocity.mult,
    reasons,
  };
}
