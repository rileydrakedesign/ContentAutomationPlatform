import { NextRequest, NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";
import { openai } from "@/lib/openai/client";
import {
  ChatMessage,
  UserVoiceSettings,
  VoiceType,
  DEFAULT_VOICE_SETTINGS,
  ConversationStage,
  VoiceGuardrails,
} from "@/types/voice";
import { v4 as uuidv4 } from "uuid";

// Stage-specific system prompts
const PROPOSE_CHANGES_PROMPT = `You are a voice configuration assistant helping users define their writing style for social media content.

Your job is to interpret the user's natural language description and propose specific settings changes.

Current voice settings are provided in JSON format. When the user describes how they want their content to sound, analyze their request and propose changes to these settings:

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

DO NOT generate sample content yet. Only propose settings changes.

Respond with JSON in this exact format:
{
  "message": "Your conversational response explaining what you understood and what settings you're proposing to change",
  "pendingChanges": { /* only include settings you want to change */ },
  "stage": "review_changes",
  "requiresAction": "accept_changes"
}

Be conversational but concise. Focus on understanding what the user wants and translating it to specific settings.`;

const PROCESS_MODIFICATION_PROMPT = `You are a voice configuration assistant. The user wants to modify the previously proposed settings.

Interpret their feedback and return updated settings changes.

Available settings:
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
- special_notes: free-form custom instructions

Respond with JSON in this exact format:
{
  "message": "Your response acknowledging the changes and explaining the updated proposal",
  "pendingChanges": { /* the full updated settings to propose */ },
  "stage": "review_changes",
  "requiresAction": "accept_changes"
}`;

const COLLECT_GUARDRAILS_PROMPT = `The user has accepted the voice settings. Now ask them about guardrails - words or phrases they want to avoid in their content.

Respond with JSON in this exact format:
{
  "message": "Great! Now let's set up some guardrails. Are there any words or phrases you'd like me to avoid when writing in your voice? For example, corporate buzzwords like 'synergy' or 'leverage', or any other terms that don't fit your style.",
  "stage": "collect_guardrails",
  "requiresAction": "provide_guardrails"
}`;

const COLLECT_SAMPLE_INPUT_PROMPT_POST = `The user has set up their voice settings. Now ask them for a topic or outline to generate a sample post.

Respond with JSON in this exact format:
{
  "message": "Perfect! Now let's see your voice in action. Give me a topic or brief outline for a sample post, and I'll generate one using your new voice settings.",
  "stage": "collect_sample_input",
  "requiresAction": "provide_input"
}`;

const COLLECT_SAMPLE_INPUT_PROMPT_REPLY = `The user has set up their voice settings. Now ask them to provide a post they'd like to reply to.

Respond with JSON in this exact format:
{
  "message": "Perfect! Now let's see your voice in action. Paste a post you'd like to generate a sample reply to, and I'll write one using your new voice settings.",
  "stage": "collect_sample_input",
  "requiresAction": "provide_input"
}`;

const GENERATE_SAMPLE_POST_PROMPT = `You are generating a sample social media post using the user's voice settings.

Voice settings are provided in JSON format. Generate a post that matches the settings:
- Use the tone_formal_casual dial (0=formal, 100=casual)
- Match the energy_calm_punchy level (0=calm, 100=punchy)
- Apply the stance_neutral_opinionated setting (0=neutral, 100=opinionated)
- Follow length_mode (short = ~50 words, medium = ~100 words)
- Apply humor_mode if set to 'light'
- Use emojis only if emoji_mode is 'on'
- Avoid any words listed in the guardrails

## STRICT WRITING RULES (apply to all generated content, no exceptions)

ALWAYS:
- Use clear and simple language
- Write in a spartan and informative tone
- Favor short and impactful sentences
- Use active voice at all times
- Focus on practical and actionable insights
- Support claims using data or concrete examples when available
- Address the reader directly using "you" and "your"
- Use bullet point lists in social media posts
- Maintain smooth sentence flow

NEVER USE THESE FORMATTING ELEMENTS:
- Em dashes or en dashes
- Asterisks
- Semicolons
- Metaphors or clichés
- Generalizations
- Rhetorical questions
- Hashtags
- Warnings, notes, or meta commentary
- Setup phrases such as "in conclusion" or "in closing"
- Comparative constructions such as "not just this but also that"

PROHIBITED WORDS (never use any of these):
can, may, just, that, very, really, literally, actually, certainly, probably, basically, could, maybe, delve, embark, enlightening, esteemed, shed light, draft, crafting, imagine, realm, game changer, unlock, discover, skyrocket, abyss, not alone, in a world where, revolutionize, disruptive, utilize, utilizing, dive deep, tapestry, illuminate, unveil, pivotal, intricate, elucidate, hence, furthermore, however, harness, exciting, groundbreaking, cutting edge, remarkable, it, remains to be seen, glimpse into, navigating, landscape, stark, testament, in summary, in conclusion, moreover, boost, skyrocketing, opened up, powerful, inquiries, ever evolving

Generate a post on the topic/outline the user provided.

Respond with JSON in this exact format:
{
  "message": "Here's a sample post using your voice settings. What do you think? Let me know if you'd like any changes.",
  "sampleContent": "The actual post content goes here",
  "stage": "review_sample",
  "requiresAction": "provide_feedback"
}`;

const GENERATE_SAMPLE_REPLY_PROMPT = `You are generating a sample social media reply using the user's voice settings.

Voice settings are provided in JSON format. Generate a reply that matches the settings:
- Use the tone_formal_casual dial (0=formal, 100=casual)
- Match the energy_calm_punchy level (0=calm, 100=punchy)
- Apply the stance_neutral_opinionated setting (0=neutral, 100=opinionated)
- Follow length_mode (short = ~30 words, medium = ~60 words)
- Apply humor_mode if set to 'light'
- Use emojis only if emoji_mode is 'on'
- Avoid any words listed in the guardrails

## STRICT WRITING RULES (apply to all generated content, no exceptions)

ALWAYS:
- Use clear and simple language
- Write in a spartan and informative tone
- Favor short and impactful sentences
- Use active voice at all times
- Focus on practical and actionable insights
- Support claims using data or concrete examples when available
- Address the reader directly using "you" and "your"
- Maintain smooth sentence flow

NEVER USE THESE FORMATTING ELEMENTS:
- Em dashes or en dashes
- Asterisks
- Semicolons
- Metaphors or clichés
- Generalizations
- Rhetorical questions
- Hashtags
- Warnings, notes, or meta commentary
- Setup phrases such as "in conclusion" or "in closing"
- Comparative constructions such as "not just this but also that"

PROHIBITED WORDS (never use any of these):
can, may, just, that, very, really, literally, actually, certainly, probably, basically, could, maybe, delve, embark, enlightening, esteemed, shed light, draft, crafting, imagine, realm, game changer, unlock, discover, skyrocket, abyss, not alone, in a world where, revolutionize, disruptive, utilize, utilizing, dive deep, tapestry, illuminate, unveil, pivotal, intricate, elucidate, hence, furthermore, however, harness, exciting, groundbreaking, cutting edge, remarkable, it, remains to be seen, glimpse into, navigating, landscape, stark, testament, in summary, in conclusion, moreover, boost, skyrocketing, opened up, powerful, inquiries, ever evolving

Generate a reply to the post the user provided.

Respond with JSON in this exact format:
{
  "message": "Here's a sample reply using your voice settings. What do you think? Let me know if you'd like any changes.",
  "sampleContent": "The actual reply content goes here",
  "stage": "review_sample",
  "requiresAction": "provide_feedback"
}`;

const PROCESS_FEEDBACK_PROMPT = `You are processing feedback on a sample post/reply and adjusting the voice settings accordingly.

The user wants changes to the generated sample. Interpret their feedback to:
1. Understand what they want to change
2. Update the relevant voice settings to achieve that
3. Generate a new sample with the updated settings

Available settings to adjust:
- optimization_authenticity (0-100)
- tone_formal_casual (0-100)
- energy_calm_punchy (0-100)
- stance_neutral_opinionated (0-100)
- length_mode: 'short' or 'medium'
- directness_mode: 'soft', 'neutral', or 'blunt'
- humor_mode: 'off' or 'light'
- emoji_mode: 'off' or 'on'
- question_rate: 'low' or 'medium'
- disagreement_mode: 'avoid' or 'allow_nuance'
- special_notes: free-form instructions

Respond with JSON in this exact format:
{
  "message": "Your response explaining what you changed and why",
  "sampleContent": "The new sample content with adjustments",
  "settingsUpdates": { /* only include settings you changed */ },
  "stage": "review_sample",
  "requiresAction": "provide_feedback"
}`;

// Helper function to get current stage from messages
function getCurrentStage(messages: ChatMessage[]): ConversationStage {
  const lastAssistant = messages.filter((m) => m.role === "assistant").pop();
  return lastAssistant?.stage || "initial";
}

// Helper function to get pending changes from last assistant message
function getPendingChanges(
  messages: ChatMessage[]
): Partial<UserVoiceSettings> | undefined {
  const lastAssistant = messages.filter((m) => m.role === "assistant").pop();
  return lastAssistant?.pendingChanges;
}

// Helper function to get sample input from conversation
function getSampleInput(messages: ChatMessage[]): string | undefined {
  // Look for the user message right after collect_sample_input stage
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === "assistant" && msg.stage === "collect_sample_input") {
      // The next user message after this is the sample input
      const nextUserMsg = messages
        .slice(i + 1)
        .find((m) => m.role === "user");
      return nextUserMsg?.content;
    }
  }
  return undefined;
}

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

    const body = await request.json();
    const { voice_type, message, action, actionData } = body;
    const voiceType: VoiceType = voice_type || "reply";

    if (!["post", "reply"].includes(voiceType)) {
      return NextResponse.json({ error: "Invalid voice_type" }, { status: 400 });
    }

    // Get current voice settings
    let { data: settings } = await supabase
      .from("user_voice_settings")
      .select("*")
      .eq("user_id", user.id)
      .eq("voice_type", voiceType)
      .single();

    if (!settings) {
      settings = {
        ...DEFAULT_VOICE_SETTINGS,
        voice_type: voiceType,
        guardrails: { avoid_words: [], avoid_topics: [], custom_rules: [] },
      };
    }

    // Get existing chat history
    const { data: chatData } = await supabase
      .from("voice_editor_chat_history")
      .select("messages")
      .eq("user_id", user.id)
      .eq("voice_type", voiceType)
      .single();

    const existingMessages: ChatMessage[] = chatData?.messages || [];
    const currentStage = getCurrentStage(existingMessages);

    // Handle special actions
    if (action === "accept_changes") {
      return handleAcceptChanges(
        supabase,
        user.id,
        voiceType,
        existingMessages,
        settings
      );
    }

    if (action === "skip_guardrails") {
      return handleSkipGuardrails(
        supabase,
        user.id,
        voiceType,
        existingMessages,
        settings
      );
    }

    if (action === "submit_guardrails") {
      return handleSubmitGuardrails(
        supabase,
        user.id,
        voiceType,
        existingMessages,
        settings,
        actionData?.words || []
      );
    }

    if (action === "submit_sample_input") {
      return handleSubmitSampleInput(
        supabase,
        user.id,
        voiceType,
        existingMessages,
        settings,
        actionData?.input || ""
      );
    }

    // Regular message handling
    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    // Create user message
    const userMessage: ChatMessage = {
      id: uuidv4(),
      role: "user",
      content: message,
      timestamp: new Date().toISOString(),
    };

    // Route to appropriate handler based on current stage
    let response;
    switch (currentStage) {
      case "initial":
        response = await handleVoiceDescription(
          message,
          settings,
          existingMessages
        );
        break;

      case "review_changes":
        response = await handleChangesModification(
          message,
          settings,
          existingMessages
        );
        break;

      case "review_sample":
        response = await handleSampleFeedback(
          message,
          settings,
          existingMessages,
          voiceType
        );
        break;

      default:
        response = await handleVoiceDescription(
          message,
          settings,
          existingMessages
        );
    }

    // Create assistant message
    const assistantMessage: ChatMessage = {
      id: uuidv4(),
      role: "assistant",
      content: response.message || "I've processed your request.",
      timestamp: new Date().toISOString(),
      stage: response.stage,
      pendingChanges: response.pendingChanges,
      sampleContent: response.sampleContent,
      requiresAction: response.requiresAction,
    };

    // Update chat history
    const updatedMessages = [...existingMessages, userMessage, assistantMessage];

    await supabase.from("voice_editor_chat_history").upsert(
      {
        user_id: user.id,
        voice_type: voiceType,
        messages: updatedMessages,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,voice_type" }
    );

    // If there are settings updates from feedback, apply them
    if (response.settingsUpdates) {
      await supabase
        .from("user_voice_settings")
        .update({
          ...response.settingsUpdates,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id)
        .eq("voice_type", voiceType);
    }

    return NextResponse.json({
      userMessage,
      assistantMessage,
      settingsUpdates: response.settingsUpdates || null,
    });
  } catch (error) {
    console.error("Failed to process chat message:", error);
    return NextResponse.json(
      { error: "Failed to process message" },
      { status: 500 }
    );
  }
}

