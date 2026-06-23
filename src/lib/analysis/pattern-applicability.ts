/**
 * Pattern applicability — the single canonical notion of which extracted
 * patterns the *text generation model* can actually act on.
 *
 * Some patterns are real, insightful findings about what performs for a user
 * but are NOT things the writer controls:
 *   - timing ("Evening Posts")          → scheduling, not text
 *   - post-type formats ("Single Post",  → the user's format choice
 *     "Thread Format", "3 posts long")
 *   - visual/media ("Add an image")      → media attachments, not text
 *
 * Injecting those as "PROVEN PATTERNS — apply where natural" pollutes
 * generation and produces weird output. This helper decides, for a given
 * pattern, whether it should be *applied to generation*. It does NOT decide
 * whether to *display* the pattern — the Voice Report still shows all patterns
 * as insight (see handoff item #2.3).
 *
 * `pattern_type` alone can't separate "Single Post" (post type) from "Numbered
 * Lists" (structure) — both are `format`. So we use type + a name/value keyword
 * guard. The decision can also be persisted at extraction time
 * (`applies_to_generation` column); this runtime helper is the fallback for
 * already-stored rows and the source of truth at extraction time.
 */

export interface ApplicabilityPattern {
  pattern_type?: string | null;
  pattern_name?: string | null;
  pattern_value?: string | null;
  /** When present (persisted at extraction time), it wins over the heuristic. */
  applies_to_generation?: boolean | null;
}

/** Pattern types that are never about the text the model writes. */
const NON_CONTENT_TYPES = new Set(["timing"]);

/**
 * Keyword guards for `format` (and any) patterns whose name/value describe a
 * post *type* the user chooses, not a structure the writer shapes.
 */
const POST_TYPE_KEYWORDS = [
  "single post",
  "single tweet",
  "thread format",
  "thread style",
  "post type",
  "posts long",
  "tweets long",
  "post length",
  "long-form",
  "longform",
  "short-form",
  "shortform",
  "carousel",
];

/** Keyword guards for visual / media patterns (media attachments, not text). */
const MEDIA_KEYWORDS = [
  "image",
  "photo",
  "video",
  "media",
  "visual",
  "screenshot",
  "screen shot",
  "gif",
  "graphic",
  "infographic",
  "meme",
  "thumbnail",
];

function matchesAny(haystack: string, needles: string[]): boolean {
  return needles.some((n) => haystack.includes(n));
}

/**
 * True when the pattern shapes the *content text* the model generates and so
 * should be injected into generation / voice-check prompts.
 *
 * Excludes: timing (always), post-type formats, and visual/media patterns.
 * Keeps: hook_style, engagement_trigger, topic, and structural `format`
 * patterns (e.g. "Numbered Lists", "Short paragraphs").
 */
export function isGenerationApplicablePattern(pattern: ApplicabilityPattern): boolean {
  // Persisted decision wins (computed once at extraction time).
  if (pattern.applies_to_generation === true) return true;
  if (pattern.applies_to_generation === false) return false;

  const type = (pattern.pattern_type ?? "").toLowerCase().trim();

  // Non-content pattern types are never applicable.
  if (NON_CONTENT_TYPES.has(type)) return false;

  const name = (pattern.pattern_name ?? "").toLowerCase();
  const value = (pattern.pattern_value ?? "").toLowerCase();
  const haystack = `${name} ${value}`;

  // Visual/media patterns are media attachments — never applicable.
  if (matchesAny(haystack, MEDIA_KEYWORDS)) return false;

  // Post-type formats are the user's format choice — never applicable.
  // (Guard the name primarily; a structural pattern's *value* may mention
  // "thread" incidentally, so weight the name match.)
  if (matchesAny(name, POST_TYPE_KEYWORDS)) return false;
  // Also catch "X posts long" / "thread format" phrasing in the value.
  if (matchesAny(value, ["posts long", "tweets long", "thread format", "single post"])) {
    return false;
  }

  return true;
}

/** Convenience: filter a list of patterns to the generation-applicable ones. */
export function filterGenerationApplicable<T extends ApplicabilityPattern>(patterns: T[]): T[] {
  return patterns.filter(isGenerationApplicablePattern);
}
