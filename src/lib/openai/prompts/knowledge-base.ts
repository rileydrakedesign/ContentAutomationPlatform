/**
 * Knowledge Base Loader
 *
 * Loads and compiles content writing guidelines from the LLM-post-guidelines directory.
 * These guidelines are used to enhance all content generation (posts, replies, threads).
 */

import { readFileSync } from 'fs';
import { join } from 'path';

// Path to the knowledge base directory
const KNOWLEDGE_BASE_PATH = join(process.cwd(), 'LLM-post-guidelines');

// Cache for loaded content (loaded once per server start)
let cachedKnowledgeBase: string | null = null;
let cachedReplyGuidelines: string | null = null;

/**
 * Load a single file from the knowledge base
 */
function loadFile(filename: string): string {
  try {
    const filepath = join(KNOWLEDGE_BASE_PATH, filename);
    return readFileSync(filepath, 'utf-8');
  } catch (error) {
    console.warn(`[KnowledgeBase] Could not load ${filename}:`, error);
    return '';
  }
}

/**
 * Get the full knowledge base compiled into a single prompt section.
 * Used for post generation.
 */
export function getFullKnowledgeBase(): string {
  if (cachedKnowledgeBase) {
    return cachedKnowledgeBase;
  }

  const writingPrinciples = loadFile('writing-principles.md');
  const copywritingPrinciples = loadFile('copywriting-principles.md');
  const engagementTemplates = loadFile('engagement-templates.md');
  const highPerformingExamples = loadFile('high-performing-examples.md');

  cachedKnowledgeBase = `
## CONTENT WRITING KNOWLEDGE BASE

The following guidelines represent proven strategies for creating high-engagement social media content.
Apply these principles to all content you generate.

### WRITING FUNDAMENTALS
${writingPrinciples}

### TWITTER/X COPYWRITING TACTICS
${copywritingPrinciples}

### ENGAGEMENT PATTERNS & TEMPLATES
${engagementTemplates}

### HIGH-PERFORMING EXAMPLES (100K+ Views)
Study these patterns - they represent what actually works:
${highPerformingExamples}
`.trim();

  return cachedKnowledgeBase;
}

/**
 * Get a condensed version of the knowledge base optimized for reply generation.
 * Focuses on conversational engagement tactics rather than full post structure.
 */
export function getReplyGuidelines(): string {
  if (cachedReplyGuidelines) {
    return cachedReplyGuidelines;
  }

  const writingPrinciples = loadFile('writing-principles.md');
  const copywritingPrinciples = loadFile('copywriting-principles.md');

  cachedReplyGuidelines = `
## REPLY WRITING GUIDELINES

You are generating a reply to a social media post. Apply these principles:

### CORE WRITING PRINCIPLES
- Write conversationally, like talking to a friend
- Keep it simple - the goal is frictionless idea transfer
- Be concrete and specific, not abstract
- Use active voice
- Write with confidence - skip disclaimers like "this might seem obvious"
- Finish strong with a punch

### REPLY-SPECIFIC TACTICS

**Hook Fundamentals:**
- Target the reader directly ("You" instead of "people")
- Lead with value or insight
- Avoid overused patterns ("Most creators...", "Everyone is...")

**Voice and Tone:**
- Sound human, not robotic - use contractions
- Be direct without being harsh
- Casual but valuable
- Non-salesy while remaining outcome-focused

**Engagement Triggers:**
- Add value to the conversation
- Ask thought-provoking questions when appropriate
- Show genuine engagement with the original point
- Be specific over generic

**What to Avoid:**
- Burying the lead
- Being too humble or hedging
- Overcomplicating the response
- Generic praise without substance
- Weak endings that trail off

**Format:**
- Keep under 280 characters for X/Twitter
- No hashtags unless highly relevant
- No emojis unless the tone calls for it
- Sound natural and human
`.trim();

  return cachedReplyGuidelines;
}

/**
 * Get key copywriting principles as a condensed prompt addition.
 * Use when you need a lighter-weight injection.
 */
export function getCopywritingEssentials(): string {
  return `
## COPYWRITING ESSENTIALS

Apply these proven tactics:
- Target the reader directly with "you" language
- Lead with the benefit first
- Use specific numbers over vague claims
- Create low friction - make next steps obvious
- Be conversational, not corporate
- Cut ruthlessly - every word must earn its place
- End with clear action or thought-provoking statement
- Avoid: "Most people...", "Everyone is...", "In today's world"
- Prefer: Short punchy sentences, specific examples, plain language
`.trim();
}

/**
 * Clear the cache (useful for development/testing)
 */
export function clearKnowledgeBaseCache(): void {
  cachedKnowledgeBase = null;
  cachedReplyGuidelines = null;
}
