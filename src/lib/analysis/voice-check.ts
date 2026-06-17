/**
 * Voice check — the "tuner": judge a draft against the user's assembled voice
 * prompt and enabled patterns. Shared by POST /api/voice/check (web app) and
 * POST /api/v1/voice/check (agent surface / check_draft MCP tool).
 */
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createChatCompletion, AIProvider } from "@/lib/ai";
import { getAssembledPromptForUser } from "@/lib/openai/prompts/prompt-assembler";
import type { VoiceType } from "@/types/voice";

export interface VoiceCheckResult {
  score: number; // 0-100 — how well the draft matches the tuned voice
  matches: string[]; // what the draft gets right
  deviations: string[]; // where it drifts from the voice/patterns
  suggested_edit: string; // a rewrite that closes the gap
}

export async function runVoiceCheck(
  supabase: SupabaseClient,
  userId: string,
  draftText: string,
  voiceType: VoiceType
): Promise<VoiceCheckResult> {
  const [systemPrompt, { data: voiceSettings }] = await Promise.all([
    getAssembledPromptForUser(supabase, userId, voiceType),
    supabase
      .from("user_voice_settings")
      .select("ai_model")
      .eq("user_id", userId)
      .eq("voice_type", voiceType)
      .single(),
  ]);

  const aiProvider: AIProvider = (voiceSettings?.ai_model as AIProvider) || "openai";

  const judgePrompt = `You are a strict voice editor. Below is the full voice specification a user's content must match — their base style rules, voice controls, niche, proven patterns, and real examples of their writing.

=== VOICE SPECIFICATION ===
${systemPrompt}
=== END VOICE SPECIFICATION ===

Judge this ${voiceType === "reply" ? "reply" : "post"} draft against the specification:

"""
${draftText}
"""

Score how well the draft matches the user's voice and proven patterns (0 = nothing like them, 100 = indistinguishable from their best work). Be calibrated: most decent drafts land 55-85.

Return ONLY valid JSON in this exact shape:
{
  "score": 0,
  "matches": ["specific things the draft gets right vs the spec"],
  "deviations": ["specific ways the draft drifts from the voice, controls, or patterns"],
  "suggested_edit": "the draft rewritten to close the gaps while keeping its core idea (280 chars max for a single post)"
}`;

  const result = await createChatCompletion({
    provider: aiProvider,
    modelTier: "fast",
    messages: [
      { role: "system", content: "You are an expert editorial voice critic. Return valid JSON only." },
      { role: "user", content: judgePrompt },
    ],
    temperature: 0.2,
    maxTokens: 1000,
    jsonResponse: false,
  });

  const raw = result.content || "{}";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Voice check returned no parseable result");
  }

  const parsed = JSON.parse(jsonMatch[0]) as Partial<VoiceCheckResult>;
  const score = Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0)));

  const checkResult: VoiceCheckResult = {
    score,
    matches: Array.isArray(parsed.matches) ? parsed.matches.map(String) : [],
    deviations: Array.isArray(parsed.deviations) ? parsed.deviations.map(String) : [],
    suggested_edit: String(parsed.suggested_edit || ""),
  };

  // Persist so recurring deviations can feed tune-up suggestions (closing
  // the loop). Best-effort: a storage failure must not fail the check.
  const { error: persistError } = await supabase.from("voice_check_results").insert({
    user_id: userId,
    draft_hash: createHash("sha256").update(draftText).digest("hex"),
    voice_type: voiceType,
    score: checkResult.score,
    matches: checkResult.matches,
    deviations: checkResult.deviations,
    suggested_edit: checkResult.suggested_edit || null,
  });
  if (persistError) {
    console.error("Failed to persist voice check result:", persistError);
  }

  return checkResult;
}