// Handle initial voice description
async function handleVoiceDescription(
  message: string,
  settings: UserVoiceSettings,
  existingMessages: ChatMessage[]
) {
  const conversationHistory = existingMessages.slice(-6).map((msg) => ({
    role: msg.role as "user" | "assistant",
    content: msg.content,
  }));

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: PROPOSE_CHANGES_PROMPT },
      {
        role: "user",
        content: `Current settings:\n${JSON.stringify(settings, null, 2)}`,
      },
      ...conversationHistory,
      { role: "user", content: message },
    ],
    response_format: { type: "json_object" },
    temperature: 0.7,
  });

  const responseText = completion.choices[0]?.message?.content || "{}";
  try {
    return JSON.parse(responseText);
  } catch {
    return {
      message: "I had trouble processing that. Could you rephrase?",
      stage: "initial",
    };
  }
}

// Handle modification requests during review_changes stage
async function handleChangesModification(
  message: string,
  settings: UserVoiceSettings,
  existingMessages: ChatMessage[]
) {
  const pendingChanges = getPendingChanges(existingMessages);
  const conversationHistory = existingMessages.slice(-6).map((msg) => ({
    role: msg.role as "user" | "assistant",
    content: msg.content,
  }));

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: PROCESS_MODIFICATION_PROMPT },
      {
        role: "user",
        content: `Current settings:\n${JSON.stringify(settings, null, 2)}\n\nPreviously proposed changes:\n${JSON.stringify(pendingChanges, null, 2)}`,
      },
      ...conversationHistory,
      { role: "user", content: message },
    ],
    response_format: { type: "json_object" },
    temperature: 0.7,
  });

  const responseText = completion.choices[0]?.message?.content || "{}";
  try {
    return JSON.parse(responseText);
  } catch {
    return {
      message: "I had trouble processing that. Could you rephrase?",
      stage: "review_changes",
      requiresAction: "accept_changes",
      pendingChanges,
    };
  }
}

