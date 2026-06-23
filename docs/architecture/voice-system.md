# The voice system

The product's core promise is that everything you write **sounds like you** and
matches **what performs for your account**. That comes from one idea: a single
**tuned voice context** assembled per voice type and reused everywhere.

## One assembled context, two voices

There are two voices — `post` and `reply` — each with its own settings and
examples. For any generation or voice-check, the engine assembles one canonical
system prompt for that voice via
[`getAssembledPromptForUser`](../../src/lib/openai/prompts/prompt-assembler.ts).
The same assembled prompt drives the web app, `POST /drafts/generate`,
`POST /voice/check`, and the MCP `get_writing_context` tool — so a draft written
by an agent is judged against exactly the context it was written from.

## What goes into the prompt

The assembler composes these sections (token-budgeted; see `TokenBreakdown` in
[`src/types/voice.ts`](../../src/types/voice.ts)):

1. **Neutral base prompt** — platform-agnostic writing instructions. Style rules
   that used to be hardcoded now live as editable **guardrails**.
2. **Voice controls** — the dials and modes from `UserVoiceSettings`:
   `optimization_authenticity`, `tone_formal_casual`, `energy_calm_punchy`,
   `stance_neutral_opinionated` (0-100), plus length/directness/humor/emoji/
   question-rate/disagreement modes, and `guardrails` (avoid words/topics, custom
   rules) and `special_notes`.
3. **Your content niche** — niche summary + **positioning** (target audience,
   unique angle, positioning statement) when `use_niche_context` is on.
4. **Proven patterns** — patterns extracted from the user's highest-performing
   posts, with an engagement multiplier, applied "where natural, never force."
   Only **generation-applicable** (content-shaping) patterns are injected:
   timing, post-type (single vs. thread), and visual/media patterns are real
   findings but not things the writer controls, so they are filtered out of
   generation by `isGenerationApplicablePattern`
   ([`src/lib/analysis/pattern-applicability.ts`](../../src/lib/analysis/pattern-applicability.ts)).
   They remain visible in the Voice Report as insight. See [patterns.md](../guides/patterns.md).
5. **Real writing examples** — the user's top posts/replies for this voice
   (`UserVoiceExample`), selected by engagement and pins.
6. **Inspiration** — saved posts the user wants to emulate, after analysis.
7. **Feedback** — like/dislike signal from `send_feedback` / the feedback endpoint.

This is the "one tuned context, one currency" cohesiveness the product is built
around — the same context is referenced by generation, checking, and the
write-it-yourself path rather than being re-derived per surface.

## Writing: generate vs. write-it-yourself

- **Write it yourself (free):** `GET /voice/context` (MCP `get_writing_context`)
  returns the assembled `system_prompt`, the platform `rules`, and
  `context_freshness`. The caller's model writes the content directly. Preferred —
  it's free and usually higher quality. (The legacy top-level `patterns` array is
  deprecated in favor of the PROVEN PATTERNS section and flagged
  `patterns_deprecated: true`.)
- **Server-side (3 credits):** `POST /drafts/generate` runs the platform's model
  with the same context.

## Voice-check: the tuner

`POST /voice/check` (MCP `check_draft`, 3 credits) scores a draft 0-100 against
the tuned voice and proven patterns, returning what matches, where it deviates,
and a suggested edit. This is the feedback loop that tightens drafts before they
ship. See [../guides/voice-tuneup.md](../guides/voice-tuneup.md).

The same [`runVoiceCheck`](../../src/lib/analysis/voice-check.ts) core powers all
surfaces. **Voice-check is offered everywhere but never required to publish.**
Every publish surface presents two clearly-labeled actions: a direct **Post** /
**Schedule** / **Post reply** that ships immediately, and a secondary
**Voice-check first** / **Voice-check & reply** that runs the 3-credit check and
surfaces the score before the user ships. This holds for the draft editor, the
`/reply` flow, the create composer's inline `VoiceCheckPanel`, and the Chrome
extension's reply picker (`voice_type: "reply"`). Applying the suggested edit is
one click everywhere it appears.

`isVoiceCheckSurfaced` ([`src/lib/voice/publish-gate.ts`](../../src/lib/voice/publish-gate.ts))
is retained only as an *informational hint* ("you've already checked this exact
text") — it no longer blocks publishing. On the agent surfaces, `check_draft`
stays a separate tool from `publish_*`; calling it is optional.

Generation feedback closes the loop legibly: the 👍/👎 captured on generated
drafts nudges the next prompt (via the assembler's feedback section) **and** is
rendered back in the Voice Report ("steering toward / away from"), so you can see
your feedback shaping what gets generated.

## Freshness & re-tuning

[`getContextFreshness`](../../src/lib/analysis/freshness.ts) compares the tuned
context against the latest analytics; if components are stale it sets
`retune_recommended: true` (surfaced by `whoami` and `get_writing_context`).
Running **`run_tuneup`** (`POST /insights/tuneup`, 5 credits) refreshes examples,
re-extracts patterns, and re-analyzes niche & positioning, returning the Voice
Report. See [../guides/voice-tuneup.md](../guides/voice-tuneup.md) and
[patterns.md](../guides/patterns.md).
