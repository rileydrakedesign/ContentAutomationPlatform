/**
 * Live Read — L3 of the writing assistant (GRAMMARLY_ASSISTANT_ARCHITECTURE_HANDOFF.md §7).
 *
 * The LLM is demoted to what only it can do: explain and rewrite. It returns
 * *anchored* voice-drift findings (verbatim quotes, resolved to offsets here),
 * missing high-lift pattern chips, and a one-line summary. It does NOT own the
 * displayed scores — the cheap L2 embedding pass (vectors.ts / /api/assistant/score)
 * does. L3 may still return a voice score, used ONLY to calibrate L2.
 *
 * Cadence: rare and on-demand (panel open / low-score-idle / explicit "why?"),
 * never per-pause. Subscription-gated at the route, never metered.
 *
 *   - Read-first cache: identical drafts short-circuit on assistant_live_reads
 *     before the model is called.
 *   - Persistence is best-effort and isolated (Promise.allSettled) so a write
 *     rejection can never turn a successful read into an HTTP 500.
 *
 * Returns the AssistantFindings shape the client engine consumes (assistant/merge.ts).
 */

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createChatCompletion, resolveProvider, type AIProvider } from "@/lib/ai";
import { streamText, STREAMABLE_PROVIDERS } from "@/lib/ai/stream";
import { X_ALGORITHM_WEIGHTS } from "@/lib/analysis/x-algorithm";
import { getAssembledPromptForUser } from "@/lib/openai/prompts/prompt-assembler";
import { getAnalyzablePosts, getAnalyzableReplies } from "@/lib/analysis/posts-pool";
import { isGenerationApplicablePattern } from "@/lib/analysis/pattern-applicability";
import { resolveQuote, guardedFix } from "@/lib/analysis/assistant/spans";
import { recordCalibrationSample } from "@/lib/analysis/assistant/vectors";
import type { Finding, NextStep, SuggestionChip } from "@/lib/analysis/assistant/types";
import type { AssistantFindings } from "@/lib/analysis/assistant/merge";

/**
 * Provider for the live read specifically. `LIVE_READ_PROVIDER` (openai | claude |
 * grok | groq | cerebras) overrides the global resolution so this one path can run
 * on a faster host (Cerebras/Groq serve gpt-oss-120b at ~4× lower first-finding
 * latency) without touching the rest of the app. Falls back to the normal
 * resolution (Claude under CLAUDE_ONLY) when unset. Streaming covers every
 * provider except grok (see STREAMABLE_PROVIDERS) — grok runs the one-shot path.
 */
const LIVE_READ_PROVIDERS: ReadonlySet<string> = new Set([
  "openai",
  "claude",
  "grok",
  "groq",
  "cerebras",
]);

function liveReadProvider(stored?: string | null): AIProvider {
  const override = process.env.LIVE_READ_PROVIDER;
  if (override && LIVE_READ_PROVIDERS.has(override)) return override as AIProvider;
  return resolveProvider(stored);
}

interface PoolPattern {
  id: string;
  pattern_name: string | null;
  pattern_value: string | null;
  pattern_type: string | null;
  multiplier: number | null;
  sample_count: number | null;
  applies_to_generation: boolean | null;
}

export interface LiveReadOptions {
  draftType?: "X_POST" | "X_THREAD";
  /** Accepted-edit ledger from THIS editing session (client-tracked, sanitized
   *  at the route): settled decisions the read must not re-flag or revert. */
  sessionEdits?: { before: string; after: string }[];
  /** Suggestions the writer dismissed this session — don't re-raise them. */
  declined?: { quote?: string; issue: string }[];
  /** The core idea pinned by an earlier read this session — the north star the
   *  model must keep serving instead of re-deriving a new direction per read. */
  coreIdea?: string;
  /** Reply mode (G6): the post being replied to. Rides in the USER message
   *  (per-draft, never the cached prefix) so the judge reads the reply in
   *  context; also keys the read cache — the same reply text judged against a
   *  different parent is a different read. */
  parentText?: string;
}

/** The parent-post block for reply reads — user-message side, varies per draft. */
function parentSection(parentText?: string): string {
  const parent = (parentText || "").trim();
  if (!parent) return "";
  return `=== THE POST BEING REPLIED TO (the draft is a reply — judge it in this context: does it actually engage with this post, in the user's reply voice?) ===\n"""\n${parent}\n"""\n\n`;
}

/** Cache key input: draft + parent (␞ separator can't collide with draft text). */
function draftCacheInput(draftText: string, parentText?: string): string {
  const parent = (parentText || "").trim();
  return parent ? `${draftText}␞${parent}` : draftText;
}

/**
 * Global finding budget, scaled to the draft. Per-category quotas ("up to 4
 * voice + 3 algo + 3 correctness") read as targets and had the model wallpaper
 * a 280-char post in suggestions — a whole-post rewrite in installments. One
 * small combined ceiling keeps the read to the few highest-leverage issues.
 * A standard-length post gets TWO: the bar for a suggestion is "one of the two
 * things most worth fixing", not "anything improvable". Coarse buckets on
 * purpose: the number is interpolated into the instruction prefix, so fewer
 * buckets = fewer prompt-cache variants.
 */
