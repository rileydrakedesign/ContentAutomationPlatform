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
  score: number; // 0..1-ish
  reasons: string[];
};

function safeNumber(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  return Number.isFinite(v) ? v : 0;
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

function parseDateMaybe(dateStr: string): Date | null {
  // Stored as ISO when possible in /api/analytics/csv, but keep defensive.
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

    const { data, error } = await supabase
      .from("user_analytics")
      .select("posts, uploaded_at")
      .eq("user_id", user.id)
      .order("uploaded_at", { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== "PGRST116") throw error;
    if (!data) return NextResponse.json({ data: [] });

    const posts = (Array.isArray((data as any).posts) ? (data as any).posts : []) as PostAnalytics[];

    const now = Date.now();
    const windowMs = days * 24 * 60 * 60 * 1000;

    const candidates = posts
      .filter((p) => !p.is_reply)
      .map((p) => {
        const dt = parseDateMaybe(p.date);
        if (!dt) return null;
        const ageMs = now - dt.getTime();
        const impressions = safeNumber(p.impressions);
        if (ageMs < 0) return null;
        if (ageMs > windowMs) return null;
        if (impressions < minImpressions) return null;

        const likes = safeNumber(p.likes);
        const replies = safeNumber(p.replies);
        const reposts = safeNumber(p.reposts);
        const bookmarks = safeNumber(p.bookmarks);
        const engagements = likes + replies + reposts + bookmarks;
        const engagementRate = impressions > 0 ? engagements / impressions : 0;

        const postUrl = (p.post_url || "").trim();
        if (!postUrl) return null;

        return {
          post_id: p.post_id || p.id,
          post_url: postUrl,
          text: p.text || "",
          date: p.date,
          impressions,
          engagements,
          engagement_rate: engagementRate,
          age_hours: ageMs / (1000 * 60 * 60),
          recency_norm: clamp01(1 - ageMs / windowMs),
        };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));

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

      const reasons: string[] = [];
      reasons.push(`High engagement rate (${(c.engagement_rate * 100).toFixed(2)}%)`);
      reasons.push(`Strong reach (${Math.round(c.impressions).toLocaleString()} impressions)`);
      reasons.push(`Recent (${Math.round(c.age_hours)}h ago)`);

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
        reasons,
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
