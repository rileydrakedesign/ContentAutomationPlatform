import { NextRequest, NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";
import { corsHeaders, handleCors } from "@/lib/cors";

export async function OPTIONS() {
  return handleCors();
}

// GET /api/niche/profile — Returns the user's current niche profile, or null if not yet analysed.
export async function GET() {
  try {
    const supabase = await createAuthClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: corsHeaders }
      );
    }

    const { data: profile, error } = await supabase
      .from("user_niche_profile")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (error && error.code === "PGRST116") {
      // No profile yet
      return NextResponse.json({ profile: null }, { status: 200, headers: corsHeaders });
    }
    if (error) throw error;

    return NextResponse.json({ profile }, { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error("Failed to fetch niche profile:", error);
    return NextResponse.json(
      { error: "Failed to fetch niche profile" },
      { status: 500, headers: corsHeaders }
    );
  }
}

// PATCH /api/niche/profile — Update editable fields (niche_summary, content_pillars).
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createAuthClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: corsHeaders }
      );
    }

    const body = await request.json();
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.niche_summary !== undefined) {
      updateData.niche_summary = body.niche_summary ? String(body.niche_summary) : null;
    }
    if (body.content_pillars !== undefined && Array.isArray(body.content_pillars)) {
      updateData.content_pillars = body.content_pillars.map(String).slice(0, 5);
    }

    const { data: profile, error } = await supabase
      .from("user_niche_profile")
      .update(updateData)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ profile }, { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error("Failed to update niche profile:", error);
    return NextResponse.json(
      { error: "Failed to update niche profile" },
      { status: 500, headers: corsHeaders }
    );
  }
}