export function findingBudget(chars: number): number {
  if (chars <= 280) return 2;
  if (chars <= 700) return 3;
  if (chars <= 1500) return 4;
  return 5;
}

/**
 * Per-draft session context: the decisions already made this editing session.
 * Goes in the USER message (it varies read-to-read), never the cached prefix.
 * The client's contradictsSettled filter is the hard guarantee; this makes the
 * model spend its budget on NEW problems instead of findings that would be
 * filtered anyway.
 */
function sessionSection(
  edits?: { before: string; after: string }[],
  declined?: { quote?: string; issue: string }[],
  coreIdea?: string
): string {
  const parts: string[] = [];
  if (coreIdea) {
    parts.push(
      `=== THE POST'S CORE IDEA (established earlier this session) ===\n"${coreIdea}"\nThis is the north star: every finding must sharpen how the draft delivers THIS idea. Re-state it in your output only if the draft's point has genuinely changed; otherwise repeat it verbatim.`
    );
  }
  if (edits?.length) {
    parts.push(
      `=== SETTLED DECISIONS THIS SESSION (edits the writer already accepted) ===\n` +
        edits.map((e) => `- "${e.before}" → "${e.after}"`).join("\n") +
        `\nThese are deliberate, settled decisions. Do NOT re-flag the replacement text, suggest reverting or rewording it, or make any suggestion that works against the direction of these edits. Revisit one of these spans only if the draft around it has changed substantially since.`
    );
  }
  if (declined?.length) {
    parts.push(
      `=== DECLINED SUGGESTIONS (the writer saw these and said no) ===\n` +
        declined.map((d) => `- ${d.issue}${d.quote ? ` (on "${d.quote}")` : ""}`).join("\n") +
        `\nDo not raise these again, or close variants of them.`
    );
  }
  return parts.length ? parts.join("\n\n") + "\n\n" : "";
}

interface LiveJudgeResponse {
  core_idea?: string;
  voice_score?: number;
  voice_deviations?: { quote?: string; issue?: string; why?: string; fix?: string; index?: number }[];
  correctness_issues?: { quote?: string; issue?: string; why?: string; fix?: string; index?: number }[];
  algorithm_issues?: { quote?: string; issue?: string; why?: string; fix?: string; index?: number }[];
  resemblance_score?: number;
  matched_pattern_ids?: string[];
  missing_pattern_ids?: string[];
  next_edit?: { label?: string; detail?: string };
  summary?: string;
}

/** Map an LLM deviation/issue object to an anchored Finding of `cls`. */
function toAnchoredFinding(
  d: { quote?: string; issue?: string; why?: string; fix?: string; index?: number },
  draftText: string,
  cls: "voice" | "correctness" | "reach",
  idPrefix: string,
  i: number,
  defaults: { severity: "warning" | "problem"; title: string; why: string; signal: string }
): Finding {
  const quote = String(d.quote || "").trim();
  const hint = typeof d.index === "number" && Number.isFinite(d.index) ? d.index : undefined;
  const at = quote ? resolveQuote(draftText, quote, hint) : null;
  const base: Finding = {
    id: `${idPrefix}:${i}`,
    class: cls,
    severity: defaults.severity,
    title: String(d.issue || defaults.title),
    why: String(d.why || defaults.why),
    replacement: guardedFix(d.fix, quote, at !== null, draftText.length),
    source: "live",
    signal: defaults.signal,
  };
  if (at) base.span = { quote, start: at.start, end: at.end };
  return base;
}

async function fetchEnabledPatterns(supabase: SupabaseClient, userId: string): Promise<PoolPattern[]> {
  const { data } = await supabase
    .from("extracted_patterns")
    .select("id, pattern_type, pattern_name, pattern_value, multiplier, sample_count, applies_to_generation")
    .eq("user_id", userId)
    .eq("is_enabled", true)
    .order("multiplier", { ascending: false })
    .limit(20);
  return (data as PoolPattern[]) || [];
}

interface LiveReadContext {
  provider: AIProvider;
  /** The static, cacheable grounding base (voice spec + posts + patterns), without
   *  the per-mode instruction tail — callers append INSTRUCTIONS_JSON/NDJSON. */
  groundingBase: string;
  /** Enabled, generation-applicable patterns by id (for resolving missing-pattern chips). */
  byId: Map<string, PoolPattern>;
  /** Size of the analyzable-posts pool (drives the persisted confidence label). */
  poolSize: number;
}

/**
 * Assemble everything the live read needs that does NOT depend on the draft: the
 * provider, the static grounding prefix, and the pattern map. Shared by runLiveRead
 * and warmLiveRead so the warming call primes the *exact* prefix a real read will
 * reuse from cache.
 */
