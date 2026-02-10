import { NextRequest, NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";
import { AddExampleRequest, VoiceType } from "@/types/voice";

// Estimate tokens (approx 4 chars per token)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// GET /api/voice/examples - Get all voice examples
// Query params:
//   ?type=post|reply - filter by content_type (required for voice-specific views)
//   ?include_excluded=true - include excluded examples
//   ?source=auto|pinned - filter by source
export async function GET(request: NextRequest) {
  try {
    const supabase = await createAuthClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const includeExcluded = searchParams.get("include_excluded") === "true";
    const source = searchParams.get("source"); // 'auto', 'pinned', or null for all
    const voiceType = searchParams.get("type") as VoiceType | null; // 'post' or 'reply'

    let query = supabase
      .from("user_voice_examples")
      .select("*")
      .eq("user_id", user.id);

    if (!includeExcluded) {
      query = query.eq("is_excluded", false);
    }

    if (source) {
      query = query.eq("source", source);
    }

    // Filter by content_type if voice type specified
    if (voiceType && ["post", "reply"].includes(voiceType)) {
      query = query.eq("content_type", voiceType);
    }

    // Order: pinned first (by rank), then by engagement score
    query = query
      .order("pinned_rank", { ascending: true, nullsFirst: false })
      .order("engagement_score", { ascending: false });

    let { data, error } = await query;

    if (error) throw error;

    // If the user has no examples yet for this voice type, seed a default top 5 from latest CSV analytics.
    if (voiceType && ["post", "reply"].includes(voiceType) && (!data || data.length === 0)) {
      try {
        const { data: analyticsRow } = await supabase
          .from("user_analytics")
          .select("posts")
          .eq("user_id", user.id)
          .order("uploaded_at", { ascending: false })
          .limit(1)
          .single();

        const posts = (analyticsRow?.posts && Array.isArray(analyticsRow.posts))
          ? (analyticsRow.posts as Array<Record<string, unknown>>)
          : [];

        const wantReplies = voiceType === "reply";
        const top = posts
          .filter((p) => Boolean(p.text))
          .filter((p) => (wantReplies ? p.is_reply === true : p.is_reply === false))
          .map((p) => ({
            text: String(p.text || "").trim(),
            impressions: Number((p as any).impressions || 0),
          }))
          .filter((p) => p.text.length >= 10)
          .sort((a, b) => b.impressions - a.impressions)
          .slice(0, 5);

        if (top.length > 0) {
          const inserts = top.map((p, idx) => ({
            user_id: user.id,
            captured_post_id: null,
            content_text: p.text,
            content_type: voiceType,
            source: "auto",
            is_excluded: false,
            pinned_rank: null,
            user_note: null,
            metrics_snapshot: { impressions: p.impressions },
            engagement_score: p.impressions,
            token_count: estimateTokens(p.text),
            selection_reason: `top by impressions (#${idx + 1})`,
          }));

          await supabase.from("user_voice_examples").insert(inserts);

          // Re-fetch
          const refreshed = await supabase
            .from("user_voice_examples")
            .select("*")
            .eq("user_id", user.id)
            .eq("is_excluded", false)
            .eq("content_type", voiceType)
            .order("pinned_rank", { ascending: true, nullsFirst: false })
            .order("engagement_score", { ascending: false });

          if (!refreshed.error) {
            data = refreshed.data || [];
          }
        }
      } catch (seedErr) {
        // best-effort; don't fail the request
        console.warn("voice examples seed failed", seedErr);
      }
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error("Failed to fetch voice examples:", error);
    return NextResponse.json(
      { error: "Failed to fetch voice examples" },
      { status: 500 }
    );
  }
}

// POST /api/voice/examples - Add a new voice example (manual pin)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createAuthClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: AddExampleRequest = await request.json();

    if (!body.content_text || !body.content_type) {
      return NextResponse.json(
        { error: "content_text and content_type are required" },
        { status: 400 }
      );
    }

    if (!['post', 'reply'].includes(body.content_type)) {
      return NextResponse.json(
        { error: "content_type must be 'post' or 'reply'" },
        { status: 400 }
      );
    }

    // Get the next pinned rank
    const { data: existingPinned } = await supabase
      .from("user_voice_examples")
      .select("pinned_rank")
      .eq("user_id", user.id)
      .eq("source", "pinned")
      .not("pinned_rank", "is", null)
      .order("pinned_rank", { ascending: false })
      .limit(1);

    const nextRank = existingPinned && existingPinned.length > 0
      ? (existingPinned[0].pinned_rank || 0) + 1
      : 1;

    const { data, error } = await supabase
      .from("user_voice_examples")
      .insert({
        user_id: user.id,
        content_text: body.content_text,
        content_type: body.content_type,
        captured_post_id: body.captured_post_id || null,
        source: "pinned",
        is_excluded: false,
        pinned_rank: nextRank,
        metrics_snapshot: {},
        engagement_score: 0,
        token_count: estimateTokens(body.content_text),
        selection_reason: "manually pinned",
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("Failed to add voice example:", error);
    return NextResponse.json(
      { error: "Failed to add voice example" },
      { status: 500 }
    );
  }
}
