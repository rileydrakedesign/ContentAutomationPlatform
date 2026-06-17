import { withApiAuth, apiSuccess, apiOptions } from "@/lib/api/v1-handler";
import { createAdminClient } from "@/lib/supabase/server";
import { getAssembledPromptForUser } from "@/lib/openai/prompts/prompt-assembler";
import { getContextFreshness } from "@/lib/analysis/freshness";

export const OPTIONS = apiOptions;

// GET /api/v1/voice/context?type=post|reply — The user's full writing context,
// for agents that generate content THEMSELVES instead of calling our
// server-side generation: the assembled voice system prompt (settings, dials,
// guardrails, examples, inspiration) plus enabled proven patterns.
// 0 credits — it's the caller's model that pays the inference, not ours.
export const GET = withApiAuth(["voice:read"], async ({ auth, request }) => {
  const url = new URL(request.url);
  const voiceType = url.searchParams.get("type") === "reply" ? "reply" : "post";

  const supabase = createAdminClient();

  const [systemPrompt, { data: patterns }, freshness] = await Promise.all([
    getAssembledPromptForUser(supabase, auth.userId, voiceType),
    supabase
      .from("extracted_patterns")
      .select("pattern_type, pattern_name, pattern_value, multiplier")
      .eq("user_id", auth.userId)
      .eq("is_enabled", true)
      .order("multiplier", { ascending: false })
      .limit(10),
    getContextFreshness(supabase, auth.userId),
  ]);

  return apiSuccess({
    voice_type: voiceType,
    system_prompt: systemPrompt,
    // DEPRECATED: patterns are now part of system_prompt (PROVEN PATTERNS
    // section). This array is kept one release for agent compatibility and
    // will be removed.
    patterns: patterns ?? [],
    patterns_deprecated: true,
    // Freshness of this context vs the user's latest analytics — when
    // retune_recommended is true, suggest running run_tuneup first.
    context_freshness: freshness,
    rules: [
      "Write AS the user, in the voice defined by system_prompt — never mention being an AI.",
      "Stay on the user's niche positioning (see YOUR CONTENT NICHE in system_prompt): their audience and unique angle, not generic takes.",
      "Single posts and replies must be 280 characters or fewer, counting line breaks.",
      "Threads: each tweet 280 characters or fewer.",
      "Apply the PROVEN PATTERNS section in system_prompt where it fits naturally; never force a pattern. (The separate patterns array is deprecated — system_prompt is the single source.)",
      "No hashtags unless the voice examples use them.",
      "Optionally score a draft with the check_draft tool (POST /voice/check) before saving or publishing.",
      "Always show the draft to the user before publishing — publishing is irreversible.",
    ],
  });
});
