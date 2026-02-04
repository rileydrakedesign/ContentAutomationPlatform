/**
 * Router - Builds the complete generation prompt based on analysis results.
 * Combines base principles + source instructions + selected framework.
 */

import { BASE_PRINCIPLES_PROMPT } from "./prompts/base-principles";
import { VOICE_MEMO_INSTRUCTIONS } from "./prompts/voice-memo-instructions";
import { getFramework, type FrameworkType } from "./prompts/frameworks";
import type { AnalysisResult } from "./analyzer";

export interface RoutedPrompt {
  systemPrompt: string;
  userPrompt: string;
  outputFormat: "X_POST" | "X_THREAD";
}

/**
 * Build the complete system prompt by combining:
 * 1. Base principles (always applied)
 * 2. Source-specific instructions (voice memo handling)
 * 3. Selected framework (based on analysis)
 * 4. Optional style reference (from inspiration posts)
 */
function buildSystemPrompt(framework: FrameworkType, stylePrompt?: string): string {
  const frameworkPrompt = getFramework(framework);

  let prompt = `${BASE_PRINCIPLES_PROMPT}

---

${VOICE_MEMO_INSTRUCTIONS}

---

${frameworkPrompt}`;

  // Add style reference if provided
  if (stylePrompt) {
    prompt += `\n\n${stylePrompt}`;
  }

  return prompt;
}

/**
 * Build the user prompt with the transcript and analysis context
 */
function buildUserPrompt(
  transcript: string,
  analysis: AnalysisResult,
  outputFormat: "X_POST" | "X_THREAD"
): string {
  const detailsSection = formatExtractedDetails(analysis.extractedDetails);

  const formatInstructions =
    outputFormat === "X_POST"
      ? `Generate a single X post. You have up to 25,000 characters but length should match content depth.

Guidelines:
- Short insight? Keep it tight (1-5 lines)
- Rich idea? Expand with scannable structure (use line breaks liberally)
- Every sentence must earn its place
- Use whitespace and line breaks for scannability
- Front-load the insight, don't bury it

Return JSON: { "text": "your post here with \\n for line breaks" }`
      : `Generate a thread of ${analysis.contentDensity === "rich" ? "3-6" : "2-4"} posts. Each post can be up to 25,000 characters.

Guidelines:
- First post: Hook with the core insight, make them want to read more
- Middle posts: Deliver value with scannable structure
- Final post: Strong takeaway or invite discussion
- Each post should work standalone but flow as a narrative
- Use line breaks within posts for scannability

Return JSON: { "tweets": ["post 1", "post 2", ...] }`;

  return `## INPUT: Voice Memo Transcript

${transcript}

---

## ANALYSIS CONTEXT

**Core Idea:** ${analysis.coreIdea}

**Supporting Points:**
${analysis.supportingPoints.map((p) => `- ${p}`).join("\n")}

${detailsSection}

---

## OUTPUT REQUIREMENTS

${formatInstructions}

Remember:
- Use the ${analysis.suggestedFramework.replace("_", " ")} framework structure
- Signal over noise: every sentence must add value
- Preserve the natural voice from the transcript
- Surface specific details (numbers, tools, timeframes)
- Format for scannability (line breaks, short paragraphs)
- Use active voice at all times
- Write in a spartan and informative tone
- Address the reader directly using "you" and "your"
- Maintain smooth sentence flow. No abrupt stop-start patterns
- No em dashes, no en dashes, no asterisks, no semicolons
- No AI phrases, no hashtags, no filler
- No metaphors, no clichés, no generalizations
- No rhetorical questions
- No warnings, notes, or meta commentary
- No setup phrases (in conclusion, in closing)
- No comparative constructions (not just X but also Y)
- NO MARKDOWN: no **bold**, no *italics*, no numbered lists (1. 2. 3.)
- Plain text only - X does not render markdown
- Sound human, not polished
- PROHIBITED WORDS: can, may, just, that, very, really, literally, actually, certainly, probably, basically, could, maybe, delve, embark, shed light, crafting, imagine, realm, game changer, unlock, discover, skyrocket, revolutionize, disruptive, utilize, dive deep, unveil, pivotal, intricate, hence, furthermore, however, harness, exciting, groundbreaking, cutting edge, remarkable, it, remains to be seen, navigating, landscape, testament, moreover, boost, powerful, ever evolving`;
}

/**
 * Format extracted details for the prompt
 */
function formatExtractedDetails(
  details: AnalysisResult["extractedDetails"]
): string {
  const sections: string[] = [];

  if (details.numbers?.length) {
    sections.push(`**Numbers to include:** ${details.numbers.join(", ")}`);
  }
  if (details.tools?.length) {
    sections.push(`**Tools mentioned:** ${details.tools.join(", ")}`);
  }
  if (details.timeframes?.length) {
    sections.push(`**Timeframes:** ${details.timeframes.join(", ")}`);
  }
  if (details.errors?.length) {
    sections.push(`**Challenges/Errors:** ${details.errors.join(", ")}`);
  }

  return sections.length > 0
    ? `**Extracted Details:**\n${sections.join("\n")}`
    : "";
}

/**
 * Main routing function - takes analysis and returns complete prompt config
 */
export function routeToFramework(
  transcript: string,
  analysis: AnalysisResult,
  stylePrompt?: string
): RoutedPrompt {
  // Determine output format
  // FRAGMENT should not reach here, but default to X_POST if it does
  const outputFormat: "X_POST" | "X_THREAD" =
    analysis.suggestedFormat === "X_THREAD" ? "X_THREAD" : "X_POST";

  // Build the prompts
  const systemPrompt = buildSystemPrompt(analysis.suggestedFramework, stylePrompt);
  const userPrompt = buildUserPrompt(transcript, analysis, outputFormat);

  return {
    systemPrompt,
    userPrompt,
    outputFormat,
  };
}

/**
 * Override routing for manual framework selection
 */
export function routeWithOverride(
  transcript: string,
  analysis: AnalysisResult,
  overrideFramework?: FrameworkType,
  overrideFormat?: "X_POST" | "X_THREAD",
  stylePrompt?: string
): RoutedPrompt {
  const effectiveAnalysis = {
    ...analysis,
    suggestedFramework: overrideFramework ?? analysis.suggestedFramework,
    suggestedFormat: overrideFormat ?? analysis.suggestedFormat,
  };

  return routeToFramework(transcript, effectiveAnalysis, stylePrompt);
}
