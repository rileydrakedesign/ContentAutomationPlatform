import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createAuthClient } from "@/lib/supabase/server";
import { corsHeaders, handleCors } from "@/lib/cors";

export async function OPTIONS() {
  return handleCors();
}

// Dual auth: Bearer token (extension) or cookie (dashboard)
async function getAuthenticatedUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return { user: null, supabase: null };
    return { user, supabase };
  }

  const supabase = await createAuthClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { user: null, supabase: null };
  return { user, supabase };
}

// POST — submit feedback
export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request);
    if (!user || !supabase) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const body = await request.json();
    const { feedback_type, generation_type, content_text, context_prompt, metadata } = body;

    if (!feedback_type || !generation_type || !content_text) {
      return NextResponse.json(
        { error: "feedback_type, generation_type, and content_text are required" },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!["like", "dislike"].includes(feedback_type)) {
      return NextResponse.json({ error: "feedback_type must be 'like' or 'dislike'" }, { status: 400, headers: corsHeaders });
    }

    if (!["post", "reply"].includes(generation_type)) {
      return NextResponse.json({ error: "generation_type must be 'post' or 'reply'" }, { status: 400, headers: corsHeaders });
    }

    const { data, error } = await supabase
      .from("generation_feedback")
      .insert({
        user_id: user.id,
        feedback_type,
        generation_type,
        content_text,
        context_prompt: context_prompt || null,
        metadata: metadata || {},
      })
      .select("id, created_at")
      .single();

    if (error) {
      console.error("[generation-feedback] Insert error:", error);
      return NextResponse.json({ error: "Failed to save feedback" }, { status: 500, headers: corsHeaders });
    }

    return NextResponse.json(data, { headers: corsHeaders });
  } catch (err) {
    console.error("[generation-feedback] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: corsHeaders });
  }
}

// GET — fetch recent feedback (used by prompt assembler)
export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request);
    if (!user || !supabase) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const { searchParams } = new URL(request.url);
    const generation_type = searchParams.get("generation_type") || "reply";
    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 50);

    const { data, error } = await supabase
      .from("generation_feedback")
      .select("content_text, feedback_type, metadata, created_at")
      .eq("user_id", user.id)
      .eq("generation_type", generation_type)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("[generation-feedback] Fetch error:", error);
      return NextResponse.json({ error: "Failed to fetch feedback" }, { status: 500, headers: corsHeaders });
    }

    return NextResponse.json(data || [], { headers: corsHeaders });
  } catch (err) {
    console.error("[generation-feedback] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: corsHeaders });
  }
}
