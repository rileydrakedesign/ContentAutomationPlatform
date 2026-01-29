import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createAuthClient } from "@/lib/supabase/server";
import { corsHeaders, handleCors } from "@/lib/cors";
import { createChatCompletion, AIProvider } from "@/lib/ai";
import { REPLY_SYSTEM_PROMPT } from "@/lib/openai/prompts/reply-prompt";
import { getAssembledPromptForUser } from "@/lib/openai/prompts/prompt-assembler";

// Handle CORS preflight
export async function OPTIONS() {
  return handleCors();
}

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

interface MediaItem {
  type: 'image' | 'gif' | 'video';
  alt: string | null;
  hasAlt: boolean;
}

interface PostContext {
  parent?: {
    text: string;
    author: string;
    isThreaded?: boolean;
  } | null;
  quoted?: {
    text: string;
    author: string;
  } | null;
  link?: {
    url: string;
    title: string;
    description: string;
    domain: string;
  } | null;
  media?: MediaItem[] | null;
}

interface GenerateReplyRequest {
  post_text: string;
  author_handle?: string;
  context?: PostContext;
  tone?: string;  // Optional tone for reply generation
}

interface GenerateReplyResponse {
  replies: string[];
}

/**
 * Get tone instruction based on selected tone
 */
function getToneInstruction(tone: string | undefined): string {
  if (!tone) return '';

  const toneInstructions: Record<string, string> = {
    controversial: 'Write a CONTROVERSIAL reply that challenges conventional thinking, presents an unpopular opinion, or takes a bold contrarian stance. Be provocative but not offensive.',
    sarcastic: 'Write a SARCASTIC reply with witty, ironic humor. Use dry wit and clever wordplay. Be playfully cutting without being mean-spirited.',
    helpful: 'Write a HELPFUL reply that adds genuine value, offers useful advice, or shares practical information. Be constructive and supportive.',
    insight: 'Write an INSIGHTFUL reply that offers a unique perspective, connects unexpected dots, or reveals a deeper truth. Make them think.',
    enthusiastic: 'Write an ENTHUSIASTIC reply with genuine excitement and positive energy. Be energetic and uplifting but stay authentic - avoid being cheesy.',
  };

  return toneInstructions[tone.toLowerCase()] || '';
}

/**
 * Build a rich context string from extracted post data
 */
function buildContextPrompt(context: PostContext | undefined): string {
  if (!context) return '';

  const parts: string[] = [];

  // Parent post (if replying to a reply)
  if (context.parent && (context.parent.text || context.parent.author)) {
    const parentInfo = context.parent.text
      ? `Parent post from @${context.parent.author || 'unknown'}:\n"${context.parent.text}"`
      : `Replying to @${context.parent.author}`;
    parts.push(parentInfo);
  }

  // Quoted tweet
  if (context.quoted && (context.quoted.text || context.quoted.author)) {
    const quoteInfo = `Quoted post from @${context.quoted.author || 'unknown'}:\n"${context.quoted.text}"`;
    parts.push(quoteInfo);
  }

  // Link preview
  if (context.link && (context.link.title || context.link.url)) {
    let linkInfo = `Link shared: ${context.link.title || context.link.url}`;
    if (context.link.description) {
      linkInfo += `\nPreview: "${context.link.description}"`;
    }
    if (context.link.domain) {
      linkInfo += ` (${context.link.domain})`;
    }
    parts.push(linkInfo);
  }

  // Media context
  if (context.media && context.media.length > 0) {
    const mediaDescriptions = context.media.map((m, i) => {
      if (m.hasAlt && m.alt) {
        return `${m.type} ${i + 1}: "${m.alt}"`;
      }
      return `${m.type} ${i + 1}: [no description]`;
    });

    const mediaInfo = `Media attached:\n${mediaDescriptions.join('\n')}`;
    parts.push(mediaInfo);
  }

  return parts.length > 0 ? '\n\n---\nADDITIONAL CONTEXT:\n' + parts.join('\n\n') : '';
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

    // Build context string from rich context data
    const contextStr = buildContextPrompt(body.context);

    // Build tone instruction if specified
    const toneInstruction = getToneInstruction(body.tone);

    const userPrompt = `${toneInstruction ? toneInstruction + '\n\n' : ''}Reply to this post from @${body.author_handle || 'someone'}:

"${body.post_text}"${contextStr}`;

    // Get personalized system prompt with user's voice examples and settings
    let systemPrompt: string;
    try {
      systemPrompt = await getAssembledPromptForUser(supabase, user.id);
      console.log("[generate-reply] Using personalized prompt with user settings");
    } catch (assemblyError) {
      console.log("[generate-reply] Falling back to base prompt:", assemblyError);
      systemPrompt = REPLY_SYSTEM_PROMPT;
    }

    // Get user's AI model preference
    let aiProvider: AIProvider = "openai";
    try {
      const { data: settings } = await supabase
        .from("user_voice_settings")
        .select("ai_model")
        .eq("user_id", user.id)
        .eq("voice_type", "reply")
        .single();

      if (settings?.ai_model) {
        aiProvider = settings.ai_model as AIProvider;
      }
    } catch (settingsError) {
      console.log("[generate-reply] Could not fetch AI model preference, using default:", settingsError);
    }

    console.log("[generate-reply] Starting AI call with provider:", aiProvider);
    console.log("[generate-reply] System prompt length:", systemPrompt.length);
    console.log("[generate-reply] User prompt:", userPrompt);

    let result;
    try {
      result = await createChatCompletion({
        provider: aiProvider,
        modelTier: "fast",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        maxTokens: 400,
        jsonResponse: true,
      });
      console.log("[generate-reply] AI call succeeded with provider:", result.provider, "model:", result.model);
    } catch (aiError: any) {
      console.error("[generate-reply] AI API error:", aiError?.message);
      console.error("[generate-reply] AI error details:", JSON.stringify(aiError, null, 2));
      return NextResponse.json(
        { error: `AI error: ${aiError?.message || 'Unknown'}` },
        { status: 500, headers: corsHeaders }
      );
    }

    const content = result.content;
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

    // Validate and truncate replies - convert string array to object array for frontend compatibility
    const repliesArray = parsed.replies || [];
    const labels = ["Punchy", "Insight", "Spicy"];

    // Clean up any meta-text that might have leaked into replies
    function cleanReplyText(text: string): string {
      if (typeof text !== 'string') return '';

      // Remove common meta-text patterns that LLMs sometimes include
      let cleaned = text
        .replace(/^(punchy|one-liner|short|medium|detailed|reply\s*\d*)\s*[:>\-]\s*/i, '')
        .replace(/^\[.*?\]\s*/i, '')
        .replace(/^\(.*?\)\s*/i, '')
        .trim();

      // Truncate if needed
      if (cleaned.length > 280) {
        cleaned = cleaned.substring(0, 277) + "...";
      }

      return cleaned;
    }

    const replies = repliesArray.slice(0, 3).map((reply: string, index: number) => ({
      text: cleanReplyText(typeof reply === 'string' ? reply : (reply as any).text || ""),
      approach: labels[index] || "Reply",
    })).filter(r => r.text.length > 0);

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
