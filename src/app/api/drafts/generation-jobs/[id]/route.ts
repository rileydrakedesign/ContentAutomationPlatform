import { NextRequest, NextResponse } from "next/server";
import { corsHeaders, handleCors } from "@/lib/cors";
import { getDualAuthUser } from "@/lib/api/dual-auth";

export async function OPTIONS() {
  return handleCors();
}

// GET /api/drafts/generation-jobs/[id]
// Poll an async agentic generation job. Returns its status, accumulated
// step-level progress events, and (when done) the final result.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase } = await getDualAuthUser(request);
  if (!user || !supabase) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
  }

  const { id } = await params;
  const { data, error } = await supabase
    .from("generation_jobs")
    .select("id, status, progress, result, error, created_at, updated_at")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "Job not found" }, { status: 404, headers: corsHeaders });
  }

  return NextResponse.json(data, { headers: corsHeaders });
}
