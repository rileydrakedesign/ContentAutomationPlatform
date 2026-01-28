import { NextRequest, NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";
import { openai } from "@/lib/openai/client";
import { ChatMessage, UserVoiceSettings, VoiceType, DEFAULT_VOICE_SETTINGS } from "@/types/voice";
import { v4 as uuidv4 } from "uuid";

const VOICE_EDITOR_SYSTEM_PROMPT = `You are a voice configuration assistant helping users define their writing style for social media content.

Your job is to interpret the user's natural language descriptions and suggest specific settings changes.

Current voice settings are provided in JSON format. When the user describes how they want their content to sound, analyze their request and suggest changes to these settings:

- optimization_authenticity (0-100): 0 = authentic/natural, 100 = optimized for engagement
- tone_formal_casual (0-100): 0 = formal/professional, 100 = casual/conversational
- energy_calm_punchy (0-100): 0 = calm/thoughtful, 100 = punchy/high-energy
- stance_neutral_opinionated (0-100): 0 = neutral/balanced, 100 = bold/opinionated
- length_mode: 'short' or 'medium'
- directness_mode: 'soft', 'neutral', or 'blunt'
- humor_mode: 'off' or 'light'
- emoji_mode: 'off' or 'on'
- question_rate: 'low' or 'medium'
- disagreement_mode: 'avoid' or 'allow_nuance'
- special_notes: free-form custom instructions for the AI

Respond with JSON in this exact format:
{
  "message": "Your conversational response explaining what you understood and changed",
  "suggestedChanges": { /* only include settings you want to change */ },
  "sampleContent": "A brief example (1-2 sentences) showing how content would sound with these settings"
}

Be conversational but concise. Focus on understanding what the user wants and translating it to specific settings.`;

// GET /api/voice/chat - Get chat history
export async function GET(request: NextRequest) {
  try {
    const supabase = await createAuthClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const voiceType = (searchParams.get("type") as VoiceType) || "reply";

    if (!["post", "reply"].includes(voiceType)) {
      return NextResponse.json({ error: "Invalid voice type" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("voice_editor_chat_history")
      .select("*")
      .eq("user_id", user.id)
      .eq("voice_type", voiceType)
      .single();

    if (error && error.code === "PGRST116") {
      // No history exists yet
      return NextResponse.json({ messages: [] });
    }

    if (error) throw error;

    return NextResponse.json({ messages: data.messages || [] });
  } catch (error) {
    console.error("Failed to fetch chat history:", error);
    return NextResponse.json(
      { error: "Failed to fetch chat history" },
      { status: 500 }
    );
  }
}

// POST /api/voice/chat - Process a chat message
export async function POST(request: NextRequest) {
  try {
    const supabase = await createAuthClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { voice_type, message } = await request.json();
    const voiceType = voice_type || "reply";

    if (!["post", "reply"].includes(voiceType)) {
      return NextResponse.json({ error: "Invalid voice_type" }, { status: 400 });
    }

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    // Get current voice settings
    let { data: settings } = await supabase
      .from("user_voice_settings")
      .select("*")
      .eq("user_id", user.id)
      .eq("voice_type", voiceType)
      .single();

    if (!settings) {
      settings = { ...DEFAULT_VOICE_SETTINGS, voice_type: voiceType };
    }

    // Get existing chat history
    const { data: chatData } = await supabase
      .from("voice_editor_chat_history")
      .select("messages")
      .eq("user_id", user.id)
      .eq("voice_type", voiceType)
      .single();

    const existingMessages: ChatMessage[] = chatData?.messages || [];

    // Build conversation history for context
    const conversationHistory = existingMessages.slice(-10).map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    }));

    // Create user message
    const userMessage: ChatMessage = {
      id: uuidv4(),
      role: "user",
      content: message,
      timestamp: new Date().toISOString(),
    };

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: VOICE_EDITOR_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Current settings:\n${JSON.stringify(settings, null, 2)}\n\nVoice type: ${voiceType}`
        },
        ...conversationHistory,
        { role: "user", content: message },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const responseText = completion.choices[0]?.message?.content || "{}";
    let parsed: { message?: string; suggestedChanges?: Partial<UserVoiceSettings>; sampleContent?: string };

    try {
      parsed = JSON.parse(responseText);
    } catch {
      parsed = { message: "I had trouble processing that. Could you rephrase?" };
    }

    // Create assistant message
    const assistantMessage: ChatMessage = {
      id: uuidv4(),
      role: "assistant",
      content: parsed.message || "I've updated your voice settings.",
      timestamp: new Date().toISOString(),
      suggestedChanges: parsed.suggestedChanges,
      sampleContent: parsed.sampleContent,
    };

    // Update chat history
    const updatedMessages = [...existingMessages, userMessage, assistantMessage];

    await supabase
      .from("voice_editor_chat_history")
      .upsert(
        {
          user_id: user.id,
          voice_type: voiceType,
          messages: updatedMessages,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,voice_type" }
      );

    return NextResponse.json({
      userMessage,
      assistantMessage,
      suggestedChanges: parsed.suggestedChanges || null,
    });
  } catch (error) {
    console.error("Failed to process chat message:", error);
    return NextResponse.json(
      { error: "Failed to process message" },
      { status: 500 }
    );
  }
}

// DELETE /api/voice/chat - Clear chat history
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createAuthClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const voiceType = (searchParams.get("type") as VoiceType) || "reply";

    if (!["post", "reply"].includes(voiceType)) {
      return NextResponse.json({ error: "Invalid voice type" }, { status: 400 });
    }

    await supabase
      .from("voice_editor_chat_history")
      .delete()
      .eq("user_id", user.id)
      .eq("voice_type", voiceType);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to clear chat history:", error);
    return NextResponse.json(
      { error: "Failed to clear chat history" },
      { status: 500 }
    );
  }
}
