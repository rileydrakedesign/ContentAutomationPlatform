import { NextRequest, NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";

// GET /api/publish/list - list scheduled posts for current user
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

    const limit = Number(request.nextUrl.searchParams.get("limit") || 50);

    const { data, error } = await supabase
      .from("scheduled_posts")
      .select("id, content_type, scheduled_for, status, posted_post_ids, error, job_id, created_at")
      .eq("user_id", user.id)
      .order("scheduled_for", { ascending: true })
      .limit(Math.min(200, Math.max(1, limit)));

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error) {
    console.error("Failed to list scheduled posts:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