async function assembleLiveRead(
  supabase: SupabaseClient,
  userId: string,
  voiceType: "post" | "reply"
): Promise<LiveReadContext> {
  // Reply reads ground on the REPLY pool ((parent → reply) pairs — reply style
  // is a different craft from post style); post reads on the post pool. Reply
  // pool too thin → fall back to posts so a new user still gets a grounded read.
  const [systemPrompt, patternsRaw, pool, replyPool] = await Promise.all([
    getAssembledPromptForUser(supabase, userId, voiceType),
    fetchEnabledPatterns(supabase, userId),
    getAnalyzablePosts(supabase, userId).catch(() => []),
    voiceType === "reply"
      ? getAnalyzableReplies(supabase, userId).catch(() => [])
      : Promise.resolve([]),
  ]);

  const provider: AIProvider = liveReadProvider();
  const patterns = patternsRaw.filter(isGenerationApplicablePattern);
  const byId = new Map(patterns.map((p) => [p.id, p]));
  // Lean grounding — fast cold round-trip. NOTE on caching: the `cachePrefix`
  // wiring below is real, but Haiku 4.5 only caches a prefix ≥ ~4096 tokens
  // (measured: a ~3200-token prefix never cached). Short-form X grounding sits
  // ~3000-3500 tokens, under that floor, so caching is a no-op here — and padding
  // the prompt to 4096 just to cache costs more on every cold call for a ~1-2s
  // TTFT gain that output throughput (the real bottleneck) dwarfs. The wiring is
  // kept (harmless) so it auto-engages for any future long-form / large-grounding
  // user whose prefix naturally crosses the floor.
  const topPosts = pool.slice(0, 6);
  const medianPosts = pool.slice(Math.floor(pool.length / 2), Math.floor(pool.length / 2) + 3);
  const patternList = patterns.map((p) => `- [${p.id}] ${p.pattern_name}: ${p.pattern_value}`).join("\n");

  // Reply-mode winners section: pairs, so the judge sees not just how the user
  // writes replies but how they ANSWER — tone-matching, what they latch onto.
  const topReplies = replyPool.slice(0, 6);
  const useReplyGrounding = voiceType === "reply" && topReplies.length >= 3;
  const winnersSection = useReplyGrounding
    ? `=== THE USER'S TOP-PERFORMING REPLIES (proven winners — each shown with the post it answered) ===
${topReplies
  .map(
    (r, i) =>
      `[reply ${i + 1}]${r.parent.text ? ` answering: "${r.parent.text.slice(0, 240)}"` : ""}\n→ their reply: ${r.text}`
  )
  .join("\n\n")}`
    : `=== THE USER'S TOP-PERFORMING POSTS (proven winners) ===
${topPosts.length ? topPosts.map((p, i) => `[top ${i + 1}] ${p.text}`).join("\n\n") : "(no posting history yet)"}

=== TYPICAL / MEDIAN POSTS (for contrast) ===
${medianPosts.length ? medianPosts.map((p, i) => `[median ${i + 1}] ${p.text}`).join("\n\n") : "(not enough posts)"}`;

  // STATIC grounding BASE — identical call-to-call within a session. The per-mode
  // instruction tail (JSON vs NDJSON) is appended by the caller; the whole prefix
  // (base + tail) is what rides as a cached system block (Anthropic prompt caching),
  // so only the draft varies and repeated reads are cheap + low-latency.
  // Compact, static rendering of the ranker mechanics (x-algorithm.ts, one
  // source of truth) so algorithm findings cite real weights, not vibes.
  const algorithmMechanics = X_ALGORITHM_WEIGHTS.map(
    (w) => `- ${w.label}${w.weight !== null ? ` (weight ${w.weight})` : ""}: ${w.note}`
  ).join("\n");

  const groundingBase = `You are a precise writing coach for THIS specific user, covering the two things they can't see: their VOICE and the X ALGORITHM. You are given their full voice specification, their proven top posts, and how X's ranker weighs engagement. For each draft you receive, explain how it drifts from their voice, where it will lose reach given how X ranks, which proven patterns it's missing, and any X-native correctness problems — the live score is computed separately, so focus on grounded, actionable findings.

=== HOW X RANKS (open-sourced heavy-ranker weights; ordering is the durable signal) ===
${algorithmMechanics}
=== END RANKING ===

=== VOICE SPECIFICATION (their style, controls, guardrails, examples) ===
${systemPrompt}
=== END VOICE SPECIFICATION ===

${winnersSection}

=== THE USER'S PROVEN PATTERNS (content-shaping; each has an id) ===
${patternList || "(no extracted patterns yet)"}`;

  return { provider, groundingBase, byId, poolSize: pool.length };
}

