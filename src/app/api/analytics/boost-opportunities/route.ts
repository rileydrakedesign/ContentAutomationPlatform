import { NextRequest, NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";
import type { PostAnalytics } from "@/types/analytics";

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

function minMaxNormalize(values: number[]): number[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  if (span <= 0) return values.map(() => 0.5);
  return values.map((v) => (v - min) / span);
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
  if (erNorm >= 0.65) reasons.push(`High engagement rate (${(er * 100).toFixed(2)}%)`);
  if (impNorm >= 0.65) reasons.push(`Strong reach (${Math.round(impressions).toLocaleString()} impressions)`);
  if (recencyNorm >= 0.65) reasons.push(`Recent post (${Math.round(ageHours)}h ago)`);
  // Fallback: describe the best dimension if nothing qualified
  if (reasons.length === 0) {
    const best = Math.max(erNorm, impNorm, recencyNorm);
    if (best === erNorm) reasons.push(`Solid engagement rate (${(er * 100).toFixed(2)}%)`);
    else if (best === impNorm) reasons.push(`Decent reach (${Math.round(impressions).toLocaleString()} impressions)`);
    else reasons.push(`Relatively recent (${Math.round(ageHours)}h ago)`);
  }
  return reasons;
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

  const posts = (Array.isArray((data as any).posts) ? (data as any).posts : []) as PostAnalytics[];

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

      const likes = safeNumber(p.likes);
      const replies = safeNumber(p.replies);
      const reposts = safeNumber(p.reposts);
      const bookmarks = safeNumber(p.bookmarks);
      const engagements = likes + replies + reposts + bookmarks;

      return {
        post_id: p.post_id || p.id,
        post_url: postUrl,
        text: p.text || "",
        date: p.date,
        impressions,
        engagements,
        engagement_rate: impressions > 0 ? engagements / impressions : 0,
        age_hours: ageMs / (1000 * 60 * 60),
        recency_norm: clamp01(1 - ageMs / windowMs),
      };
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
    .limit(200);

  if (error || !data) return [];

  return (data as any[])
    .map((p): Candidate | null => {
      const dt = parseDateMaybe(p.post_timestamp || p.captured_at);
      if (!dt) return null;
      const ageMs = now - dt.getTime();
      if (ageMs < 0 || ageMs > windowMs) return null;

      const m = (p.metrics || {}) as Record<string, unknown>;
      const impressions = safeNumber(m.views); // captured_posts uses "views"
      if (impressions < minImpressions) return null;

      const postUrl = (p.post_url || "").trim();
      if (!postUrl) return null;

      const likes = safeNumber(m.likes);
      const replies = safeNumber(m.replies);
      const reposts = safeNumber(m.retweets ?? m.reposts);
      const bookmarks = safeNumber(m.bookmarks);
      const engagements = likes + replies + reposts + bookmarks;

      return {
        post_id: p.x_post_id || p.id,
        post_url: postUrl,
        text: p.text_content || "",
        date: p.post_timestamp || p.captured_at,
        impressions,
        engagements,
        engagement_rate: impressions > 0 ? engagements / impressions : 0,
        age_hours: ageMs / (1000 * 60 * 60),
        recency_norm: clamp01(1 - ageMs / windowMs),
      };
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
    for (const c of [...csvCandidates, ...capturedCandidates]) {
      if (!seenUrls.has(c.post_url)) {
        seenUrls.add(c.post_url);
        candidates.push(c);
      }
    }

    if (candidates.length === 0) {
      return NextResponse.json({
        data: [],
        meta: { days, minImpressions, limit, totalCandidates: 0 },
      });
    }

    const erNorm = minMaxNormalize(candidates.map((c) => c.engagement_rate));
    const impNorm = minMaxNormalize(candidates.map((c) => c.impressions));

    const scored: BoostOpportunity[] = candidates.map((c, i) => {
      const score = 0.6 * erNorm[i] + 0.25 * impNorm[i] + 0.15 * c.recency_norm;

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
