import { withApiAuth, apiSuccess, apiOptions } from "@/lib/api/v1-handler";
import { createAdminClient } from "@/lib/supabase/server";
import { getAssembledPromptForUser } from "@/lib/openai/prompts/prompt-assembler";

export const OPTIONS = apiOptions;

// GET /api/v1/voice/context?type=post|reply — The user's full writing context,
// for agents that generate content THEMSELVES instead of calling our
// server-side generation: the assembled voice system prompt (settings, dials,
// guardrails, examples, inspiration) plus enabled growth patterns.
// 0 credits — it's the caller's model that pays the inference, not ours.
export const GET = withApiAuth(["voice:read"], async ({ auth, request }) => {
  const url = new URL(request.url);
  const voiceType = url.searchParams.get("type") === "reply" ? "reply" : "post";

  const supabase = createAdminClient();

  const [systemPrompt, { data: patterns }] = await Promise.all([
    getAssembledPromptForUser(supabase, auth.userId, voiceType),
    supabase
      .from("extracted_patterns")
      .select("pattern_type, pattern_name, pattern_value, multiplier")
      .eq("user_id", auth.userId)
      .eq("is_enabled", true)
      .order("multiplier", { ascending: false })
      .limit(10),
  ]);

  return apiSuccess({
    voice_type: voiceType,
    system_prompt: systemPrompt,
    patterns: patterns ?? [],
    rules: [
      "Write AS the user, in the voice defined by system_prompt — never mention being an AI.",
      "Single posts and replies must be 280 characters or fewer, counting line breaks.",
      "Threads: each tweet 280 characters or fewer.",
      "Apply the highest-multiplier patterns where they fit naturally; never force one.",
      "No hashtags unless the voice examples use them.",
      "Always show the draft to the user before publishing — publishing is irreversible.",
    ],
  });
});