// Shared task description (the "what to find"); the OUTPUT FORMAT differs per
// mode. Parameterized by the global finding budget (findingBudget).
const taskFor = (budget: number) => `For the draft the user sends, do this:
0) CORE IDEA first: state, in one plain sentence (max 15 words, the writer's own framing), the single idea this post exists to deliver — the ONE thing a reader should walk away with, not a summary of every point. If a core idea was established earlier this session, repeat it verbatim unless the draft's point has genuinely changed. Every finding below must serve this idea.
1) VOICE DRIFTS: the clearest specific drifts, if any. For each, copy the EXACT substring of the draft it refers to as "quote" (verbatim — do not paraphrase), the approximate 0-based character "index" where that quote starts, a short "issue", a grounded "why", and an optional "fix" that rewrites just that span.
2) ALGORITHM: spots where this draft will LOSE reach given how X ranks (see the ranking weights above) — a first line that gives no reason to stop scrolling, nothing that invites a reply (the top lever), a vague line where the draft's OWN specifics would earn engagement, the strongest point buried below a weak opener, or filler the reader scrolls past. For each: the EXACT "quote", its "index", a short "issue", a "why" that names BOTH the ranking mechanism AND what this specific line fails to do for the core idea, and an optional "fix" rewriting just that span. Do NOT flag things the deterministic checks already catch: external links, engagement-bait phrases, hashtags, or a leading @mention.
3) PATTERNS: which proven pattern ids the draft clearly exhibits, and which high-value ones it's missing.
4) CORRECTNESS (X-native, not spelling/grammar — the browser already does those): problems objectively wrong FOR X or for the writer's own goal — an unsupported factual/number claim needing a source, a hook that promises something the body doesn't deliver, or a clear self-contradiction. For each, the EXACT "quote", its "index", a short "issue", a grounded "why", optional "fix". Skip entirely if nothing is genuinely wrong — do not invent problems.
5) NEXT STEP: the single highest-leverage move toward making the core idea land harder — forward-looking, not a fix to an existing span. A short imperative "label" and a one-line "detail" that names the draft's specific content. Omit if the draft is already strong.
6) Calibration-only "voice_score" (0-100 vs their voice) and "resemblance_score" (0-100 vs their winners) — these tune the live score, not shown directly.

BUDGET: across voice drifts + algorithm + correctness COMBINED, return at most ${budget} findings, ordered by expected impact (biggest lever first). This cap is a ceiling, not a quota — a solid draft deserves 0-1 findings, and ZERO findings is a normal, valid answer. Never pad to the limit; when in doubt, leave it out. If genuinely improving the draft would mean rewriting more than about a third of it, do NOT deliver that as piecewise span fixes — return only the single most important finding and describe the bigger reshape in the NEXT STEP instead.

Rules for every finding:
- THE EDITOR TEST: emit a finding only if a sharp human editor who understood this post's point would make that exact note. If the note could be pasted under any post ("hook is weak", "be more specific", "add a call to action"), it is generic filler — cut it.
- Serve the idea: flag only what blurs, buries, or undercuts the core idea. A line that is fine FOR THE IDEA is fine — do not flag a reasonable phrasing just because it could be worded differently, and never flag text that already matches the user's voice.
- "issue": max 8 words, naming the problem in THIS draft. "why": max 18 words and it must reference the draft's specific content or core idea — never abstract writing advice.
- Fixes must sound like the writer, not like AI copy: reuse their words, rhythm, and every concrete number, name, and detail. NEVER introduce: "Here's the thing/truth/kicker", "Most people think X, but Y", chains of punchy em-dash fragments, rhetorical-question hooks the writer doesn't use, or hype adjectives. If you cannot write a fix that genuinely sounds like them, omit the fix and keep the finding.
- An algorithm "fix" must stay in the user's voice and keep the idea's specifics — never trade either for reach. Do not flag something you would "fix" to an equivalent phrasing — that just reverses the writer's edits.`;

/** Single-object JSON output (the non-streaming fallback path). */
const instructionsJSON = (budget: number) => `${taskFor(budget)}

Return ONLY valid JSON in this exact shape:
{
  "core_idea": "one sentence: the single idea this post delivers",
  "voice_score": 0,
  "voice_deviations": [{"quote": "exact substring", "index": 0, "issue": "what drifts", "why": "grounded reason", "fix": "rewrite of just that span"}],
  "algorithm_issues": [{"quote": "exact substring", "index": 0, "issue": "where it loses reach", "why": "the ranking mechanism", "fix": "optional rewrite"}],
  "correctness_issues": [{"quote": "exact substring", "index": 0, "issue": "what's wrong for X", "why": "grounded reason", "fix": "optional rewrite"}],
  "resemblance_score": 0,
  "matched_pattern_ids": ["ids the draft exhibits"],
  "missing_pattern_ids": ["high-value ids it's missing"],
  "next_edit": {"label": "imperative next step", "detail": "one line on how/why"},
  "summary": "one sentence: the single biggest lever"
}`;

/** Newline-delimited JSON output (the streaming path): one compact object per
 *  line so the client can render each finding the moment it arrives. */
const instructionsNDJSON = (budget: number) => `${taskFor(budget)}

Return ONLY newline-delimited JSON (NDJSON): one compact JSON object per line — no array, no wrapping object, no prose, no code fences. Emit the "idea" line FIRST, then each finding on its own line AS SOON AS you identify it, in roughly this order, omitting any line that doesn't apply:
{"t":"idea","text":"one sentence: the single idea this post delivers"}
{"t":"score","voice":0,"resemblance":0}
{"t":"voice","quote":"exact substring","index":0,"issue":"what drifts","why":"grounded reason","fix":"rewrite of just that span"}
{"t":"algo","quote":"exact substring","index":0,"issue":"where it loses reach","why":"the ranking mechanism","fix":"optional rewrite"}
{"t":"correct","quote":"exact substring","index":0,"issue":"what's wrong for X","why":"grounded reason","fix":"optional rewrite"}
{"t":"pattern","id":"a missing high-value pattern id"}
{"t":"matched","ids":["pattern ids the draft exhibits"]}
{"t":"next","label":"imperative next step","detail":"one line on how/why"}
{"t":"summary","text":"one sentence: the single biggest lever"}`;

