/**
 * Input Analyzer - Classifies voice memo transcripts to determine
 * the best output format and framework to use.
 */

import { createChatCompletion, AIProvider } from "@/lib/ai";
import type { FrameworkType } from "./prompts/frameworks";

export type ContentDensity = "lean" | "rich";
export type Completeness = "complete" | "fragment" | "note";
export type IntentType =
  | "insight"
  | "build_update"
  | "tutorial"
  | "opinion"
  | "story";
export type SuggestedFormat = "X_POST" | "X_THREAD" | "FRAGMENT";

export interface AnalysisResult {
  contentDensity: ContentDensity;
  completeness: Completeness;
  intentType: IntentType;
  suggestedFormat: SuggestedFormat;
  suggestedFramework: FrameworkType;
  coreIdea: string;
  supportingPoints: string[];
  extractedDetails: {
    numbers?: string[];
    tools?: string[];
    timeframes?: string[];
    errors?: string[];
  };
  confidence: number;
  reasoning: string;
}

const ANALYZER_PROMPT = `You are an expert content analyst for a software developer's personal brand. Your job is to analyze voice memo transcripts and classify them for content generation.

Note: X posts can now be up to 25,000 characters, so a "lean" idea might still benefit from formatting and line breaks, while "rich" ideas can be explored in depth.

Analyze the input and determine:

1. **Content Density**: How much substance is there?
   - "lean": A single clear idea or insight (can still be expanded with context if valuable)
   - "rich": Multiple connected points, detailed enough to warrant a thread

2. **Completeness**: Is this a complete thought?
   - "complete": A fully formed idea ready to be turned into content
   - "fragment": A partial idea that needs more development
   - "note": A quick observation or reminder, not ready for posting

3. **Intent Type**: What kind of content is this?
   - "insight": An observation, realization, or "aha" moment
   - "build_update": Progress on a project, challenge faced, lesson learned
   - "tutorial": How to do something, steps, tips
   - "opinion": A take or perspective on a topic
   - "story": A narrative with beginning, middle, end

4. **Suggested Format**: What output format fits best?
   - "X_POST": Single post (one cohesive idea, even if expanded with detail)
   - "X_THREAD": Multi-post thread (distinct sequential points that build on each other)
   - "FRAGMENT": Not ready for posting, save for later

5. **Suggested Framework**: Which framework should be used?
   - "insight_drop": For observations and realizations
   - "build_update": For project progress and challenges
   - "tactical_guide": For how-tos and tips
   - "opinion": For takes and perspectives
   - "thread_deep_dive": For comprehensive breakdowns

6. **Core Idea**: The single most important point in 1-2 sentences

7. **Supporting Points**: 2-5 secondary points that support the core idea

8. **Extracted Details**: Pull out specific:
   - Numbers (metrics, percentages, counts)
   - Tools (software, frameworks, services mentioned)
   - Timeframes (how long things took)
   - Errors (problems, bugs, failures mentioned)

9. **Confidence**: 0-1 score of how confident you are in this classification

10. **Reasoning**: Brief explanation of why you classified it this way

Return valid JSON matching this exact structure:
{
  "contentDensity": "lean" | "rich",
  "completeness": "complete" | "fragment" | "note",
  "intentType": "insight" | "build_update" | "tutorial" | "opinion" | "story",
  "suggestedFormat": "X_POST" | "X_THREAD" | "FRAGMENT",
  "suggestedFramework": "insight_drop" | "build_update" | "tactical_guide" | "opinion" | "thread_deep_dive",
  "coreIdea": "string",
  "supportingPoints": ["string"],
  "extractedDetails": {
    "numbers": ["string"] | null,
    "tools": ["string"] | null,
    "timeframes": ["string"] | null,
    "errors": ["string"] | null
  },
  "confidence": number,
  "reasoning": "string"
}`;

export async function analyzeVoiceMemo(
  transcript: string,
  aiProvider: AIProvider = "openai"
): Promise<AnalysisResult> {
  const result = await createChatCompletion({
    provider: aiProvider,
    modelTier: "standard",
    messages: [
      { role: "system", content: ANALYZER_PROMPT },
      {
        role: "user",
        content: `Analyze this voice memo transcript:\n\n${transcript}`,
      },
    ],
    temperature: 0.3, // Lower temperature for more consistent classification
    jsonResponse: true,
  });

  const content = result.content;
  if (!content) {
    throw new Error("No analysis generated");
  }

  const analysisResult = JSON.parse(content) as AnalysisResult;

  // Validate the result has required fields
  if (!analysisResult.contentDensity || !analysisResult.suggestedFormat || !analysisResult.coreIdea) {
    throw new Error("Invalid analysis result: missing required fields");
  }

  return analysisResult;
}

/**
 * Quick check if content might relate to an existing draft
 * Returns keywords that could be used to search for related drafts
 */
export function extractSearchKeywords(analysis: AnalysisResult): string[] {
  const keywords: string[] = [];

  // Add tools mentioned
  if (analysis.extractedDetails.tools) {
    keywords.push(...analysis.extractedDetails.tools);
  }

  // Extract key nouns from core idea (simple approach)
  const coreWords = analysis.coreIdea
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 4)
    .slice(0, 5);
  keywords.push(...coreWords);

  return [...new Set(keywords)]; // Dedupe
}
