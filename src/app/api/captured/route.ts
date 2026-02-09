import { NextRequest, NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";

// GET /api/captured - List captured posts with filters
export async function GET(request: NextRequest) {
  try {
    const supabase = await createAuthClient();

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status"); // inbox, triaged
    const triagedAs = searchParams.get("triaged_as"); // my_post, inspiration
    const collectionId = searchParams.get("collection_id");

    let query = supabase
      .from("captured_posts")
      .select("*")
      .eq("user_id", user.id)
      .order("captured_at", { ascending: false });

    // Apply filters
    if (status) {
      query = query.eq("inbox_status", status);
    }

    if (triagedAs) {
      query = query.eq("triaged_as", triagedAs);
    }

    if (collectionId) {
      query = query.eq("collection_id", collectionId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to fetch captured posts:", error);
    return NextResponse.json(
      { error: "Failed to fetch captured posts" },
      { status: 500 }
    );
  }
}
