/**
 * Transcript Preprocessor - Analyzes voice memo transcripts to detect
 * multiple ideas, series outlines, or idea dumps before generation.
 *
 * This step runs BEFORE the analyzer to segment complex transcripts
 * into processable chunks.
 */

import { getOpenAI } from "./client";

/**
 * Types of transcript structures we can detect
 */
export type TranscriptStructure =
  | "single_idea" // One clear topic - proceed directly to generation
  | "multi_post_series" // Planned content calendar - each segment = separate draft
  | "thread_outline" // Connected ideas intended as one thread
  | "idea_dump"; // Unrelated/semi-related ideas mixed together

/**
 * A segment extracted from the transcript
 */
export interface TranscriptSegment {
  id: string; // Unique identifier for UI
  title: string; // Short title describing this segment
  content: string; // The actual transcript content for this segment
  suggestedType: "X_POST" | "X_THREAD" | "REEL_SCRIPT" | "NOTE";
  relationship: "standalone" | "part_of_series" | "part_of_thread";
  estimatedDepth: "shallow" | "medium" | "deep"; // How much content is here
  keyTopics: string[]; // Main topics/keywords
  order: number; // Original order in transcript
}

/**
 * Result of preprocessing a transcript
 */
export interface PreprocessResult {
  structure: TranscriptStructure;
  segments: TranscriptSegment[];
  originalTranscript: string;
  summary: string; // Brief summary of what was detected
  recommendations: {
    message: string;
    suggestedAction:
      | "generate_all_separately"
      | "generate_as_thread"
      | "select_and_generate"
      | "proceed_directly";
  };
}

const PREPROCESSOR_PROMPT = `You are a content strategist analyzing voice memo transcripts for a software developer's personal brand.

Your job is to analyze the transcript structure and identify if it contains:
1. A single, focused idea (proceed directly to content generation)
2. Multiple related ideas that should be a thread (connected narrative)
3. Multiple distinct ideas for separate posts (content calendar/series)
4. An idea dump of unrelated thoughts (needs segmentation)

Analyze the transcript and:
1. Determine the overall structure
2. If multiple ideas exist, segment them clearly
3. For each segment, identify:
   - A short descriptive title
   - The exact content from the transcript (preserve the speaker's words)
   - Whether it's standalone or part of a larger piece
   - How deep/developed the idea is
   - Key topics mentioned

Important segmentation rules:
- Preserve the speaker's original words in each segment
- Don't summarize - extract the actual transcript portions
- Look for topic shifts, pauses, or explicit transitions ("another thing...", "also...")
- A segment should have ONE core idea
- Segments can be as short as a sentence or as long as several paragraphs

Return valid JSON matching this structure:
{
  "structure": "single_idea" | "multi_post_series" | "thread_outline" | "idea_dump",
  "segments": [
    {
      "id": "seg_1",
      "title": "Short descriptive title",
      "content": "Exact transcript content for this segment...",
      "suggestedType": "X_POST" | "X_THREAD" | "REEL_SCRIPT" | "NOTE",
      "relationship": "standalone" | "part_of_series" | "part_of_thread",
      "estimatedDepth": "shallow" | "medium" | "deep",
      "keyTopics": ["topic1", "topic2"],
      "order": 1
    }
  ],
  "summary": "Brief description of what was detected",
  "recommendations": {
    "message": "Human-readable recommendation for the user",
    "suggestedAction": "generate_all_separately" | "generate_as_thread" | "select_and_generate" | "proceed_directly"
  }
}

Guidelines for structure classification:
- "single_idea": One topic throughout, no major shifts. Segments array will have 1 item.
- "thread_outline": 2-6 connected points building on each other, speaker seems to be outlining a thread.
- "multi_post_series": 2+ distinct topics that could each be separate posts (speaker planning content).
- "idea_dump": 3+ loosely related or unrelated thoughts dumped together.

Guidelines for suggestedType:
- "X_POST": Most segments - single idea that can be a post
- "X_THREAD": Segment is already complex enough to need multiple posts
- "REEL_SCRIPT": Speaker mentions video/visual content or story-driven narrative
- "NOTE": Fragment, reminder, or underdeveloped thought - save for later

Guidelines for estimatedDepth:
- "shallow": Quick thought, 1-2 sentences of substance
- "medium": Developed idea with context, could be a solid post
- "deep": Rich content with examples/details, could be expanded significantly`;

/**
 * Preprocess a transcript to detect structure and segment if needed
 */
export async function preprocessTranscript(
  transcript: string
): Promise<PreprocessResult> {
  // Skip preprocessing for very short transcripts
  if (transcript.length < 200) {
    return createSingleIdeaResult(transcript);
  }

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4-turbo-preview",
    messages: [
      { role: "system", content: PREPROCESSOR_PROMPT },
      {
        role: "user",
        content: `Analyze this voice memo transcript and segment if needed:\n\n${transcript}`,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No preprocessing result generated");
  }

  const result = JSON.parse(content);

  // Validate and return
  return {
    structure: result.structure,
    segments: result.segments || [],
    originalTranscript: transcript,
    summary: result.summary || "",
    recommendations: result.recommendations || {
      message: "Review the segments and select which to generate",
      suggestedAction: "select_and_generate",
    },
  };
}

/**
 * Helper to create a single-idea result for short transcripts
 */
function createSingleIdeaResult(transcript: string): PreprocessResult {
  return {
    structure: "single_idea",
    segments: [
      {
        id: "seg_1",
        title: "Main Idea",
        content: transcript,
        suggestedType: "X_POST",
        relationship: "standalone",
        estimatedDepth: "medium",
        keyTopics: [],
        order: 1,
      },
    ],
    originalTranscript: transcript,
    summary: "Single focused idea detected",
    recommendations: {
      message: "This transcript contains a single idea. Proceed to generation.",
      suggestedAction: "proceed_directly",
    },
  };
}

/**
 * Combine multiple segments into a single transcript for thread generation
 */
export function combineSegmentsForThread(segments: TranscriptSegment[]): string {
  return segments
    .sort((a, b) => a.order - b.order)
    .map((s) => s.content)
    .join("\n\n---\n\n");
}

/**
 * Get segments that are recommended for standalone posts
 */
export function getStandaloneSegments(
  result: PreprocessResult
): TranscriptSegment[] {
  return result.segments.filter(
    (s) =>
      s.relationship === "standalone" ||
      s.relationship === "part_of_series"
  );
}

/**
 * Get segments that are part of a thread outline
 */
export function getThreadSegments(
  result: PreprocessResult
): TranscriptSegment[] {
  return result.segments.filter((s) => s.relationship === "part_of_thread");
}