// Handle accept changes action
async function handleAcceptChanges(
  supabase: Awaited<ReturnType<typeof createAuthClient>>,
  userId: string,
  voiceType: VoiceType,
  existingMessages: ChatMessage[],
  settings: UserVoiceSettings
) {
  const pendingChanges = getPendingChanges(existingMessages);

  if (!pendingChanges) {
    return NextResponse.json(
      { error: "No pending changes to accept" },
      { status: 400 }
    );
  }

  // Apply the changes to settings
  const { user_id: _uid, voice_type: _vt, ...restSettings } = settings;
  await supabase
    .from("user_voice_settings")
    .upsert(
      {
        user_id: userId,
        voice_type: voiceType,
        ...restSettings,
        ...pendingChanges,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,voice_type" }
    );

  // Create the transition message to guardrails stage
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: COLLECT_GUARDRAILS_PROMPT },
      { role: "user", content: "User accepted the proposed changes." },
    ],
    response_format: { type: "json_object" },
    temperature: 0.7,
  });

  const responseText = completion.choices[0]?.message?.content || "{}";
  let parsed;
  try {
    parsed = JSON.parse(responseText);
  } catch {
    parsed = {
      message:
        "Great! Now let's set up some guardrails. Are there any words or phrases you'd like me to avoid?",
      stage: "collect_guardrails",
      requiresAction: "provide_guardrails",
    };
  }

  const assistantMessage: ChatMessage = {
    id: uuidv4(),
    role: "assistant",
    content: parsed.message,
    timestamp: new Date().toISOString(),
    stage: "collect_guardrails",
    requiresAction: "provide_guardrails",
  };

  const updatedMessages = [...existingMessages, assistantMessage];

  await supabase.from("voice_editor_chat_history").upsert(
    {
      user_id: userId,
      voice_type: voiceType,
      messages: updatedMessages,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,voice_type" }
  );

  return NextResponse.json({
    assistantMessage,
    settingsUpdates: pendingChanges,
  });
}

