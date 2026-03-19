import { NextRequest, NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";
import type { PostAnalytics } from "@/types/analytics";

// Scoring weights must sum to 1.
const SCORE_WEIGHTS = {
  engagementRate: 0.6,
  impressions: 0.25,
  recency: 0.15,
} as const;

// Threshold above which a dimension is considered strong enough to mention.
const REASON_THRESHOLD = 0.65;

type BoostOpportunity = {
  post_id: string;
  post_url: string;
  text: string;
  date: string;
  impressions: number;
  engagements: number;
  engagement_rate: number; // 0..1
  age_hours: number;
  score: number; // 0..1
  reasons: string[];
};

type Candidate = {
  post_id: string;
  post_url: string;
  text: string;
  date: string;
  impressions: number;
  engagements: number;
  engagement_rate: number;
  age_hours: number;
  recency_norm: number;
};

// Typed DB row shapes — avoids `any` casts downstream.
type UserAnalyticsRow = { posts: PostAnalytics[] | null };
type CapturedPostRow = {
  id: string;
  x_post_id: string | null;
  post_url: string | null;
  text_content: string;
  metrics: Record<string, unknown> | null;
  post_timestamp: string | null;
  captured_at: string;
};

function safeNumber(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  return Number.isFinite(v) ? v : 0;
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

function parseDateMaybe(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return Number.isFinite(d.getTime()) ? d : null;
}

/** Returns [erNorm, impNorm] — single pass over candidates to avoid two separate iterations. */
function normalizeScoreInputs(candidates: Candidate[]): [number[], number[]] {
  const ers = candidates.map((c) => c.engagement_rate);
  const imps = candidates.map((c) => c.impressions);

  function normalize(values: number[]): number[] {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min;
    if (span <= 0) return values.map(() => 0.5);
    return values.map((v) => (v - min) / span);
  }

  return [normalize(ers), normalize(imps)];
}

function buildReasons(
  erNorm: number,
  impNorm: number,
  recencyNorm: number,
  er: number,
  impressions: number,
  ageHours: number
): string[] {
  const reasons: string[] = [];
  if (erNorm >= REASON_THRESHOLD) reasons.push(`High engagement rate (${(er * 100).toFixed(2)}%)`);
  if (impNorm >= REASON_THRESHOLD) reasons.push(`Strong reach (${Math.round(impressions).toLocaleString()} impressions)`);
  if (recencyNorm >= REASON_THRESHOLD) reasons.push(`Recent post (${Math.round(ageHours)}h ago)`);
  // Fallback: describe the single strongest dimension.
  if (reasons.length === 0) {
    const best = Math.max(erNorm, impNorm, recencyNorm);
    if (best === erNorm) reasons.push(`Solid engagement rate (${(er * 100).toFixed(2)}%)`);
    else if (best === impNorm) reasons.push(`Decent reach (${Math.round(impressions).toLocaleString()} impressions)`);
    else reasons.push(`Relatively recent (${Math.round(ageHours)}h ago)`);
  }
  return reasons;
}

/** Builds the common Candidate shape from pre-validated, normalised inputs. */
function buildCandidate(
  postId: string,
  postUrl: string,
  text: string,
  date: string,
  impressions: number,
  likes: number,
  replies: number,
  reposts: number,
  bookmarks: number,
  ageMs: number,
  windowMs: number
): Candidate {
  const engagements = likes + replies + reposts + bookmarks;
  return {
    post_id: postId,
    post_url: postUrl,
    text,
    date,
    impressions,
    engagements,
    engagement_rate: impressions > 0 ? engagements / impressions : 0,
    age_hours: ageMs / (1000 * 60 * 60),
    recency_norm: clamp01(1 - ageMs / windowMs),
  };
}

/** Pull candidates from user_analytics (CSV upload). */
async function getCsvCandidates(
  supabase: Awaited<ReturnType<typeof createAuthClient>>,
  userId: string,
  windowMs: number,
  minImpressions: number,
  now: number
): Promise<Candidate[]> {
  const { data, error } = await supabase
    .from("user_analytics")
    .select("posts")
    .eq("user_id", userId)
    .order("uploaded_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return [];

  const row = data as UserAnalyticsRow;
  const posts = Array.isArray(row.posts) ? row.posts : [];

  return posts
    .filter((p) => !p.is_reply)
    .map((p): Candidate | null => {
      const dt = parseDateMaybe(p.date);
      if (!dt) return null;
      const ageMs = now - dt.getTime();
      if (ageMs < 0 || ageMs > windowMs) return null;

      const impressions = safeNumber(p.impressions);
      if (impressions < minImpressions) return null;

      const postUrl = (p.post_url || "").trim();
      if (!postUrl) return null;

      return buildCandidate(
        p.post_id || p.id,
        postUrl,
        p.text || "",
        p.date,
        impressions,
        safeNumber(p.likes),
        safeNumber(p.replies),
        safeNumber(p.reposts),
        safeNumber(p.bookmarks),
        ageMs,
        windowMs
      );
    })
    .filter((x): x is Candidate => x !== null);
}

/** Pull candidates from captured_posts where is_own_post = true. */
async function getCapturedCandidates(
  supabase: Awaited<ReturnType<typeof createAuthClient>>,
  userId: string,
  windowMs: number,
  minImpressions: number,
  now: number
): Promise<Candidate[]> {
  const windowStart = new Date(now - windowMs).toISOString();

  const { data, error } = await supabase
    .from("captured_posts")
    .select("id, x_post_id, post_url, text_content, metrics, post_timestamp, captured_at")
    .eq("user_id", userId)
    .eq("is_own_post", true)
    .gte("post_timestamp", windowStart)
    .not("post_url", "is", null)
    .order("post_timestamp", { ascending: false })
    .limit(500);

  if (error || !data) return [];

  return (data as CapturedPostRow[])
    .map((p): Candidate | null => {
      const dt = parseDateMaybe(p.post_timestamp || p.captured_at);
      if (!dt) return null;
      const ageMs = now - dt.getTime();
      if (ageMs < 0 || ageMs > windowMs) return null;

      const m = p.metrics || {};
      const impressions = safeNumber(m.views); // captured_posts uses "views"
      if (impressions < minImpressions) return null;

      const postUrl = (p.post_url || "").trim();
      if (!postUrl) return null;

      return buildCandidate(
        p.x_post_id || p.id,
        postUrl,
        p.text_content || "",
        p.post_timestamp || p.captured_at,
        impressions,
        safeNumber(m.likes),
        safeNumber(m.replies),
        safeNumber((m.retweets ?? m.reposts) as unknown),
        safeNumber(m.bookmarks),
        ageMs,
        windowMs
      );
    })
    .filter((x): x is Candidate => x !== null);
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createAuthClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const limit = Math.max(1, Math.min(50, Number(url.searchParams.get("limit") || 10)));
    const days = Math.max(1, Math.min(30, Number(url.searchParams.get("days") || 7)));
    const minImpressions = Math.max(0, Number(url.searchParams.get("minImpressions") || 200));

    const now = Date.now();
    const windowMs = days * 24 * 60 * 60 * 1000;

    // Pull from both sources in parallel; deduplicate by post_url.
    const [csvCandidates, capturedCandidates] = await Promise.all([
      getCsvCandidates(supabase, user.id, windowMs, minImpressions, now),
      getCapturedCandidates(supabase, user.id, windowMs, minImpressions, now),
    ]);

    // Merge, preferring CSV data (richer metrics) when the same URL appears in both.
    const seenUrls = new Set<string>();
    const candidates: Candidate[] = [];
    for (const batch of [csvCandidates, capturedCandidates]) {
      for (const c of batch) {
        if (!seenUrls.has(c.post_url)) {
          seenUrls.add(c.post_url);
          candidates.push(c);
        }
      }
    }

    if (candidates.length === 0) {
      return NextResponse.json({
        data: [],
        meta: { days, minImpressions, limit, totalCandidates: 0 },
      });
    }

    const [erNorm, impNorm] = normalizeScoreInputs(candidates);

    const scored: BoostOpportunity[] = candidates.map((c, i) => {
      const score =
        SCORE_WEIGHTS.engagementRate * erNorm[i] +
        SCORE_WEIGHTS.impressions * impNorm[i] +
        SCORE_WEIGHTS.recency * c.recency_norm;

      return {
        post_id: c.post_id,
        post_url: c.post_url,
        text: c.text,
        date: c.date,
        impressions: c.impressions,
        engagements: c.engagements,
        engagement_rate: c.engagement_rate,
        age_hours: c.age_hours,
        score,
        reasons: buildReasons(erNorm[i], impNorm[i], c.recency_norm, c.engagement_rate, c.impressions, c.age_hours),
      };
    });

    scored.sort((a, b) => b.score - a.score);

    return NextResponse.json({
      data: scored.slice(0, limit),
      meta: { days, minImpressions, limit, totalCandidates: candidates.length },
    });
  } catch (error) {
    console.error("Failed to compute boost opportunities:", error);
    return NextResponse.json(
      { error: "Failed to compute boost opportunities" },
      { status: 500 }
    );
  }
}
