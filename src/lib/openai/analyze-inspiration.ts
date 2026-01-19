/**
 * Inspiration Post Analyzer
 * Extracts voice characteristics and format patterns from posts
 */

import { openai } from "./client";
import type {
  VoiceAnalysis,
  FormatAnalysis,
  InspirationAnalysisResult,
} from "@/types/inspiration";

const ANALYSIS_PROMPT = `You are an expert content analyst specializing in social media writing styles. Your job is to analyze X (Twitter) posts and extract the author's voice characteristics and formatting patterns.

Analyze the post and extract:

## VOICE ANALYSIS
1. **Tone**: 2-4 descriptors (e.g., "casual", "curious", "direct", "playful", "authoritative")
2. **Sentence Style**: How sentences are constructed (length, complexity, rhythm)
3. **Vocabulary**: Level and type of words used (technical, accessible, jargon-free, etc.)
4. **Perspective**: Point of view and framing (first person, observational, instructive, etc.)
5. **Patterns**: Notable writing habits (rhetorical questions, specific phrases, how ideas are introduced)
6. **Signature Phrases**: 2-3 example phrases that capture this voice (short excerpts from the post)

## FORMAT ANALYSIS
1. **Structure**: Overall organization (hook → body → close, list format, narrative, etc.)
2. **Length**: Character count of the post
3. **Line Break Usage**: How whitespace is used (heavy, minimal, between ideas, etc.)
4. **Paragraph Style**: How text is chunked (single sentences, short paragraphs, etc.)
5. **Uses Lists**: Whether bullet points or numbered lists appear
6. **Opening Style**: How the post starts (bold claim, question, observation, etc.)
7. **Closing Style**: How the post ends (CTA, question, implication, etc.)

Return valid JSON:
{
  "voice": {
    "tone": ["string", "string"],
    "sentenceStyle": "string",
    "vocabulary": "string",
    "perspective": "string",
    "patterns": ["string", "string"],
    "signaturePhrases": ["string", "string"]
  },
  "format": {
    "structure": "string",
    "length": number,
    "lineBreakUsage": "string",
    "paragraphStyle": "string",
    "usesLists": boolean,
    "openingStyle": "string",
    "closingStyle": "string"
  }
}`;

export async function analyzeInspirationPost(
  content: string
): Promise<InspirationAnalysisResult> {
  const response = await openai.chat.completions.create({
    model: "gpt-4-turbo-preview",
    messages: [
      { role: "system", content: ANALYSIS_PROMPT },
      {
        role: "user",
        content: `Analyze this X post for voice and format characteristics:\n\n${content}`,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
  });

  const result = response.choices[0]?.message?.content;
  if (!result) {
    throw new Error("No analysis generated");
  }

  const parsed = JSON.parse(result) as InspirationAnalysisResult;

  // Validate required fields
  if (!parsed.voice || !parsed.format) {
    throw new Error("Invalid analysis result: missing voice or format");
  }

  // Add length if not calculated
  if (!parsed.format.length) {
    parsed.format.length = content.length;
  }

  return parsed;
}

/**
 * Build a combined style prompt from multiple inspiration posts
 * Used when generating content with style references
 */
export function buildStylePrompt(
  inspirations: Array<{
    voice_analysis: VoiceAnalysis | null;
    format_analysis: FormatAnalysis | null;
  }>,
  applyAs: "voice_and_format" | "voice_only" | "format_only"
): string {
  const includeVoice = applyAs !== "format_only";
  const includeFormat = applyAs !== "voice_only";

  const sections: string[] = [];

  if (includeVoice) {
    const voiceTraits = inspirations
      .filter((i) => i.voice_analysis)
      .map((i) => i.voice_analysis!);

    if (voiceTraits.length > 0) {
      // Aggregate voice characteristics
      const allTones = [...new Set(voiceTraits.flatMap((v) => v.tone))];
      const perspectives = [...new Set(voiceTraits.map((v) => v.perspective))];
      const patterns = [...new Set(voiceTraits.flatMap((v) => v.patterns))];
      const phrases = voiceTraits.flatMap((v) => v.signaturePhrases).slice(0, 5);

      sections.push(`## VOICE STYLE TO EMULATE

Tone: ${allTones.join(", ")}
Perspective: ${perspectives.join(" / ")}
Sentence patterns: ${voiceTraits[0].sentenceStyle}
Vocabulary: ${voiceTraits[0].vocabulary}

Writing patterns to adopt:
${patterns.map((p) => `- ${p}`).join("\n")}

Example phrases that capture this voice:
${phrases.map((p) => `- "${p}"`).join("\n")}`);
    }
  }

  if (includeFormat) {
    const formatTraits = inspirations
      .filter((i) => i.format_analysis)
      .map((i) => i.format_analysis!);

    if (formatTraits.length > 0) {
      const avgLength = Math.round(
        formatTraits.reduce((sum, f) => sum + f.length, 0) / formatTraits.length
      );
      const structures = [...new Set(formatTraits.map((f) => f.structure))];
      const openings = [...new Set(formatTraits.map((f) => f.openingStyle))];
      const closings = [...new Set(formatTraits.map((f) => f.closingStyle))];

      sections.push(`## FORMAT STYLE TO EMULATE

Target length: ~${avgLength} characters
Structure: ${structures[0]}
Line breaks: ${formatTraits[0].lineBreakUsage}
Paragraph style: ${formatTraits[0].paragraphStyle}
Opening approach: ${openings.join(" or ")}
Closing approach: ${closings.join(" or ")}
Uses lists: ${formatTraits.some((f) => f.usesLists) ? "Yes, when appropriate" : "Rarely"}`);
    }
  }

  if (sections.length === 0) {
    return "";
  }

  return `---

# STYLE REFERENCE

The following style characteristics were extracted from inspiration posts.
Apply these to make the generated content match this voice and format.

${sections.join("\n\n")}

---`;
}
