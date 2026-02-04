/**
 * Content Generation Module
 *
 * This module provides two generation paths:
 * 1. Legacy: generateContent() - Simple generation for any source type
 * 2. Enhanced: generateFromVoiceMemo() - Smart pipeline with analysis + routing
 */

import { createChatCompletion, AIProvider } from "@/lib/ai";
import type { DraftType, SourceType } from "../db/schema";
import { analyzeVoiceMemo, type AnalysisResult } from "./analyzer";
import { routeToFramework, routeWithOverride } from "./router";
import type { FrameworkType } from "./prompts/frameworks";
import { getCopywritingEssentials } from "./prompts/knowledge-base";

// ============================================================================
// Types
// ============================================================================

export interface XPostContent {
  text: string;
}

export interface XThreadContent {
  tweets: string[];
}

export interface ReelScriptContent {
  hook: string;
  body: string;
  callToAction: string;
  estimatedDuration: string;
}

export type GeneratedContent =
  | XPostContent
  | XThreadContent
  | ReelScriptContent;

// Enhanced generation result includes analysis metadata
export interface EnhancedGenerationResult {
  content: XPostContent | XThreadContent;
  analysis: AnalysisResult;
  format: "X_POST" | "X_THREAD";
  frameworkUsed: FrameworkType;
}

// ============================================================================
// Legacy Generation (backward compatible)
// ============================================================================

// Get copywriting knowledge from knowledge base
const COPYWRITING_KNOWLEDGE = getCopywritingEssentials();

const LEGACY_BRAND_VOICE_PROMPT = `You are a content writer for a personal brand focused on software development, AI, and building in public.

${COPYWRITING_KNOWLEDGE}

VOICE PRINCIPLES:
- Write as a builder, not a marketer
- Be curious, practical, slightly opinionated
- Prefer concrete examples over abstract concepts
- Use short sentences over long explanations
- Use active voice at all times
- Write in a spartan and informative tone
- Address the reader directly using "you" and "your"

TONE CONSTRAINTS:
- No hype language
- No emojis unless explicitly requested
- No generic motivational fluff
- No metaphors or clichés
- No generalizations
- No rhetorical questions
- No warnings, notes, or meta commentary
- No setup phrases such as "in conclusion" or "in closing"
- No comparative constructions such as "not just this but also that"

FORMATTING CONSTRAINTS:
- No em dashes or en dashes
- No asterisks
- No semicolons
- No hashtags
- Use bullet point lists in social media posts
- Maintain smooth sentence flow

PROHIBITED WORDS (never use any of these, no exceptions):
can, may, just, that, very, really, literally, actually, certainly, probably, basically, could, maybe, delve, embark, enlightening, esteemed, shed light, draft, crafting, imagine, realm, game changer, unlock, discover, skyrocket, abyss, not alone, in a world where, revolutionize, disruptive, utilize, utilizing, dive deep, tapestry, illuminate, unveil, pivotal, intricate, elucidate, hence, furthermore, however, harness, exciting, groundbreaking, cutting edge, remarkable, it, remains to be seen, glimpse into, navigating, landscape, stark, testament, in summary, in conclusion, moreover, boost, skyrocketing, opened up, powerful, inquiries, ever evolving

CONTENT HEURISTICS:
- Prefer "what I learned" over "what you should do"
- If referencing tools, mention why they matter in practice
- If referencing news, always explain the impact`;

interface LegacyGenerateInput {
  sources: Array<{
    type: SourceType;
    content: string;
    metadata?: Record<string, unknown>;
  }>;
  draftType: DraftType;
  aiProvider?: AIProvider;
}

/**
 * Legacy generation function - maintains backward compatibility
 * Use generateFromVoiceMemo() for enhanced voice memo processing
 */