// Handle skip guardrails action
async function handleSkipGuardrails(
  supabase: Awaited<ReturnType<typeof createAuthClient>>,
  userId: string,
  voiceType: VoiceType,
  existingMessages: ChatMessage[],
  settings: UserVoiceSettings
) {
  return handleGuardrailsComplete(
    supabase,
    userId,
    voiceType,
    existingMessages,
    settings,
    []
  );
}

// Handle submit guardrails action
async function handleSubmitGuardrails(
  supabase: Awaited<ReturnType<typeof createAuthClient>>,
  userId: string,
  voiceType: VoiceType,
  existingMessages: ChatMessage[],
  settings: UserVoiceSettings,
  words: string[]
) {
  // Save guardrails to settings
  if (words.length > 0) {
    const currentGuardrails: VoiceGuardrails = settings.guardrails || {
      avoid_words: [],
      avoid_topics: [],
      custom_rules: [],
    };

    await supabase
      .from("user_voice_settings")
      .update({
        guardrails: {
          ...currentGuardrails,
          avoid_words: [...new Set([...currentGuardrails.avoid_words, ...words])],
        },
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("voice_type", voiceType);
  }

  return handleGuardrailsComplete(
    supabase,
    userId,
    voiceType,
    existingMessages,
    settings,
    words
  );
}

// Common handler after guardrails step
async function handleGuardrailsComplete(
  supabase: Awaited<ReturnType<typeof createAuthClient>>,
  userId: string,
  voiceType: VoiceType,
  existingMessages: ChatMessage[],
  settings: UserVoiceSettings,
  words: string[]
) {
  const prompt =
    voiceType === "post"
      ? COLLECT_SAMPLE_INPUT_PROMPT_POST
      : COLLECT_SAMPLE_INPUT_PROMPT_REPLY;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: prompt },
      {
        role: "user",
        content:
          words.length > 0
            ? `User added these words to avoid: ${words.join(", ")}`
            : "User skipped adding guardrails.",
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.7,
  });

  const responseText = completion.choices[0]?.message?.content || "{}";
  let parsed;
  try {
    parsed = JSON.parse(responseText);
  } catch {
    parsed = {
      message:
        voiceType === "post"
          ? "Perfect! Give me a topic or outline for a sample post."
          : "Perfect! Paste a post you'd like to reply to.",
      stage: "collect_sample_input",
      requiresAction: "provide_input",
    };
  }

  const assistantMessage: ChatMessage = {
    id: uuidv4(),
    role: "assistant",
    content: parsed.message,
    timestamp: new Date().toISOString(),
    stage: "collect_sample_input",
    requiresAction: "provide_input",
  };

  const updatedMessages = [...existingMessages, assistantMessage];

  await supabase.from("voice_editor_chat_history").upsert(
    {
      user_id: userId,
      voice_type: voiceType,
      messages: updatedMessages,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,voice_type" }
  );

  return NextResponse.json({
    assistantMessage,
    guardrailsAdded: words,
  });
}

// Handle submit sample input action
async function handleSubmitSampleInput(
  supabase: Awaited<ReturnType<typeof createAuthClient>>,
  userId: string,
  voiceType: VoiceType,
  existingMessages: ChatMessage[],
  settings: UserVoiceSettings,
  input: string
) {
  const prompt =
    voiceType === "post"
      ? GENERATE_SAMPLE_POST_PROMPT
      : GENERATE_SAMPLE_REPLY_PROMPT;

  // Create user message for the input
  const userMessage: ChatMessage = {
    id: uuidv4(),
    role: "user",
    content: input,
    timestamp: new Date().toISOString(),
    sampleInput: input,
  };

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: prompt },
      {
        role: "user",
        content: `Voice settings:\n${JSON.stringify(settings, null, 2)}\n\n${voiceType === "post" ? "Topic/outline" : "Post to reply to"}:\n${input}`,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.8,
  });

  const responseText = completion.choices[0]?.message?.content || "{}";
  let parsed;
  try {
    parsed = JSON.parse(responseText);
  } catch {
    parsed = {
      message: "I had trouble generating a sample. Please try again.",
      stage: "collect_sample_input",
      requiresAction: "provide_input",
    };
  }

  const assistantMessage: ChatMessage = {
    id: uuidv4(),
    role: "assistant",
    content: parsed.message,
    timestamp: new Date().toISOString(),
    stage: parsed.stage || "review_sample",
    sampleContent: parsed.sampleContent,
    sampleInput: input,
    requiresAction: parsed.requiresAction || "provide_feedback",
  };

  const updatedMessages = [...existingMessages, userMessage, assistantMessage];

  await supabase.from("voice_editor_chat_history").upsert(
    {
      user_id: userId,
      voice_type: voiceType,
      messages: updatedMessages,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,voice_type" }
  );

  return NextResponse.json({
    userMessage,
    assistantMessage,
  });
}

