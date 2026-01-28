/**
 * Prompt Assembly System
 *
 * Dynamically builds prompts from:
 * - Base system prompt
 * - User voice controls
 * - Voice examples (pinned + auto)
 * - Inspiration examples
 * - Special notes
 *
 * Respects token budgets for examples and inspiration.
 */

import {
  UserVoiceSettings,
  UserVoiceExample,
  UserInspiration,
  AssembledPrompt,
  DEFAULT_VOICE_SETTINGS,
  VoiceType
} from '@/types/voice';
import { estimateTokens } from '@/lib/utils/tokens';
import { REPLY_SYSTEM_PROMPT } from './reply-prompt';

interface AssemblyContext {
  settings: Partial<UserVoiceSettings>;
  examples: UserVoiceExample[];
  inspirations: UserInspiration[];
  mode: VoiceType;
}

/**
 * Build the controls section based on user settings
 */
function buildControlsSection(settings: Partial<UserVoiceSettings>, mode: VoiceType): string {
  const s = { ...DEFAULT_VOICE_SETTINGS, ...settings };
  const controls: string[] = [];
  const contentType = mode === 'reply' ? 'replies' : 'posts';

  // Length control
  const lengthGuide: Record<string, string> = {
    short: `Keep ${contentType} SHORT. Under 50 chars when possible. Punch hard, get out.`,
    medium: `Target 50-120 chars. Balance punch with substance.`,
  };
  controls.push(`LENGTH: ${lengthGuide[s.length_mode]}`);

  // Directness control
  const directnessGuide: Record<string, string> = {
    soft: 'Be indirect. Suggest rather than assert. Let reader connect dots.',
    neutral: 'Mix direct statements with softer implications. Balanced tone.',
    blunt: 'Be direct. No hedging. Call things out plainly.',
  };
  controls.push(`DIRECTNESS: ${directnessGuide[s.directness_mode]}`);

  // Humor control
  const humorGuide: Record<string, string> = {
    off: `No humor. Purely substantive ${contentType}.`,
    light: 'Light wit when it adds value. Mostly serious.',
  };
  controls.push(`HUMOR: ${humorGuide[s.humor_mode]}`);

  // Emoji control
  const emojiGuide: Record<string, string> = {
    off: 'No emojis.',
    on: 'One emoji max, only if it adds meaning.',
  };
  controls.push(`EMOJIS: ${emojiGuide[s.emoji_mode]}`);

  // Question rate
  const questionGuide: Record<string, string> = {
    low: 'Rarely use questions. Make statements.',
    medium: 'Mix questions with statements for engagement.',
  };
  controls.push(`QUESTIONS: ${questionGuide[s.question_rate]}`);

  // Disagreement style
  const disagreementGuide: Record<string, string> = {
    avoid: 'Agree or stay neutral. Don\'t directly contradict.',
    allow_nuance: 'Disagree when warranted. Add nuance, offer alternatives.',
  };
  controls.push(`DISAGREEMENT: ${disagreementGuide[s.disagreement_mode]}`);

  // Voice dials (0-100 sliders)
  const optimizationDesc = s.optimization_authenticity < 30
    ? 'Write authentically. Avoid engagement tricks.'
    : s.optimization_authenticity > 70
    ? 'Optimize for engagement. Use proven hooks and CTAs.'
    : 'Balance authenticity with engagement tactics.';
  controls.push(`OPTIMIZATION: ${optimizationDesc}`);

  const toneDesc = s.tone_formal_casual < 30
    ? 'Use formal, professional language.'
    : s.tone_formal_casual > 70
    ? 'Be casual and conversational.'
    : 'Mix professional and conversational tones.';
  controls.push(`TONE: ${toneDesc}`);

  const energyDesc = s.energy_calm_punchy < 30
    ? 'Keep calm, thoughtful pacing.'
    : s.energy_calm_punchy > 70
    ? 'High energy. Short, punchy sentences.'
    : 'Moderate energy with varied pacing.';
  controls.push(`ENERGY: ${energyDesc}`);

  const stanceDesc = s.stance_neutral_opinionated < 30
    ? 'Stay neutral. Present balanced perspectives.'
    : s.stance_neutral_opinionated > 70
    ? 'Be bold and opinionated. Take strong stances.'
    : 'Have opinions but acknowledge other views.';
  controls.push(`STANCE: ${stanceDesc}`);

  return `## USER VOICE CONTROLS

Apply these preferences to all ${contentType}:

${controls.join('\n')}`;
}

/**
 * Build special notes section if present
 */
function buildSpecialNotesSection(settings: Partial<UserVoiceSettings>): string {
  if (!settings.special_notes || settings.special_notes.trim() === '') {
    return '';
  }

  return `## SPECIAL INSTRUCTIONS

${settings.special_notes}`;
}

/**
 * Build examples section with token budgeting
 */
