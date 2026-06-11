import { withApiAuth, apiSuccess, apiError, apiOptions } from "@/lib/api/v1-handler";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { analyzeInspirationPost } from "@/lib/openai";
import {
  CREDIT_COSTS,
  requireCredits,
  refundCredits,
  withCreditHeaders,
} from "@/lib/billing/credits";

export const OPTIONS = apiOptions;

// GET /api/v1/inspiration — List saved inspiration posts. 0 credits.
export const GET = withApiAuth(["inspiration:read"], async ({ auth, request }) => {
  const supabase = createAdminClient();
  const url = new URL(request.url);
  const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit") || 100)));

  const { data, error } = await supabase
    .from("inspiration_posts")
    .select(
      "id, raw_content, source_url, author_handle, analysis_status, voice_analysis, format_analysis, metrics, post_timestamp, created_at"
    )
    .eq("user_id", auth.userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return apiSuccess({ inspiration: data || [] });
});

function extractHandleFromUrl(url?: string): string | null {
  if (!url) return null;
  const match = url.match(/(?:x\.com|twitter\.com)\/([^/]+)/);
  return match ? `@${match[1]}` : null;
}

// POST /api/v1/inspiration — Save an inspiration post and auto-analyze it.
// 3 credits (triggers an LLM voice/format analysis).
export const POST = withApiAuth(["inspiration:write"], async ({ auth, request }) => {
  let body: {
    content?: string;
    url?: string;
    authorHandle?: string;
    metrics?: Record<string, unknown>;
    post_timestamp?: string;
  };
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body", "invalid_body", 400);
  }

  const content = String(body.content || "").trim();
  if (!content) {
    return apiError("content is required", "validation_error", 400);
  }

  const supabase = createAdminClient();

  // Duplicate check before charging — a 409 shouldn't cost credits.
  if (body.url) {
    const { data: existing } = await supabase
      .from("inspiration_posts")
      .select("id")
      .eq("user_id", auth.userId)
      .eq("source_url", body.url)
      .maybeSingle();
    if (existing) {
      return apiError("Post already saved", "duplicate", 409, { id: existing.id });
    }
  }

  const charge = await requireCredits(
    auth.userId,
    CREDIT_COSTS["inspiration.create"],
    "inspiration.create",
    body.url
  );
  if (charge instanceof NextResponse) return charge;

  const { data: post, error: insertError } = await supabase
    .from("inspiration_posts")
    .insert({
      user_id: auth.userId,
      raw_content: content,
      source_url: body.url || null,
      author_handle: body.authorHandle || extractHandleFromUrl(body.url),
      platform: "X",
      analysis_status: "analyzing",
      metrics: body.metrics || {},
      post_timestamp: body.post_timestamp || null,
      source: "api",
    })
    .select("id, raw_content, source_url, author_handle, analysis_status, created_at")
    .single();

  if (insertError) {
    await refundCredits(auth.userId, charge.charged, "refund.inspiration_failed", body.url);
    return apiError("Failed to save inspiration post", "create_failed", 500);
  }

  // Analyze in the background (matches the internal route's behavior).
  void (async () => {
    try {
      const analysis = await analyzeInspirationPost(content);
      await supabase
        .from("inspiration_posts")
        .update({
          voice_analysis: analysis.voice,
          format_analysis: analysis.format,
          analysis_status: "completed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", post.id);
    } catch (err) {
      console.error("v1 inspiration: background analysis failed", err);
      await supabase
        .from("inspiration_posts")
        .update({ analysis_status: "failed", updated_at: new Date().toISOString() })
        .eq("id", post.id);
    }
  })();

  return withCreditHeaders(apiSuccess(post, 201), charge);
});
