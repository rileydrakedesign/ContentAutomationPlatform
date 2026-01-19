/**
 * Types for inspiration posts and style analysis
 */

export interface VoiceAnalysis {
  /** Overall tone descriptors (e.g., "casual", "curious", "direct") */
  tone: string[];
  /** Sentence style description */
  sentenceStyle: string;
  /** Vocabulary level and type */
  vocabulary: string;
  /** Narrative perspective (e.g., "First person, experiential") */
  perspective: string;
  /** Notable writing patterns */
  patterns: string[];
  /** Example phrases that capture the voice */
  signaturePhrases: string[];
}

export interface FormatAnalysis {
  /** Overall structure pattern */
  structure: string;
  /** Approximate character count */
  length: number;
  /** How line breaks are used */
  lineBreakUsage: string;
  /** Average sentences per paragraph */
  paragraphStyle: string;
  /** Whether lists/bullets are used */
  usesLists: boolean;
  /** Opening style (hook type) */
  openingStyle: string;
  /** Closing style (CTA, question, etc.) */
  closingStyle: string;
}

export interface InspirationPost {
  id: string;
  raw_content: string;
  source_url: string | null;
  author_handle: string | null;
  platform: string;
  voice_analysis: VoiceAnalysis | null;
  format_analysis: FormatAnalysis | null;
  analysis_status: 'pending' | 'analyzing' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
}

export interface StyleReference {
  /** Inspiration post IDs to use as style reference */
  inspirationIds: string[];
  /** What aspects of the style to apply */
  applyAs: 'voice_and_format' | 'voice_only' | 'format_only';
}

export interface InspirationAnalysisResult {
  voice: VoiceAnalysis;
  format: FormatAnalysis;
}
