import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createAuthClient } from "@/lib/supabase/server";
import { corsHeaders, handleCors } from "@/lib/cors";
import { openai } from "@/lib/openai/client";
import { getReplyGenerationContext } from "@/lib/openai/prompts/reply-guidelines";

// Handle CORS preflight
export async function OPTIONS() {
  return handleCors();
}

// Load full guidelines context (cached after first load)
const GUIDELINES_CONTEXT = getReplyGenerationContext();

// Focused instruction prompt that references the loaded guidelines
const INSTRUCTION_PROMPT = `You are writing replies to social media posts. You have been given extensive guidelines above on writing principles, copywriting tactics, and real high-performing examples.

## YOUR TASK

Write replies that add something NEW - information, perspective, or insight not already in the original post.

## HARD RULES

NEVER:
- Restate or rephrase what the post says
- Give generic agreement ("So true!", "This is the way")
- Ask obvious questions
- Use filler phrases ("I think", "In my opinion", "Honestly")
- Sound like AI (no perfect grammar, no corporate tone)

ALWAYS:
- Add a fact, example, or angle the post doesn't have
- Take a clear stance (even if controversial)
- Sound like a real person texting a friend
- Be specific (names, numbers, examples)

## THE TEST

Ask yourself: "Could someone figure this out just by reading the original post?"
If YES → don't say it
If NO → good, it adds value

## OUTPUT FORMAT

Return exactly 3 replies as JSON:
- One MUST be a punchy one-liner (under 50 chars)
- The other two should be ONE short sentence each (under 120 chars)
- No dense paragraphs. No multiple points. Just one quick, sharp thought per reply.

{"replies":[{"text":"...","approach":"2-3 words"},{"text":"...","approach":"2-3 words"},{"text":"...","approach":"2-3 words"}]}`;

// Helper to get user from either cookie or Bearer token
async function getAuthenticatedUser(request: NextRequest) {
  // Check for Bearer token first (from extension)
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.substring(7);

    // Create client with the access token
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return { user: null, supabase: null };
    }
    return { user, supabase };
  }

  // Fall back to cookie-based auth
  const supabase = await createAuthClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return { user: null, supabase: null };
  }
  return { user, supabase };
}

interface GenerateReplyRequest {
  post_text: string;
  author_handle?: string;
}

interface ReplyOption {
  text: string;
  approach: string;
}

interface GenerateReplyResponse {
  replies: ReplyOption[];
}

// POST /api/generate-reply - Generate AI reply options to a post
export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request);

    if (!user || !supabase) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: corsHeaders }
      );
    }

    const body: GenerateReplyRequest = await request.json();

    // Validate required fields
    if (!body.post_text) {
      return NextResponse.json(
        { error: "post_text is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    const userPrompt = `Reply to this post from @${body.author_handle || 'someone'}:

"${body.post_text}"

Give me 3 different reply options. Keep each under 280 characters.`;

    // Combine guidelines + instructions as system prompt
    const fullSystemPrompt = `${GUIDELINES_CONTEXT}\n\n---\n\n${INSTRUCTION_PROMPT}`;

    console.log("[generate-reply] Starting OpenAI call...");
    console.log("[generate-reply] System prompt length:", fullSystemPrompt.length);
    console.log("[generate-reply] User prompt:", userPrompt);

    let completion;
    try {
      completion = await openai.chat.completions.create({
        model: "gpt-5-mini",
        messages: [
          { role: "system", content: fullSystemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_completion_tokens: 4000,
        response_format: { type: "json_object" },
      });
      console.log("[generate-reply] OpenAI call succeeded");
      console.log("[generate-reply] Full response:", JSON.stringify(completion, null, 2));
    } catch (openaiError: any) {
      console.error("[generate-reply] OpenAI API error:", openaiError?.message);
      console.error("[generate-reply] OpenAI error details:", JSON.stringify(openaiError, null, 2));
      return NextResponse.json(
        { error: `OpenAI error: ${openaiError?.message || 'Unknown'}` },
        { status: 500, headers: corsHeaders }
      );
    }

    const content = completion.choices[0]?.message?.content?.trim() || "";
    console.log("[generate-reply] Response content:", content.substring(0, 200));

    if (!content) {
      console.error("[generate-reply] Empty content received");
      return NextResponse.json(
        { error: "Failed to generate replies" },
        { status: 500, headers: corsHeaders }
      );
    }

    // Parse the JSON response
    let parsed: GenerateReplyResponse;
    try {
      parsed = JSON.parse(content);
      console.log("[generate-reply] Parsed successfully, replies count:", parsed.replies?.length);
    } catch (parseError) {
      console.error("[generate-reply] Failed to parse reply JSON:", content);
      return NextResponse.json(
        { error: "Failed to parse generated replies" },
        { status: 500, headers: corsHeaders }
      );
    }

    // Validate and truncate replies
    const replies = (parsed.replies || []).slice(0, 3).map((reply) => ({
      text: reply.text?.length > 280 ? reply.text.substring(0, 277) + "..." : reply.text,
      approach: reply.approach || "Reply",
    }));

    if (replies.length === 0) {
      return NextResponse.json(
        { error: "No replies generated" },
        { status: 500, headers: corsHeaders }
      );
    }

    return NextResponse.json({ replies }, { headers: corsHeaders });
  } catch (error) {
    console.error("Failed to generate replies:", error);
    return NextResponse.json(
      { error: "Failed to generate replies" },
      { status: 500, headers: corsHeaders }
    );
  }
}