/**
 * Prime the Anthropic prompt cache for a user's static grounding so the next real
 * live read is a fast cache-read instead of paying the full input cost. One tiny
 * Haiku call (1 output token) writes the cached prefix; cheap + unmetered, fired
 * from the client on first settle. Best-effort — failures are silent.
 */
export async function warmLiveRead(
  supabase: SupabaseClient,
  userId: string,
  voiceType: "post" | "reply" = "post"
): Promise<void> {
  try {
    const { provider, groundingBase } = await assembleLiveRead(supabase, userId, voiceType);
    await createChatCompletion({
      provider,
      modelTier: "cheap",
      messages: [{ role: "user", content: "ready" }],
      // Prime the NDJSON (streaming) prefix — that's what real reads use. The
      // budget varies by draft length; warm the common short-post bucket (and
      // caching is a measured no-op for short-form anyway — see assembleLiveRead).
      cachePrefix: `${groundingBase}\n\n${instructionsNDJSON(findingBudget(280))}`,
      temperature: 0,
      maxTokens: 1,
      jsonResponse: false,
      route: "live-read-warm",
      userId,
    });
  } catch (e) {
    console.error("warmLiveRead failed:", e);
  }
}

export async function runLiveRead(
  supabase: SupabaseClient,
  userId: string,
  draftText: string,
  voiceType: "post" | "reply" = "post",
  options: LiveReadOptions = {}
): Promise<AssistantFindings> {
  const draft_hash = createHash("sha256").update(draftCacheInput(draftText, options.parentText)).digest("hex");

  // ── Read-first cache: identical draft → skip the model entirely. Keyed by
  // draft text only (not session context) — a cached result that predates a
  // ledger entry can contain contradictions, which the client-side
  // contradictsSettled filter hides. ─────────────────────────────────────────
  const cached = await supabase
    .from("assistant_live_reads")
    .select("result")
    .eq("user_id", userId)
    .eq("draft_hash", draft_hash)
    .eq("voice_type", voiceType)
    .maybeSingle();
  if (cached.data?.result) {
    return cached.data.result as AssistantFindings;
  }

  const { provider, groundingBase, byId, poolSize } = await assembleLiveRead(
    supabase,
    userId,
    voiceType
  );

  const budget = findingBudget(draftText.length);

  // A failed or unparseable read must THROW, not degrade to an empty result:
  // persisting a default-shaped result would poison the read-first cache — every
  // future read of this exact draft would be a cache hit on nothing.
  const result = await createChatCompletion({
    provider,
    // The cheap/Haiku tier: this is a constrained extraction over context we
    // fully supply, so it doesn't need the standard (Sonnet) tier — and on a
    // live, on-pause loop, latency is the dominant constraint.
    modelTier: "cheap",
    messages: [
      {
        role: "user",
        content: `${sessionSection(options.sessionEdits, options.declined, options.coreIdea)}${parentSection(options.parentText)}=== THE DRAFT ===\n"""\n${draftText}\n"""\n\nReturn ONLY the JSON object described above, for this draft.`,
      },
    ],
    cachePrefix: `${groundingBase}\n\n${instructionsJSON(budget)}`,
    temperature: 0.2,
    // gpt-oss (Cerebras/Groq) is a reasoning model: its hidden chain-of-thought
    // spends from this same budget BEFORE any content. 950 was fully consumed by
    // reasoning (finish_reason "length", content null) — keep effort low and the
    // budget high enough for reasoning + the full JSON. Claude ignores both knobs
    // beyond the output cap.
    maxTokens: 2000,
    reasoningEffort: "low",
    jsonResponse: false,
    route: "live-read",
    userId,
  });
  const m = (result.content || "").match(/\{[\s\S]*\}/);
  if (!m) throw new Error("Live read: model returned no parseable JSON");
  const parsed = JSON.parse(m[0]) as LiveJudgeResponse;

  const voice_score = clamp(Number(parsed.voice_score), 70);
  const resemblance_score = clamp(Number(parsed.resemblance_score), 50);

  // Map deviations → anchored voice findings. Resolve the verbatim quote to
  // offsets here, biased by the model's approximate `index` so a repeated phrase
  // anchors to the intended occurrence; an unfound quote keeps the card but loses
  // the underline.
  const voiceAll: Finding[] = (parsed.voice_deviations || [])
    .slice(0, 4)
    .map((d, i) =>
      toAnchoredFinding(d, draftText, "voice", "voice", i, {
        severity: "warning",
        title: "Drifts from your voice",
        why: "This doesn't match how you usually write.",
        signal: "voice_drift",
      })
    );

  // Algorithm findings — where the draft loses reach given how X ranks (weak
  // hook, no reply-driver, vague where specific wins). Class "reach" so they
  // join the deterministic reach findings in one section, and deduct from the
  // Algorithm sub-score while open (score.ts).
  const reachAll: Finding[] = (parsed.algorithm_issues || [])
    .slice(0, 3)
    .map((d, i) =>
      toAnchoredFinding(d, draftText, "reach", "algo", i, {
        severity: "warning",
        title: "Will lose reach",
        why: "Given how X ranks, this line costs the post distribution.",
        signal: "algorithm_fit",
      })
    );

  // X-native correctness — claim hygiene, hook/body mismatch, contradiction. Not
  // spelling/grammar (the browser already does that). Anchored like voice findings.
  const correctnessAll: Finding[] = (parsed.correctness_issues || [])
    .slice(0, 3)
    .map((d, i) =>
      toAnchoredFinding(d, draftText, "correctness", "correctness", i, {
        severity: "problem",
        title: "Reads as incorrect for X",
        why: "This is likely to read as wrong or unsupported on X.",
        signal: "correctness",
      })
    );

  // Server-side backstop for the global budget the prompt asks for — a model
  // that pads past it gets trimmed by class severity: correctness (states
  // facts) survives first, then voice, then reach.
  let remaining = budget;
  const take = (arr: Finding[]) => {
    const t = arr.slice(0, Math.max(0, remaining));
    remaining -= t.length;
    return t;
  };
  const correctness_findings = take(correctnessAll);
  const voice_findings = take(voiceAll);
  const reach_findings = take(reachAll);

  // Missing high-lift patterns → suggestion chips (multiplier > 1 only). Two,
  // not three: chips stack on top of findings + next step, and the panel was
  // still overwhelming at three.
  const missing_pattern_chips: SuggestionChip[] = (parsed.missing_pattern_ids || [])
    .map((id) => byId.get(String(id)))
    .filter((p): p is PoolPattern => Boolean(p) && (Number(p!.multiplier) || 1) > 1)
    .sort((a, b) => (Number(b.multiplier) || 1) - (Number(a.multiplier) || 1))
    .slice(0, 2)
    .map((p) => ({
      id: `pat:${p.id}`,
      kind: "missing_pattern" as const,
      label: p.pattern_name || "Add a proven pattern",
      detail: `≈${(Number(p.multiplier) || 1).toFixed(1)}× — ${p.pattern_value || ""}`.trim(),
      multiplier: Number(p.multiplier) || 1,
    }));

  const summary = String(parsed.summary || "");
  const next_edit =
    parsed.next_edit && String(parsed.next_edit.label || "").trim()
      ? { label: String(parsed.next_edit.label).trim(), detail: String(parsed.next_edit.detail || "").trim() }
      : null;

  const findingsResult: AssistantFindings = {
    voice_findings,
    correctness_findings,
    reach_findings,
    missing_pattern_chips,
    next_edit,
    core_idea: String(parsed.core_idea || "").trim().slice(0, 200) || undefined,
    summary,
    voice_score,
  };

  const matchedIds = (parsed.matched_pattern_ids || []).map(String).filter((id) => byId.has(id));
  await persistLiveRead({
    supabase,
    userId,
    draftHash: draft_hash,
    voiceType,
    draftText,
    result: findingsResult,
    resemblanceScore: resemblance_score,
    matchedIds,
    poolSize,
    draftType: options.draftType,
  });

  return findingsResult;
}

