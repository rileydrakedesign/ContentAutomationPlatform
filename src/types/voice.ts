// Voice settings control knob options (matching the brief's MVP knobs)
export type LengthMode = 'short' | 'medium';
export type DirectnessMode = 'soft' | 'neutral' | 'blunt';
export type HumorMode = 'off' | 'light';
export type EmojiMode = 'off' | 'on';
export type QuestionRate = 'low' | 'medium';
export type DisagreementMode = 'avoid' | 'allow_nuance';

// Voice type discriminator for post vs reply voice
export type VoiceType = 'post' | 'reply';

// Voice dial settings (0-100 sliders)
export interface VoiceDials {
  optimization_authenticity: number; // 0 = authentic, 100 = optimized
  tone_formal_casual: number; // 0 = formal, 100 = casual
  energy_calm_punchy: number; // 0 = calm, 100 = punchy
  stance_neutral_opinionated: number; // 0 = neutral, 100 = opinionated
}

// Guardrails for content generation
export interface VoiceGuardrails {
  avoid_words: string[];
  avoid_topics: string[];
  custom_rules: string[];
}

export interface UserVoiceSettings {
  id: string;
  user_id: string;
  voice_type: VoiceType;
  length_mode: LengthMode;
  directness_mode: DirectnessMode;
  humor_mode: HumorMode;
  emoji_mode: EmojiMode;
  question_rate: QuestionRate;
  disagreement_mode: DisagreementMode;
  max_example_tokens: number;
  max_inspiration_tokens: number;
  auto_refresh_enabled: boolean;
  last_refresh_at: string | null;
  refresh_day_of_week: number;
  // Voice dial settings
  optimization_authenticity: number;
  tone_formal_casual: number;
  energy_calm_punchy: number;
  stance_neutral_opinionated: number;
  guardrails: VoiceGuardrails;
  special_notes: string | null;
  created_at: string;
  updated_at: string;
}

export const DEFAULT_VOICE_SETTINGS: Omit<UserVoiceSettings, 'id' | 'user_id' | 'created_at' | 'updated_at'> = {
  voice_type: 'reply',
  length_mode: 'medium',
  directness_mode: 'neutral',
  humor_mode: 'off',
  emoji_mode: 'off',
  question_rate: 'low',
  disagreement_mode: 'avoid',
  max_example_tokens: 1500,
  max_inspiration_tokens: 500,
  auto_refresh_enabled: true,
  last_refresh_at: null,
  refresh_day_of_week: 0,
  // Voice dial defaults (centered at 50)
  optimization_authenticity: 50,
  tone_formal_casual: 50,
  energy_calm_punchy: 50,
  stance_neutral_opinionated: 50,
  guardrails: {
    avoid_words: [],
    avoid_topics: [],
    custom_rules: [],
  },
  special_notes: null,
};

export type VoiceExampleSource = 'auto' | 'pinned';
export type VoiceExampleType = 'post' | 'reply';

export interface VoiceExampleMetrics {
  likes?: number;
  retweets?: number;
  replies?: number;
  quotes?: number;
  views?: number;
}

export interface UserVoiceExample {
  id: string;
  user_id: string;
  captured_post_id: string | null;
  content_text: string;
  content_type: VoiceExampleType;
  source: VoiceExampleSource;
  is_excluded: boolean;
  pinned_rank: number | null;
  user_note: string | null;
  metrics_snapshot: VoiceExampleMetrics;
  engagement_score: number;
  token_count: number;
  selected_at: string;
  selection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserInspiration {
  id: string;
  user_id: string;
  keyword: string;
  niche_category: string | null;
  content_text: string;
  source_url: string | null;
  source_author: string | null;
  is_pinned: boolean;
  is_excluded: boolean;
  pinned_rank: number | null;
  user_note: string | null;
  relevance_score: number;
  token_count: number;
  pulled_at: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

// Chat message types for voice editor
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  suggestedChanges?: Partial<UserVoiceSettings>;
  sampleContent?: string;
}

// Parsed CSV post from X Analytics export
export interface ParsedCsvPost {
  id: string;
  text: string;
  date: string;
  impressions: number;
  likes: number;
  replies: number;
  reposts: number;
  bookmarks: number;
  engagementScore: number;
  isReply: boolean;
  selected: boolean;
}

// API Request types
export interface UpdateVoiceSettingsRequest {
  voice_type?: VoiceType;
  length_mode?: LengthMode;
  directness_mode?: DirectnessMode;
  humor_mode?: HumorMode;
  emoji_mode?: EmojiMode;
  question_rate?: QuestionRate;
  disagreement_mode?: DisagreementMode;
  max_example_tokens?: number;
  max_inspiration_tokens?: number;
  auto_refresh_enabled?: boolean;
  refresh_day_of_week?: number;
  // Voice dial settings
  optimization_authenticity?: number;
  tone_formal_casual?: number;
  energy_calm_punchy?: number;
  stance_neutral_opinionated?: number;
  guardrails?: VoiceGuardrails;
  special_notes?: string | null;
}

export interface PinExampleRequest {
  rank?: number;
}

export interface AddExampleRequest {
  content_text: string;
  content_type: VoiceExampleType;
  captured_post_id?: string;
}

export interface ReorderExamplesRequest {
  example_ids: string[];
}

export interface AddInspirationRequest {
  keyword: string;
  content_text: string;
  source_url?: string;
  source_author?: string;
  niche_category?: string;
}

export interface AddKeywordRequest {
  keyword: string;
  niche_category?: string;
}

// Prompt assembly types
export interface TokenBreakdown {
  base_prompt_tokens: number;
  controls_tokens: number;
  voice_examples_tokens: number;
  inspiration_tokens: number;
}

export interface AssembledPrompt {
  system_prompt: string;
  total_tokens: number;
  breakdown: TokenBreakdown;
  examples_included: number;
  examples_omitted: number;
  inspirations_included: number;
  inspirations_omitted: number;
}

// Response types for prompt preview
export interface PromptPreviewResponse {
  assembled: AssembledPrompt;
  settings: UserVoiceSettings;
  examples: UserVoiceExample[];
  inspirations: UserInspiration[];
}
