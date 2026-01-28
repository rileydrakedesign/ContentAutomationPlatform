import { NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";
import { assemblePrompt } from "@/lib/openai/prompts/prompt-assembler";
import { DEFAULT_VOICE_SETTINGS, PromptPreviewResponse } from "@/types/voice";

// GET /api/voice/prompt-preview - Get the assembled prompt with token breakdown
export async function GET() {
  try {
    const supabase = await createAuthClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch voice settings
    let { data: settings } = await supabase
      .from("user_voice_settings")
      .select("*")
      .eq("user_id", user.id)
      .single();

    // Use defaults if no settings exist
    if (!settings) {
      settings = {
        id: "",
        user_id: user.id,
        ...DEFAULT_VOICE_SETTINGS,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    // Fetch voice examples (non-excluded)
    const { data: examples } = await supabase
      .from("user_voice_examples")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_excluded", false)
      .order("pinned_rank", { ascending: true, nullsFirst: false })
      .order("engagement_score", { ascending: false });

    // Fetch inspiration (non-excluded)
    const { data: inspirations } = await supabase
      .from("user_inspiration")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_excluded", false);

    // Assemble the prompt
    const assembled = assemblePrompt({
      settings: settings,
      examples: examples || [],
      inspirations: inspirations || [],
      mode: "reply",
    });

    const response: PromptPreviewResponse = {
      assembled,
      settings,
      examples: examples || [],
      inspirations: inspirations || [],
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to generate prompt preview:", error);
    return NextResponse.json(
      { error: "Failed to generate prompt preview" },
      { status: 500 }
    );
  }
}