/**
 * Best-effort persistence + calibration shared by the streaming and non-streaming
 * reads. Fully isolated (Promise.allSettled) so a write rejection can never turn a
 * successful read into a 500.
 */
async function persistLiveRead(args: {
  supabase: SupabaseClient;
  userId: string;
  draftHash: string;
  voiceType: "post" | "reply";
  draftText: string;
  result: AssistantFindings;
  resemblanceScore: number;
  matchedIds: string[];
  poolSize: number;
  draftType?: "X_POST" | "X_THREAD";
}): Promise<void> {
  const { supabase, userId, draftHash, voiceType, draftText, result } = args;
  await Promise.allSettled([
    supabase
      .from("assistant_live_reads")
      .upsert(
        { user_id: userId, draft_hash: draftHash, voice_type: voiceType, result },
        { onConflict: "user_id,draft_hash,voice_type" }
      )
      .then(({ error }) => error && console.error("live-read cache persist:", error.message)),
    supabase
      .from("voice_check_results")
      .insert({
        user_id: userId,
        draft_hash: draftHash,
        voice_type: voiceType,
        score: result.voice_score ?? 70,
        matches: [],
        deviations: result.voice_findings.map((f) => f.title),
        suggested_edit: null,
      })
      .then(({ error }) => error && console.error("live-read voice persist:", error.message)),
    supabase
      .from("prepublish_reads")
      .insert({
        user_id: userId,
        draft_hash: draftHash,
        draft_type: args.draftType || "X_POST",
        resemblance_score: args.resemblanceScore,
        confidence: args.poolSize >= 50 ? "high" : args.poolSize >= 15 ? "medium" : "low",
        algorithm_flags: [],
        matched_pattern_ids: args.matchedIds,
      })
      .then(({ error }) => error && console.error("live-read read persist:", error.message)),
  ]);

  // Feed the L2 calibration loop with this (draft, LLM voice score) pair. Runs its
  // own embedding; fire-and-forget so it never slows the read.
  void recordCalibrationSample(supabase, userId, draftText, result.voice_score ?? 70);
}

