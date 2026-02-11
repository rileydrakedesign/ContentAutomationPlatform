import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createAuthClient } from "@/lib/supabase/server";
import { corsHeaders, handleCors } from "@/lib/cors";

export async function OPTIONS() {
  return handleCors();
}

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

// POST /api/extension/replies
// Logs a reply the user sent through the Chrome extension (for consistency tracking)
export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request);
    if (!user || !supabase) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const body = await request.json();
    const reply_text = String(body?.reply_text || "").trim();
    const replied_to_post_id = body?.replied_to_post_id ? String(body.replied_to_post_id) : null;
    const replied_to_post_url = body?.replied_to_post_url ? String(body.replied_to_post_url) : null;
    const sent_at = body?.sent_at ? new Date(String(body.sent_at)).toISOString() : new Date().toISOString();

    if (!reply_text) {
      return NextResponse.json({ error: "reply_text is required" }, { status: 400, headers: corsHeaders });
    }

    const { error } = await supabase
      .from("extension_replies")
      .insert({
        user_id: user.id,
        reply_text,
        replied_to_post_id,
        replied_to_post_url,
        sent_at,
      });

    if (error) throw error;

    return NextResponse.json({ ok: true }, { headers: corsHeaders });
  } catch (e) {
    console.error("Failed to log extension reply:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500, headers: corsHeaders });
  }
}
