import { NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";
import { refreshVoiceExamples } from "@/lib/analysis/voice-refresh";

// POST /api/voice/refresh - Manually trigger a refresh of top examples
export async function POST() {
  try {
    const supabase = await createAuthClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await refreshVoiceExamples(supabase, user.id);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to refresh voice examples:", error);
    return NextResponse.json(
      { error: "Failed to refresh voice examples" },
      { status: 500 }
    );
  }
}