function clamp(n: number, fallback: number): number {
  if (!Number.isFinite(n)) return fallback;
  // Some models (gpt-oss on Cerebras/Groq) return scores on a 0-1 scale despite
  // the 0-100 spec; a raw 0.45 would round to 0 and poison the calibration loop.
  const scaled = n > 0 && n <= 1 ? n * 100 : n;
  return Math.max(0, Math.min(100, Math.round(scaled)));
}

// ── Streaming path ──────────────────────────────────────────────────────────
// Findings are rendered the moment the model emits them (NDJSON, one per line),
// instead of waiting for the whole response. The route relays these to the client
// as SSE; the client accumulates them into the same AssistantFindings shape.

export type LiveReadEvent =
  | { type: "full"; result: AssistantFindings } // whole result at once (cache hit / non-stream fallback)
  | { type: "idea"; coreIdea: string }
  | { type: "finding"; finding: Finding }
  | { type: "chip"; chip: SuggestionChip }
  | { type: "next"; nextStep: NextStep }
  | { type: "summary"; summary: string };

interface StreamAcc {
  voice_findings: Finding[];
  correctness_findings: Finding[];
  reach_findings: Finding[];
  chips: SuggestionChip[];
  next_edit: NextStep | null;
  core_idea: string;
  summary: string;
  voice_score: number;
  resemblance_score: number;
  matchedIds: string[];
  /** Lines that parsed as JSON at all — 0 after a full stream means the model
   *  emitted nothing usable (e.g. reasoning-only output); treat as failure. */
  parsedLines: number;
}

function patternChip(p: PoolPattern): SuggestionChip {
  return {
    id: `pat:${p.id}`,
    kind: "missing_pattern",
    label: p.pattern_name || "Add a proven pattern",
    detail: `≈${(Number(p.multiplier) || 1).toFixed(1)}× — ${p.pattern_value || ""}`.trim(),
    multiplier: Number(p.multiplier) || 1,
  };
}

/** Parse one NDJSON line, fold it into the accumulator, and return any client
 *  events it produced. Tolerant of malformed/partial lines (returns []). */
function applyLiveLine(
  line: string,
  draftText: string,
  byId: Map<string, PoolPattern>,
  acc: StreamAcc,
  budget: number
): LiveReadEvent[] {
  const t = line.trim();
  if (!t || t[0] !== "{") return [];
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(t);
  } catch {
    return [];
  }
  acc.parsedLines += 1;
  // Global budget backstop across the three finding classes (the model was
  // told the ceiling and to emit best-first, so first-come is highest-impact).
  const total = () =>
    acc.voice_findings.length + acc.reach_findings.length + acc.correctness_findings.length;
  const dev = obj as { quote?: string; issue?: string; why?: string; fix?: string; index?: number };
  switch (obj.t) {
    case "idea": {
      const idea = String((obj.text as string) || "").trim().slice(0, 200);
      if (!idea) return [];
      acc.core_idea = idea;
      return [{ type: "idea", coreIdea: idea }];
    }
    case "score":
      acc.voice_score = clamp(Number(obj.voice), 70);
      acc.resemblance_score = clamp(Number(obj.resemblance), 50);
      return [];
    case "voice": {
      if (acc.voice_findings.length >= 4 || total() >= budget) return [];
      const f = toAnchoredFinding(dev, draftText, "voice", "voice", acc.voice_findings.length, {
        severity: "warning",
        title: "Drifts from your voice",
        why: "This doesn't match how you usually write.",
        signal: "voice_drift",
      });
      acc.voice_findings.push(f);
      return [{ type: "finding", finding: f }];
    }
    case "algo": {
      if (acc.reach_findings.length >= 3 || total() >= budget) return [];
      const f = toAnchoredFinding(dev, draftText, "reach", "algo", acc.reach_findings.length, {
        severity: "warning",
        title: "Will lose reach",
        why: "Given how X ranks, this line costs the post distribution.",
        signal: "algorithm_fit",
      });
      acc.reach_findings.push(f);
      return [{ type: "finding", finding: f }];
    }
    case "correct": {
      if (acc.correctness_findings.length >= 3 || total() >= budget) return [];
      const f = toAnchoredFinding(dev, draftText, "correctness", "correctness", acc.correctness_findings.length, {
        severity: "problem",
        title: "Reads as incorrect for X",
        why: "This is likely to read as wrong or unsupported on X.",
        signal: "correctness",
      });
      acc.correctness_findings.push(f);
      return [{ type: "finding", finding: f }];
    }
    case "pattern": {
      if (acc.chips.length >= 2) return [];
      const p = byId.get(String(obj.id));
      if (!p || (Number(p.multiplier) || 1) <= 1) return [];
      if (acc.chips.some((c) => c.id === `pat:${p.id}`)) return [];
      const chip = patternChip(p);
      acc.chips.push(chip);
      return [{ type: "chip", chip }];
    }
    case "matched":
      if (Array.isArray(obj.ids)) acc.matchedIds.push(...obj.ids.map(String).filter((id) => byId.has(id)));
      return [];
    case "next": {
      const label = String((obj.label as string) || "").trim();
      if (!label) return [];
      acc.next_edit = { label, detail: String((obj.detail as string) || "").trim() };
      return [{ type: "next", nextStep: acc.next_edit }];
    }
    case "summary": {
      acc.summary = String((obj.text as string) || "");
      return acc.summary ? [{ type: "summary", summary: acc.summary }] : [];
    }
    default:
      return [];
  }
}