// Handle feedback on sample content
async function handleSampleFeedback(
  message: string,
  settings: UserVoiceSettings,
  existingMessages: ChatMessage[],
  voiceType: VoiceType
) {
  const sampleInput = getSampleInput(existingMessages);
  const lastSample = existingMessages
    .filter((m) => m.role === "assistant" && m.sampleContent)
    .pop();

  const conversationHistory = existingMessages.slice(-8).map((msg) => ({
    role: msg.role as "user" | "assistant",
    content:
      msg.sampleContent
        ? `${msg.content}\n\nSample ${voiceType}: "${msg.sampleContent}"`
        : msg.content,
  }));

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: PROCESS_FEEDBACK_PROMPT },
      {
        role: "user",
        content: `Current voice settings:\n${JSON.stringify(settings, null, 2)}\n\nVoice type: ${voiceType}\n\nOriginal ${voiceType === "post" ? "topic" : "post to reply to"}:\n${sampleInput || "N/A"}\n\nPrevious sample:\n${lastSample?.sampleContent || "N/A"}`,
      },
      ...conversationHistory,
      { role: "user", content: message },
    ],
    response_format: { type: "json_object" },
    temperature: 0.8,
  });

  const responseText = completion.choices[0]?.message?.content || "{}";
  try {
    return JSON.parse(responseText);
  } catch {
    return {
      message: "I had trouble processing that feedback. Could you rephrase?",
      stage: "review_sample",
      requiresAction: "provide_feedback",
    };
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
