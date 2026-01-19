// Client
export { openai } from "./client";

// Legacy transcription (unused but kept for reference)
export { transcribeAudio } from "./transcribe";

// Content generation
export {
  // Legacy generation
  generateContent,
  // Enhanced voice memo pipeline
  generateFromVoiceMemo,
  analyzeOnly,
  extractSearchKeywords,
  // Errors
  FragmentContentError,
} from "./generate";

// Types
export type {
  GeneratedContent,
  XPostContent,
  XThreadContent,
  ReelScriptContent,
  EnhancedGenerationResult,
  VoiceMemoGenerateOptions,
  AnalysisResult,
  FrameworkType,
} from "./generate";

// Analysis types (for more granular imports)
export type {
  ContentDensity,
  Completeness,
  IntentType,
  SuggestedFormat,
} from "./analyzer";

// Framework utilities
export { getFramework, FRAMEWORKS } from "./prompts/frameworks";

// Inspiration analysis
export { analyzeInspirationPost, buildStylePrompt } from "./analyze-inspiration";

// Transcript preprocessing
export {
  preprocessTranscript,
  combineSegmentsForThread,
  getStandaloneSegments,
  getThreadSegments,
} from "./preprocessor";

export type {
  TranscriptStructure,
  TranscriptSegment,
  PreprocessResult,
} from "./preprocessor";