/**
 * Streaming live read — yields findings as the model emits them (NDJSON), then
 * persists/caches the assembled result. Read-first cache and non-Claude providers
 * short-circuit to a single `full` event.
 */
export async function* runLiveReadStream(
  supabase: SupabaseClient,
  userId: string,
  draftText: string,
  voiceType: "post" | "reply" = "post",
  options: LiveReadOptions = {}
): AsyncGenerator<LiveReadEvent> {
  const draft_hash = createHash("sha256").update(draftCacheInput(draftText, options.parentText)).digest("hex");

  const cached = await supabase
    .from("assistant_live_reads")
    .select("result")
    .eq("user_id", userId)
    .eq("draft_hash", draft_hash)
    .eq("voice_type", voiceType)
    .maybeSingle();
  if (cached.data?.result) {
    yield { type: "full", result: cached.data.result as AssistantFindings };
    return;
  }

  const { provider, groundingBase, byId, poolSize } = await assembleLiveRead(supabase, userId, voiceType);

  // Providers we can't stream (e.g. grok) fall back to the one-shot read.
  if (!STREAMABLE_PROVIDERS.has(provider)) {
    const result = await runLiveRead(supabase, userId, draftText, voiceType, options);
    yield { type: "full", result };
    return;
  }

  const acc: StreamAcc = {
    voice_findings: [],
    correctness_findings: [],
    reach_findings: [],
    chips: [],
    next_edit: null,
    core_idea: "",
    summary: "",
    voice_score: 70,
    resemblance_score: 50,
    matchedIds: [],
    parsedLines: 0,
  };

  const budget = findingBudget(draftText.length);

  let buffer = "";
  try {
    for await (const chunk of streamText({
      provider,
      modelTier: "cheap",
      cachePrefix: `${groundingBase}\n\n${instructionsNDJSON(budget)}`,
      messages: [
        {
          role: "user",
          content: `${sessionSection(options.sessionEdits, options.declined, options.coreIdea)}${parentSection(options.parentText)}=== THE DRAFT ===\n"""\n${draftText}\n"""\n\nReturn the NDJSON lines described above for this draft.`,
        },
      ],
      temperature: 0.2,
      // See the one-shot call: gpt-oss reasons from this same budget before any
      // content; low effort + headroom or the stream ends with zero NDJSON lines.
      maxTokens: 2000,
      reasoningEffort: "low",
      route: "live-read",
      userId,
    })) {
      buffer += chunk;
      let nl: number;
      while ((nl = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 1);
        for (const ev of applyLiveLine(line, draftText, byId, acc, budget)) yield ev;
      }
    }
    if (buffer.trim()) {
      for (const ev of applyLiveLine(buffer, draftText, byId, acc, budget)) yield ev;
    }
  } catch (e) {
    // Degradation must never poison the cache: a read that died mid-stream is
    // NOT authoritative for this draft_hash, so skip persistence entirely and
    // rethrow — the route relays a `type:"error"` event and the client knows not
    // to cache the partial findings it already rendered.
    console.error("Live read stream failed:", e);
    throw e instanceof Error ? e : new Error(String(e));
  }

  // A stream that "succeeded" without one parseable NDJSON line is a failure in
  // disguise (seen live: gpt-oss spent the whole token budget on reasoning and
  // emitted no content). Never persist it — that would cache an empty read for
  // this draft forever.
  if (acc.parsedLines === 0) {
    throw new Error("Live read stream produced no parseable output");
  }

  const result: AssistantFindings = {
    voice_findings: acc.voice_findings,
    correctness_findings: acc.correctness_findings,
    reach_findings: acc.reach_findings,
    missing_pattern_chips: acc.chips,
    next_edit: acc.next_edit,
    core_idea: acc.core_idea || undefined,
    summary: acc.summary,
    voice_score: acc.voice_score,
  };
  await persistLiveRead({
    supabase,
    userId,
    draftHash: draft_hash,
    voiceType,
    draftText,
    result,
    resemblanceScore: acc.resemblance_score,
    matchedIds: acc.matchedIds,
    poolSize,
    draftType: options.draftType,
  });
}