export async function generateContent(
  input: LegacyGenerateInput
): Promise<GeneratedContent> {
  const { sources, draftType, aiProvider = "openai" } = input;

  const sourceContext = sources
    .map((s, i) => `Source ${i + 1} (${s.type}):\n${s.content}`)
    .join("\n\n");

  let formatInstructions: string;

  switch (draftType) {
    case "X_POST":
      formatInstructions = `Generate a single X post. Length should match content depth (can be up to 25,000 chars).
Use line breaks for scannability. Every sentence must add value.
Return JSON: { "text": "your post here with \\n for line breaks" }`;
      break;
    case "X_THREAD":
      formatInstructions = `Generate a thread of 2-6 posts. Each post can be up to 25,000 chars.
Use line breaks within posts for scannability. Each post should deliver clear value.
Return JSON: { "tweets": ["post 1", "post 2", ...] }`;
      break;
    case "REEL_SCRIPT":
      formatInstructions = `Generate a 25-40 second Instagram Reel script.
Return JSON: {
  "hook": "attention-grabbing opening (3-5 seconds)",
  "body": "main content with clear points",
  "callToAction": "what viewers should do next",
  "estimatedDuration": "estimated duration in seconds"
}`;
      break;
  }

  const result = await createChatCompletion({
    provider: aiProvider,
    modelTier: "standard",
    messages: [
      { role: "system", content: LEGACY_BRAND_VOICE_PROMPT },
      {
        role: "user",
        content: `Based on the following source material, create content.

${sourceContext}

${formatInstructions}`,
      },
    ],
    temperature: 0.7,
    jsonResponse: true,
  });

  const content = result.content;
  if (!content) {
    throw new Error("No content generated");
  }

  return JSON.parse(content) as GeneratedContent;
}

// ============================================================================
// Enhanced Voice Memo Generation Pipeline
// ============================================================================

export interface VoiceMemoGenerateOptions {
  /** Override the auto-detected framework */
  overrideFramework?: FrameworkType;
  /** Override the auto-detected format (X_POST or X_THREAD) */
  overrideFormat?: "X_POST" | "X_THREAD";
  /** Skip analysis and use provided analysis result */
  precomputedAnalysis?: AnalysisResult;
  /** Style prompt built from inspiration posts */
  stylePrompt?: string;
  /** AI provider to use (openai or claude) */
  aiProvider?: AIProvider;
}

/**
 * Enhanced generation pipeline for voice memos.
 *
 * This function:
 * 1. Analyzes the transcript to understand content type and density
 * 2. Routes to the appropriate framework based on analysis
 * 3. Generates content using the selected framework + base principles
 *
 * @param transcript - The voice memo transcript text
 * @param options - Optional overrides for framework/format selection
 * @returns Generated content with analysis metadata
 */
export async function generateFromVoiceMemo(
  transcript: string,
  options: VoiceMemoGenerateOptions = {}
): Promise<EnhancedGenerationResult> {
  const aiProvider = options.aiProvider ?? "openai";

  // Step 1: Analyze the transcript (or use precomputed)
  const analysis =
    options.precomputedAnalysis ?? (await analyzeVoiceMemo(transcript, aiProvider));

  // Check if content is a fragment (not ready for posting)
  if (
    analysis.suggestedFormat === "FRAGMENT" &&
    !options.overrideFormat
  ) {
    throw new FragmentContentError(
      "Content classified as fragment - not ready for posting",
      analysis
    );
  }

  // Step 2: Route to the appropriate framework
  const routedPrompt = options.overrideFramework || options.overrideFormat
    ? routeWithOverride(
        transcript,
        analysis,
        options.overrideFramework,
        options.overrideFormat,
        options.stylePrompt
      )
    : routeToFramework(transcript, analysis, options.stylePrompt);

  // Step 3: Generate content
  const result = await createChatCompletion({
    provider: aiProvider,
    modelTier: "standard",
    messages: [
      { role: "system", content: routedPrompt.systemPrompt },
      { role: "user", content: routedPrompt.userPrompt },
    ],
    temperature: 0.7,
    jsonResponse: true,
  });

  const content = result.content;
  if (!content) {
    throw new Error("No content generated");
  }

  const generatedContent = JSON.parse(content) as
    | XPostContent
    | XThreadContent;

  return {
    content: generatedContent,
    analysis,
    format: routedPrompt.outputFormat,
    frameworkUsed: options.overrideFramework ?? analysis.suggestedFramework,
  };
}

/**
 * Analyze a voice memo without generating content.
 * Useful for previewing what the system would do before committing.
 */
export async function analyzeOnly(transcript: string, aiProvider: AIProvider = "openai"): Promise<AnalysisResult> {
  return analyzeVoiceMemo(transcript, aiProvider);
}

// ============================================================================
// Custom Errors
// ============================================================================

export class FragmentContentError extends Error {
  public analysis: AnalysisResult;

  constructor(message: string, analysis: AnalysisResult) {
    super(message);
    this.name = "FragmentContentError";
    this.analysis = analysis;
  }
}

// ============================================================================
// Re-exports for convenience
// ============================================================================

export type { AnalysisResult } from "./analyzer";
export type { FrameworkType } from "./prompts/frameworks";
export { extractSearchKeywords } from "./analyzer";
