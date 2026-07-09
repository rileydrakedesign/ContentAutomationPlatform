import { withApiAuth, apiSuccess, apiError, apiOptions } from "@/lib/api/v1-handler";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { createChatCompletion, AIProvider, resolveProvider } from "@/lib/ai";
import {
  CREDIT_COSTS,
  requireCredits,
  refundCredits,
  checkDailyActionCap,
  withCreditHeaders,
} from "@/lib/billing/credits";

export const OPTIONS = apiOptions;

type DraftType = "X_POST" | "X_THREAD";
type VoiceType = "post" | "reply";

// POST /api/v1/drafts/generate — Generate draft options from a topic or reply target
export const POST = withApiAuth(["drafts:generate"], async ({ auth, request }) => {
  let body: {
    topic?: string;
    draftType?: DraftType;
    voiceType?: VoiceType;
    patternIds?: string[];
    generateCount?: number;
    inspirationPost?: { text: string; author: string };
    replyTo?: { tweetId?: string; text: string; author?: string };
  };
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body", "invalid_body", 400);
  }

  const { draftType = "X_POST", patternIds = [], generateCount = 3, inspirationPost, replyTo } = body;
  const voiceType: VoiceType = body.voiceType === "reply" ? "reply" : "post";
  const isReply = voiceType === "reply";
  const topic = body.topic;

  // For replies, the target tweet is the subject; topic is optional context/angle.
  if (isReply) {
    if (!replyTo?.text || replyTo.text.trim().length < 1) {
      return apiError("replyTo.text is required when voiceType is 'reply'", "validation_error", 400);
    }
  } else if (!topic || topic.trim().length < 3) {
    return apiError("Topic must be at least 3 characters", "validation_error", 400);
  }

  if (!["X_POST", "X_THREAD"].includes(draftType)) {
    return apiError("draftType must be X_POST or X_THREAD", "validation_error", 400);
  }

  // Agent-surface metering replaces the in-app daily AI quota here: the API
  // is governed by credits + its own daily cap, and does not consume the
  // in-app free-tier generation allowance (ai_usage_log).
  const dailyCap = await checkDailyActionCap(auth.userId, "generate");
  if (!dailyCap.allowed) {
    return apiError(
      `Daily API generation cap reached (${dailyCap.used}/${dailyCap.limit})`,
      "daily_cap",
      429,
      { used: dailyCap.used, limit: dailyCap.limit }
    );
  }

  // Debit after the request is known-valid (a 400 shouldn't cost credits);
  // refunded below if the model call or parse fails.
  const charge = await requireCredits(
    auth.userId,
    CREDIT_COSTS["drafts.generate"],
    "drafts.generate"
  );
  if (charge instanceof NextResponse) return charge;

  const supabase = createAdminClient();
  const count = Math.min(5, Math.max(1, generateCount));

  // Fetch patterns
  let patterns: { id: string; pattern_type: string; pattern_name: string; pattern_value: string; multiplier: number }[] = [];
  if (patternIds.length > 0) {
    const { data } = await supabase
      .from("extracted_patterns")
      .select("id, pattern_type, pattern_name, pattern_value, multiplier")
      .in("id", patternIds)
      .eq("user_id", auth.userId);
    patterns = data || [];
  } else {
    const { data } = await supabase
      .from("extracted_patterns")
      .select("id, pattern_type, pattern_name, pattern_value, multiplier")
      .eq("user_id", auth.userId)
      .eq("is_enabled", true)
      .order("multiplier", { ascending: false })
      .limit(3);
    patterns = data || [];
  }

  const aiProvider: AIProvider = resolveProvider();

  // Voice examples and default patterns come from the assembled system
  // prompt (one canonical tuned context). The user prompt only carries
  // explicit per-request steering: caller-selected pattern IDs.
  const patternInstructions = patternIds.length > 0 && patterns.length > 0
    ? `Apply these patterns the user selected:\n${patterns.map(p => `- ${p.pattern_name}: ${p.pattern_value}`).join("\n")}`
    : "";

  const inspirationInstructions = inspirationPost
    ? `Use this post as style inspiration (adapt, don't copy):\n@${inspirationPost.author}: "${inspirationPost.text}"`
    : "";

  let prompt: string;
  if (isReply) {
    const targetAuthor = replyTo!.author ? `@${replyTo!.author}` : "someone";
    const angle = topic && topic.trim().length > 0
      ? `\nAngle / point you want to make: "${topic}"`
      : "";
    prompt = `Write ${count} reply options to this post by ${targetAuthor}:
"""
${replyTo!.text}
"""${angle}

Each reply must be a single tweet under 280 characters. Be conversational and add value — agree, build on it, or respectfully push back. Do not restate their post. No hashtags.
${inspirationInstructions}
${patternInstructions}

Return a JSON array with ${count} options. Each option should have:
- "content": The reply text
- "hook_type": The angle you took (e.g. agree-and-extend, contrarian, question, anecdote)
- "patterns_applied": Array of pattern names you applied

Return ONLY the JSON array, no other text.`;
  } else {
    const formatInstructions = draftType === "X_THREAD"
      ? "Generate a thread of 3-5 connected tweets. Each tweet MUST be under 280 characters."
      : "Generate a single post for X. The ENTIRE post MUST be 280 characters or fewer, counting line breaks. Use formatting (line breaks, bullets) for readability when appropriate, but never exceed 280 characters.";

    prompt = `Generate ${count} ${draftType === "X_THREAD" ? "thread" : "tweet"} options about: "${topic}"

${formatInstructions}
${inspirationInstructions}
${patternInstructions}

Return a JSON array with ${count} options. Each option should have:
- "content": The tweet text (or array of tweets for threads)
- "hook_type": What type of hook you used
- "patterns_applied": Array of pattern names you applied

Return ONLY the JSON array, no other text.`;
  }

  // Assemble the full voice system prompt (post or reply voice)
  const { getAssembledPromptForUser } = await import("@/lib/openai/prompts/prompt-assembler");
  const systemPrompt = await getAssembledPromptForUser(supabase, auth.userId, voiceType);

  let result: { content: string | null };
  try {
    result = await createChatCompletion({
      provider: aiProvider,
      modelTier: "fast",
      messages: [
        { role: "system", content: `${systemPrompt}\n\nReturn valid JSON only.` },
        { role: "user", content: prompt },
      ],
      temperature: 0.8,
      maxTokens: 2000,
      jsonResponse: false,
    });
  } catch (e) {
    await refundCredits(auth.userId, charge.charged, "refund.generate_failed");
    return apiError(
      `Generation failed: ${e instanceof Error ? e.message : "unknown error"}`,
      "generation_failed",
      502
    );
  }

  const responseText = result.content || "[]";

  let generatedOptions = [];
  try {
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      generatedOptions = JSON.parse(jsonMatch[0]);
    }
  } catch {
    await refundCredits(auth.userId, charge.charged, "refund.generate_failed");
    return apiError("Failed to parse generated content", "generation_failed", 500);
  }

  const options = generatedOptions.map((option: { content: unknown; hook_type?: string; patterns_applied?: string[] }) => {
    const isThread = !isReply && draftType === "X_THREAD";
    const text = Array.isArray(option.content) ? option.content[0] : option.content;
    const content = isThread
      ? { tweets: Array.isArray(option.content) ? option.content : [option.content] }
      : { text };
    return {
    // Replies are structurally a single post; carry reply intent in metadata.
    type: isReply ? "X_POST" : draftType,
    content,
    topic: topic || null,
    applied_patterns: patterns.map(p => p.id),
    metadata: {
      hook_type: option.hook_type,
      patterns_applied: option.patterns_applied,
      voice_type: voiceType,
      ...(isThread
        ? {}
        : {
            char_count: typeof text === "string" ? text.length : null,
            over_limit: typeof text === "string" ? text.length > 280 : null,
          }),
      ...(isReply
        ? {
            is_reply: true,
            reply_to: { tweetId: replyTo!.tweetId || null, author: replyTo!.author || null },
            generation_type: "reply",
          }
        : { generation_type: inspirationPost ? "inspiration_based" : "topic_based" }),
    },
    };
  });

  return withCreditHeaders(
    apiSuccess({ options, patterns_used: patterns, topic: topic || null, voice_type: voiceType }),
    charge
  );
});
