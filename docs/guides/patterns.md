# Guide: Patterns

**Proven patterns** are recurring traits of your highest-performing posts — hooks,
formats, topics, engagement triggers — each with an **engagement multiplier**
(performance vs. your average). They're how generation is steered toward what
actually works for *your* account.

## Where patterns come from

Patterns are extracted from your top posts during a [Voice Tune-Up](voice-tuneup.md)
(`run_tuneup`) and stored with an `extraction_batch` so history is non-destructive
— a new extraction adds a batch rather than wiping the old one. Pattern extraction
is a **Pro** feature.

## Listing & curating

- **List:** `GET /patterns` (MCP `list_patterns`, free). Returns patterns ordered
  by multiplier, each with `pattern_type`, `pattern_name`, `pattern_value`,
  `multiplier`, `confidence_score`, `is_enabled`, and `extraction_batch`. Filter
  by `type` or `enabled_only`.
- **Enable / disable / rename:** `PATCH /patterns/{id}` (MCP `toggle_pattern`,
  free) with `is_enabled` and/or `pattern_name`. Disabled patterns are **not**
  applied during generation.

## How patterns steer generation

- In the **assembled voice context**, enabled patterns appear in the
  **PROVEN PATTERNS** section ("apply where natural, never force"), so both
  write-it-yourself (`get_writing_context`) and server-side `generate_*` see them.
- For server-side generation you can also pass specific `patternIds` to
  `POST /drafts/generate` (MCP `generate_post`'s `patternIds`) to apply a chosen
  subset; with none passed, the top enabled patterns are used. **Selected**
  patterns are prioritized over the default top set in the prompt.

## Generation-applicable vs. insight-only patterns

Not every real pattern is something the *text* model controls. **Timing**
("Evening Posts"), **post-type** ("Single Post", "Thread Format"), and
**visual/media** patterns ("Add an image") are genuine findings about what
performs — but post time is scheduling, post type is your format choice, and
visuals are media attachments. Injecting them into generation pollutes output.

A single canonical helper,
[`isGenerationApplicablePattern`](../../src/lib/analysis/pattern-applicability.ts),
decides whether a pattern shapes content text. It excludes `timing` always, plus
post-type and visual/media patterns (matched by type + a name/value keyword
guard, since "Single Post" and "Numbered Lists" are both `format`). The decision
is computed once at extraction time and persisted on
`extracted_patterns.applies_to_generation`; the runtime helper is the fallback
for already-stored rows.

The filter is applied in **all** generation paths — the `/create` pattern
selector, `POST /drafts/generate-from-topic` (default + explicit selection), and
the prompt assembler's PROVEN PATTERNS section — so a timing/post-type/visual
pattern is **never** applied to a generated post.

It is **not** hidden from the Voice Report: insight-only patterns still appear
there (labeled "insight only"), because they're real findings worth seeing — the
exclusion is specifically about *applying* them to generation.

## Practical tips

- Disable patterns that don't reflect the voice you want going forward — they stop
  influencing generation immediately.
- Re-run `run_tuneup` after meaningful new posts to refresh multipliers and pick
  up new patterns.
- High `multiplier` + high `confidence_score` patterns are the safest to lean on.

## Patterns as insight at the moment of writing

In the web composer (`/create`), patterns are not just name+multiplier chips: the
selected patterns are shown with their **actual content** (`pattern_value`) and
their **engagement lift**, highest-leverage first — so you see *what* a pattern is
and *why* it works before you generate. Each generated option then lists the
**patterns applied** to it, so the connection between "what works for you" and the
draft in front of you is never hidden. This is the same intelligence agents get
from `get_writing_context` / `list_patterns`, surfaced at the point of action.

See [voice-system.md](../architecture/voice-system.md) for how patterns sit in the
assembled prompt.
