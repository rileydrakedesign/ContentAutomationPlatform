/**
 * Agentic post pipeline.
 *
 * Turns one-shot post generation into a visible chain of steps:
 *   research (Claude + server-side web search for recent, relevant info)
 *   → draft (write in the user's tuned voice, grounded in the research)
 *   → voice-check (score 0-100 against the assembled voice spec)
 *   → iterate (revise toward the voice until the score clears the target).
 *
 * This is a code-orchestrated workflow (not an open-ended agent): each step is
 * a discrete, streamable unit so the UI can render the chain live. It runs on
 * Claude directly (Sonnet 4.6) regardless of the model picker — the agentic
 * path is Claude-only by construction. See runPostPipeline below.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { getClaude } from "@/lib/ai/providers/claude";
import { runThroughGateway, gatewayAdmit } from "@/lib/ai/gateway";
import { recordUsage } from "@/lib/ai/usage";
import { getAssembledPromptForUser } from "@/lib/openai/prompts/prompt-assembler";
import { runVoiceCheck, type VoiceCheckResult } from "@/lib/analysis/voice-check";
import { runPrepublishRead, type PrepublishReadResult } from "@/lib/analysis/prepublish-read";

// Sonnet 4.6 balances quality and latency for the multi-call loop and supports
// the basic server-side web_search tool. Kept separate from CLAUDE_MODELS so
// the pipeline's model is an explicit, independent choice.
export const PIPELINE_MODEL = "claude-sonnet-4-6";
// Iteration policy: do a refinement pass only when the draft is below
// VOICE_TARGET, and only do a *second* pass when it's still very low (below
// VERY_LOW). So a typical draft gets 0 or 1 voice pass; two passes happen only
// when the voice match is consistently poor.
const VOICE_TARGET = 75;
const VERY_LOW = 55;
const MAX_ITERATIONS = 2;

export type DraftType = "X_POST" | "X_THREAD";

export interface PipelinePattern {
  id: string;
  pattern_name: string;
  pattern_value: string;
}

export interface ResearchSource {
  title: string;
  url: string;
}

export interface GeneratedOption {
  type: DraftType;
  content: { text?: string; tweets?: string[] };
  topic: string;
  applied_patterns: string[];
  metadata: {
    generation_type: string;
    voice_score: number;
    sources: ResearchSource[];
    inspiration_author?: string;
    prepublish_read?: PrepublishReadResult;
  };
}

export type StepName = "research" | "draft" | "voice_check" | "iterate" | "read";

/** Events streamed to the client so it can render the agentic chain live. */
export type PipelineEvent =
  | { type: "step"; step: StepName; status: "running" | "done"; label: string; iteration?: number }
  | { type: "research"; sources: ResearchSource[]; brief: string }
  | { type: "draft_delta"; text: string; iteration: number }
  | { type: "voice_score"; iteration: number; score: number; deviations: string[]; suggested_edit: string }
  | { type: "read"; read: PrepublishReadResult }
  | { type: "complete"; option: GeneratedOption; voiceCheck: VoiceCheckResult; sources: ResearchSource[] };

export interface PostPipelineInput {
  supabase: SupabaseClient;
  userId: string;
  topic: string;
  draftType: DraftType;
  patterns: PipelinePattern[];
  explicitPatternSelection: boolean;
  inspiration?: { text: string; author: string } | null;
  instructions?: string | null;
  previousVariations?: string[] | null;
}

const RESEARCH_SYSTEM = `You are a research assistant for a social-media writer. Given a topic, use web search to gather the most RECENT, specific, and credible information that would make a post on this topic feel current, informed, and non-generic.

Prioritize: developments from the last few weeks or months, concrete numbers and stats, named people/companies/products, and any recent shift in the conversation. Run multiple focused searches when it helps.

Then write a tight research brief: 3-6 bullet points of the most useful, specific facts, each stated plainly. Do NOT write the post. Do NOT editorialize. Output only the bullet brief. If the topic is evergreen or opinion-based with little to search, say so in one line and list the few most relevant facts or framings you found.`;