function buildExamplesSection(
  examples: UserVoiceExample[],
  maxTokens: number,
  mode: VoiceType
): { section: string; tokensUsed: number; included: number; omitted: number } {
  if (examples.length === 0) {
    return { section: '', tokensUsed: 0, included: 0, omitted: 0 };
  }

  // Filter by content type matching mode
  const filteredExamples = examples.filter(e => e.content_type === mode);

  // Sort: pinned first (by rank), then by engagement score
  const sorted = [...filteredExamples]
    .filter(e => !e.is_excluded)
    .sort((a, b) => {
      if (a.pinned_rank !== null && b.pinned_rank !== null) {
        return a.pinned_rank - b.pinned_rank;
      }
      if (a.pinned_rank !== null) return -1;
      if (b.pinned_rank !== null) return 1;
      return b.engagement_score - a.engagement_score;
    });

  const included: string[] = [];
  let tokensUsed = 0;
  const headerText = `## YOUR TOP ${mode.toUpperCase()} EXAMPLES\n\nMatch this voice and style:\n\n`;
  const headerTokens = estimateTokens(headerText);
  tokensUsed += headerTokens;

  for (const example of sorted) {
    const exampleText = `"${example.content_text}"`;
    const exampleTokens = estimateTokens(exampleText + '\n\n');

    if (tokensUsed + exampleTokens > maxTokens) break;

    included.push(exampleText);
    tokensUsed += exampleTokens;
  }

  if (included.length === 0) {
    return { section: '', tokensUsed: 0, included: 0, omitted: sorted.length };
  }

  const section = `## YOUR TOP ${mode.toUpperCase()} EXAMPLES

Match this voice and style:

${included.join('\n\n')}`;

  return {
    section,
    tokensUsed,
    included: included.length,
    omitted: sorted.length - included.length
  };
}

/**
 * Build inspiration section with token budgeting
 */
function buildInspirationSection(
  inspirations: UserInspiration[],
  maxTokens: number
): { section: string; tokensUsed: number; included: number; omitted: number } {
  if (inspirations.length === 0) {
    return { section: '', tokensUsed: 0, included: 0, omitted: 0 };
  }

  // Sort: pinned first, then by relevance
  const sorted = [...inspirations]
    .filter(i => !i.is_excluded)
    .sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      if (a.pinned_rank !== null && b.pinned_rank !== null) {
        return a.pinned_rank - b.pinned_rank;
      }
      return b.relevance_score - a.relevance_score;
    });

  const included: string[] = [];
  let tokensUsed = 0;
  const headerText = '## INSPIRATION\n\nDraw from these high-performing patterns (style reference only):\n\n';
  const headerTokens = estimateTokens(headerText);
  tokensUsed += headerTokens;

  for (const insp of sorted) {
    // Skip placeholder items
    if (insp.content_text.startsWith('[Keyword placeholder')) continue;

    const inspText = `"${insp.content_text}"${insp.source_author ? ` (@${insp.source_author})` : ''}`;
    const inspTokens = estimateTokens(inspText + '\n\n');

    if (tokensUsed + inspTokens > maxTokens) break;

    included.push(inspText);
    tokensUsed += inspTokens;
  }

  if (included.length === 0) {
    return { section: '', tokensUsed: 0, included: 0, omitted: sorted.length };
  }

  const section = `## INSPIRATION

Draw from these high-performing patterns (style reference only):

${included.join('\n\n')}`;

  return {
    section,
    tokensUsed,
    included: included.length,
    omitted: sorted.length - included.length
  };
}

/**
 * Assemble the complete prompt with token budgeting
 */
export function assemblePrompt(context: AssemblyContext): AssembledPrompt {
  const { settings, examples, inspirations, mode } = context;

  // Use defaults for missing settings
  const effectiveSettings = { ...DEFAULT_VOICE_SETTINGS, ...settings };

  // Start with base prompt
  const basePrompt = REPLY_SYSTEM_PROMPT;
  const baseTokens = estimateTokens(basePrompt);

  // Build controls section
  const controlsSection = buildControlsSection(effectiveSettings, mode);
  const controlsTokens = estimateTokens(controlsSection);

  // Build special notes section
  const specialNotesSection = buildSpecialNotesSection(effectiveSettings);

  // Build examples section with budget
  const examplesResult = buildExamplesSection(
    examples,
    effectiveSettings.max_example_tokens,
    mode
  );

  // Build inspiration section with budget
  const inspirationResult = buildInspirationSection(
    inspirations,
    effectiveSettings.max_inspiration_tokens
  );

  // Assemble final prompt (insert controls and examples after base prompt)
  const sections = [
    basePrompt,
    controlsSection,
    specialNotesSection,
    examplesResult.section,
    inspirationResult.section,
  ].filter(Boolean);

  const fullPrompt = sections.join('\n\n');
  const totalTokens = estimateTokens(fullPrompt);

  return {
    system_prompt: fullPrompt,
    total_tokens: totalTokens,
    breakdown: {
      base_prompt_tokens: baseTokens,
      controls_tokens: controlsTokens,
      voice_examples_tokens: examplesResult.tokensUsed,
      inspiration_tokens: inspirationResult.tokensUsed,
    },
    examples_included: examplesResult.included,
    examples_omitted: examplesResult.omitted,
    inspirations_included: inspirationResult.included,
    inspirations_omitted: inspirationResult.omitted,
  };
}

/**
 * Get just the assembled system prompt (for API calls)
 */
export async function getAssembledPromptForUser(
  supabase: any,
  userId: string,
  voiceType: VoiceType = 'reply'
): Promise<string> {
  // Fetch voice settings for the specific voice type
  const { data: settings } = await supabase
    .from('user_voice_settings')
    .select('*')
    .eq('user_id', userId)
    .eq('voice_type', voiceType)
    .single();

  // Fetch voice examples (non-excluded, filtered by content type)
  const { data: examples } = await supabase
    .from('user_voice_examples')
    .select('*')
    .eq('user_id', userId)
    .eq('is_excluded', false)
    .eq('content_type', voiceType)
    .order('pinned_rank', { ascending: true, nullsFirst: false })
    .order('engagement_score', { ascending: false });

  // Fetch inspiration (non-excluded)
  const { data: inspirations } = await supabase
    .from('user_inspiration')
    .select('*')
    .eq('user_id', userId)
    .eq('is_excluded', false);

  const assembled = assemblePrompt({
    settings: settings || {},
    examples: examples || [],
    inspirations: inspirations || [],
    mode: voiceType,
  });

  return assembled.system_prompt;
}
