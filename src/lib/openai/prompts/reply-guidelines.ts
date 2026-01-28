import fs from 'fs';
import path from 'path';

// Cache for loaded guidelines
let cachedGuidelines: string | null = null;
let cachedExamples: string | null = null;

/**
 * Load writing and copywriting principles from the LLM guidelines directory
 */
export function loadReplyGuidelines(): string {
  if (cachedGuidelines) return cachedGuidelines;

  const guidelinesDir = path.join(process.cwd(), 'LLM-post-guidelines');

  const filesToLoad = [
    'writing-principles.md',
    'copywriting-principles.md',
    'feedback-examples.md',
    'algo-principles.md',
  ];

  const sections: string[] = [];

  for (const filename of filesToLoad) {
    const filePath = path.join(guidelinesDir, filename);
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      sections.push(content);
    } catch (error) {
      console.warn(`Could not load ${filename}:`, error);
    }
  }

  cachedGuidelines = sections.join('\n\n---\n\n');
  return cachedGuidelines;
}

/**
 * High-performing reply examples - raw text only
 * These are real replies that got high engagement
 */
export function getHighPerformingReplyExamples(): string {
  if (cachedExamples) return cachedExamples;

  cachedExamples = `
## REPLY EXAMPLES

Write like these:

"Ironically googles product first AI mindset has been very aligned with apples values. They're also probably betting on TPUs"

"I hope you got a raise my friend"

"AI is a great programmer but a terrible software engineer. Let that sink in"

"There should be a startup built around this. Should I build it? AI arena?"

"Haven't seen open ai ship a product that stuck since chat gpt…"

"Why use n8n when you already use Claude? Claude is infinitely more powerful, to me n8n only makes sense if you can't code"

"They do. They're called markdown files"

"I guess this settles the age old debate… SWEs could be marketers but marketers can't be SWEs"

"I wanna say Claude but I have to say Spotify"

"The more senior you get the less code you write"

"Stripe's docs are why they won. Not their API."

"The real shift is that debugging now takes longer than writing"

"Bye adobe"

"WALL-E was right"

"Classic example of all hype with no product"
`;

  return cachedExamples;
}

/**
 * Get the complete reply generation context
 */
export function getReplyGenerationContext(): string {
  const guidelines = loadReplyGuidelines();
  const examples = getHighPerformingReplyExamples();

  return `${guidelines}\n\n${examples}`;
}