function textOf(message: Anthropic.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

/**
 * Summarize the user's explicit, intentional choices for this post so the
 * voice checker doesn't penalize the draft for following them and the refine
 * pass keeps honoring them. Empty when the user gave no per-post direction.
 */
export function buildConstraints(input: {
  instructions?: string | null;
  inspiration?: { author: string } | null;
}): string {
  return [
    input.instructions?.trim() ? `The user explicitly asked: "${input.instructions.trim()}"` : "",
    input.inspiration ? `The post is intentionally modeled on the structure and format of an inspiration post.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/** Strip preamble/quotes/code fences the model occasionally wraps output in. */
export function cleanDraft(text: string): string {
  let t = text.trim();
  t = t.replace(/^```[a-zA-Z]*\n?/, "").replace(/\n?```$/, "").trim();
  if (t.length > 1 && ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'")))) {
    t = t.slice(1, -1).trim();
  }
  return t;
}

/** Split a thread draft on the explicit `---` delimiter, with sane fallbacks. */
export function splitThread(text: string): string[] {
  const byDelim = text
    .split(/\n\s*-{3,}\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (byDelim.length > 1) return byDelim;
  const byBlank = text
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean);
  return byBlank.length > 1 ? byBlank : [text.trim()];
}

/** What the voice checker scores — a thread is joined so it reads as one piece. */
function draftCheckText(text: string, draftType: DraftType): string {
  return draftType === "X_THREAD" ? splitThread(text).join("\n\n") : text;
}

/**
 * Shared priority ladder for this post. The tuned voice (in the system prompt)
 * is the baseline for tone and personality — but the user's explicit choices
 * for THIS post (instructions, then inspiration, then selected patterns) take
 * precedence over default voice tendencies when they conflict.
 */
function buildPriorityLadder(input: {
  instructions?: string | null;
  inspiration?: { author: string } | null;
  hasSelectedPatterns: boolean;
}): string {
  const lines = ["Priority order for THIS post (highest first):"];
  let n = 1;
  if (input.instructions?.trim()) {
    lines.push(`${n++}. The explicit instruction below — follow it fully, even where it diverges from your usual voice tendencies (length, format, structure are yours to change on request).`);
  }
  if (input.inspiration) {
    lines.push(`${n++}. The inspiration post below — match its structure, format, and length closely; it is the primary template for this post.`);
  }
  if (input.hasSelectedPatterns) {
    lines.push(`${n++}. The selected proven patterns below.`);
  }
  lines.push(`${n++}. The user's tuned voice (from the system prompt) — use it for tone, vocabulary, and personality. It's the baseline, not a cage: never let it override the explicit choices above.`);
  return lines.join("\n");
}

function buildDraftPrompt(input: PostPipelineInput, brief: string): string {
  const { topic, draftType, patterns, explicitPatternSelection, inspiration, instructions, previousVariations } = input;
  const hasSelectedPatterns = explicitPatternSelection && patterns.length > 0;

  const format =
    draftType === "X_THREAD"
      ? `Format: a thread of 3-5 connected posts. Separate each post with a line containing only "---". Keep each post under 280 characters. Open with a strong hook.`
      : `Format: a single X post. Use line breaks for readability where they help. Keep it as tight as the instruction allows; don't pad without reason.`;

  const research = brief.trim()
    ? `Recent research to ground the post (use these specific, current facts; never invent stats — only use what's here or what you're certain of):\n${brief.trim()}`
    : `(No fresh research surfaced — write from the user's voice and the topic itself.)`;

  // Inspiration is the heaviest stylistic driver when present.
  const inspirationBlock = inspiration
    ? `INSPIRATION POST (model this post closely on its structure, format, length, and hook style — adapt the wording into the user's voice; do not copy it verbatim):\n@${inspiration.author}: "${inspiration.text}"`
    : "";

  // Explicit instruction is the top directive — it overrides default voice tendencies.
  const instructionBlock = instructions?.trim()
    ? `EXPLICIT INSTRUCTION FOR THIS POST (apply fully; this overrides default voice tendencies where they conflict): ${instructions.trim()}`
    : "";

  const patternBlock = hasSelectedPatterns
    ? `Selected proven patterns — apply them where they fit:\n${patterns
        .map((p) => `- ${p.pattern_name}: ${p.pattern_value}`)
        .join("\n")}`
    : "";

  const priorBlock =
    previousVariations && previousVariations.length > 0
      ? `You already wrote these — make this one meaningfully different in angle, hook, or structure:\n${previousVariations
          .slice(0, 4)
          .map((v, i) => `[${i + 1}] ${String(v).slice(0, 280)}`)
          .join("\n")}`
      : "";

  return [
    `Write a ${draftType === "X_THREAD" ? "thread" : "post"} about: "${topic}"`,
    buildPriorityLadder({ instructions, inspiration, hasSelectedPatterns }),
    instructionBlock,
    inspirationBlock,
    patternBlock,
    format,
    research,
    priorBlock,
    `Output ONLY the post text itself — no preamble, no surrounding quotation marks, no explanation, no JSON, no markdown headers.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function buildRevisePrompt(
  currentText: string,
  check: VoiceCheckResult,
  draftType: DraftType,
  constraints: string
): string {
  return [
    `Here is a draft ${draftType === "X_THREAD" ? "thread" : "post"}:`,
    `"""\n${currentText}\n"""`,
    `A voice check scored it ${check.score}/100 against the user's voice. Fix these issues:`,
    check.deviations.length > 0 ? check.deviations.map((d) => `- ${d}`).join("\n") : "- (none listed — push it closer to the user's voice)",
    check.suggested_edit ? `Suggested direction:\n${check.suggested_edit}` : "",
    constraints ? `Keep honoring the user's explicit choices for this post (do not undo them while improving voice): ${constraints}` : "",
    `Rewrite it to sound more like the user and resolve those issues, keeping the same core idea and any specific facts.${
      draftType === "X_THREAD" ? ` Separate each post with a line containing only "---".` : ""
    }`,
    `Output ONLY the rewritten post text — no preamble, no surrounding quotes, no explanation.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Research the topic with Claude's server-side web search. Returns a bullet
 * brief plus the deduped sources cited. Handles `pause_turn` so the server-tool
 * loop can resume if it pauses mid-search.
 */
async function research(topic: string, userId: string): Promise<{ brief: string; sources: ResearchSource[] }> {
  const client = getClaude();
  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `Topic for an X post: "${topic}". Research the most current, specific, and credible information, then return the bullet brief.`,
    },
  ];
  const collected: ResearchSource[] = [];
  let brief = "";

  for (let i = 0; i < 5; i++) {
    // Each research turn goes through the gateway: admission gate + backoff +
    // breaker + token metering, same as one-shot generation.
    const { value: res } = await runThroughGateway({
      provider: "claude",
      model: PIPELINE_MODEL,
      estimatedTokens: 2000,
      meta: { route: "drafts/generate-agentic:research", userId },
      exec: async () => {
        const r = await client.messages.create({
          model: PIPELINE_MODEL,
          max_tokens: 1500,
          system: RESEARCH_SYSTEM,
          tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 4 }],
          messages,
        });
        return { value: r, usage: { input: r.usage.input_tokens, output: r.usage.output_tokens } };
      },
    });

    for (const block of res.content) {
      if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
        for (const r of block.content) {
          if (r.type === "web_search_result") collected.push({ title: r.title, url: r.url });
        }
      }
    }

    if (res.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: res.content });
      continue;
    }

    brief = textOf(res);
    break;
  }

  const seen = new Set<string>();
  const sources: ResearchSource[] = [];
  for (const s of collected) {
    if (s.url && !seen.has(s.url)) {
      seen.add(s.url);
      sources.push(s);
    }
  }
  return { brief, sources: sources.slice(0, 6) };
}

/**
 * Stream a draft (or revision) from Claude, yielding token deltas as they
 * arrive and returning the assembled text. Delegated to via `yield*`.
 */
async function* streamDraftText(
  params: Anthropic.MessageStreamParams,
  iteration: number,
  userId: string
): AsyncGenerator<PipelineEvent, string> {
  // Streaming can't use runThroughGateway (it returns incrementally), so gate
  // admission up front and meter actual usage from the final message.
  await gatewayAdmit("claude", typeof params.max_tokens === "number" ? params.max_tokens + 500 : 1700);
  const stream = getClaude().messages.stream(params);
  let text = "";
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      text += event.delta.text;
      yield { type: "draft_delta", text: event.delta.text, iteration };
    }
  }
  const final = await stream.finalMessage();
  await recordUsage({
    provider: "claude",
    model: PIPELINE_MODEL,
    input: final.usage.input_tokens,
    output: final.usage.output_tokens,
    route: "drafts/generate-agentic:draft",
    userId,
  });
  return (textOf(final) || text).trim();
}

/**
 * Run the full research → draft → voice-check → iterate pipeline for a post,
 * yielding chain events for live display and a final `complete` event carrying
 * the best draft (highest voice score) shaped like the existing generation API.
 */
export async function* runPostPipeline(input: PostPipelineInput): AsyncGenerator<PipelineEvent> {
  const { supabase, userId, topic, draftType, inspiration, instructions } = input;

  // Explicit per-post direction the voice checker and refine passes must respect.
  const constraints = buildConstraints({ instructions, inspiration });

  // 1. Research recent, relevant context.
  yield { type: "step", step: "research", status: "running", label: "Researching recent context" };
  const { brief, sources } = await research(topic, userId);
  yield { type: "research", sources, brief };
  yield {
    type: "step",
    step: "research",
    status: "done",
    label: sources.length > 0 ? `Found ${sources.length} source${sources.length === 1 ? "" : "s"}` : "No fresh sources — using your voice",
  };

  // 2. Draft in the user's tuned voice (baseline only — default patterns are
  // not force-injected; only this post's explicit selections drive), grounded
  // in the research.
  yield { type: "step", step: "draft", status: "running", label: "Writing in your voice" };
  const voiceSystem = await getAssembledPromptForUser(supabase, userId, "post", { includePatterns: false });
  const rawDraft = yield* streamDraftText(
    {
      model: PIPELINE_MODEL,
      max_tokens: 1200,
      system: voiceSystem,
      messages: [{ role: "user", content: buildDraftPrompt(input, brief) }],
    },
    0,
    userId
  );
  let bestText = cleanDraft(rawDraft);
  yield { type: "step", step: "draft", status: "done", label: "Draft ready" };

  // 3. Voice-check against the same scoped spec, telling the judge not to
  // penalize the draft for following the user's explicit instructions.
  const checkOptions = { systemPromptOverride: voiceSystem, constraints };
  yield { type: "step", step: "voice_check", status: "running", label: "Voice-checking the draft" };
  let bestCheck = await runVoiceCheck(supabase, userId, draftCheckText(bestText, draftType), "post", checkOptions);
  yield {
    type: "voice_score",
    iteration: 0,
    score: bestCheck.score,
    deviations: bestCheck.deviations,
    suggested_edit: bestCheck.suggested_edit,
  };
  yield { type: "step", step: "voice_check", status: "done", label: `Voice match ${bestCheck.score}/100` };

  // 4. Iterate toward the voice target, keeping the best-scoring draft. A pass
  // runs only when below VOICE_TARGET (75); a second pass only when still very
  // low (below VERY_LOW, 55) — so most drafts get 0 or 1 pass.
  let iteration = 0;
  while (iteration < MAX_ITERATIONS && bestCheck.score < (iteration === 0 ? VOICE_TARGET : VERY_LOW)) {
    iteration++;
    yield { type: "step", step: "iterate", status: "running", label: `Refining for voice (pass ${iteration})`, iteration };

    const revisedRaw = yield* streamDraftText(
      {
        model: PIPELINE_MODEL,
        max_tokens: 1200,
        system: voiceSystem,
        messages: [{ role: "user", content: buildRevisePrompt(bestText, bestCheck, draftType, constraints) }],
      },
      iteration,
      userId
    );
    const revised = cleanDraft(revisedRaw);
    const newCheck = await runVoiceCheck(supabase, userId, draftCheckText(revised, draftType), "post", checkOptions);
    yield {
      type: "voice_score",
      iteration,
      score: newCheck.score,
      deviations: newCheck.deviations,
      suggested_edit: newCheck.suggested_edit,
    };

    if (newCheck.score >= bestCheck.score) {
      bestText = revised;
      bestCheck = newCheck;
    }
    yield { type: "step", step: "iterate", status: "done", label: `Pass ${iteration}: ${newCheck.score}/100`, iteration };
  }

  // 5. Pre-publish read on the winning draft: how much it resembles the user's
  // top performers + how X's algorithm will treat it. Best-effort — a failure
  // here must never fail generation, so it's fully guarded.
  let read: PrepublishReadResult | undefined;
  try {
    yield { type: "step", step: "read", status: "running", label: "Reading engagement fit" };
    read = await runPrepublishRead(supabase, userId, draftCheckText(bestText, draftType), {
      draftType,
    });
    yield { type: "read", read };
    yield {
      type: "step",
      step: "read",
      status: "done",
      label: `Resembles your winners ${read.resemblance_score}/100`,
    };
  } catch (e) {
    console.error("[pipeline] pre-publish read failed", e);
  }

  // 6. Emit the final option (same shape the one-shot route returns).
  const option: GeneratedOption = {
    type: draftType,
    content: draftType === "X_THREAD" ? { tweets: splitThread(bestText) } : { text: bestText },
    topic,
    applied_patterns: input.patterns.map((p) => p.id),
    metadata: {
      generation_type: inspiration ? "inspiration_based" : "topic_based",
      voice_score: bestCheck.score,
      sources,
      ...(inspiration ? { inspiration_author: inspiration.author } : {}),
      ...(read ? { prepublish_read: read } : {}),
    },
  };
  yield { type: "complete", option, voiceCheck: bestCheck, sources };
}
