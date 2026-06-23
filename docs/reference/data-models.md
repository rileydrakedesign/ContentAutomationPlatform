# Data models

The core entities, sourced from [`src/types/`](../../src/types) and the v1 schema
([`src/lib/api/openapi-spec.ts`](../../src/lib/api/openapi-spec.ts)). Field names
are the API/JSON names. This is reference; for live request/response shapes use
`/developers` (the interactive spec).

## Draft

A saved unit of content. (`drafts` table; v1 `Draft` schema.)

| Field | Type | Notes |
| --- | --- | --- |
| `id` | uuid | |
| `user_id` | uuid | |
| `type` | `X_POST` \| `X_THREAD` | |
| `status` | `DRAFT` \| `SCHEDULED` \| `POSTED` \| `REJECTED` | |
| `content` | object | `X_POST`: `{ text }`; `X_THREAD`: `{ tweets: string[] }` |
| `edited_content` | object \| null | edited version stored separately |
| `topic` | string \| null | |
| `applied_patterns` | string[] | pattern IDs applied |
| `metadata` | object | e.g. `hook_type`, `voice_type`, reply info |
| `created_at` / `updated_at` | datetime | |

## ScheduledPost

A queued/published post (`scheduled_posts` table; v1 `ScheduledPost`). The
`GET /queue` item (`QueueItem`) is a ScheduledPost plus `draft_id`.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | uuid | |
| `content_type` | `X_POST` \| `X_THREAD` | |
| `scheduled_for` | datetime | |
| `status` | `scheduled` \| `publishing` \| `posted` \| `failed` \| `cancelled` | |
| `posted_post_ids` | string[] \| null | X IDs once posted |
| `error` | string \| null | |
| `payload` | object | the content to post |
| `created_at` | datetime | |
| `draft_id` | uuid \| null | *(QueueItem only)* source draft |

## VoiceSettings

Per-voice configuration (`UserVoiceSettings` in
[`src/types/voice.ts`](../../src/types/voice.ts)). One row per `voice_type`.

| Field | Type | Notes |
| --- | --- | --- |
| `voice_type` | `post` \| `reply` | |
| `length_mode` | `short` \| `medium` | |
| `directness_mode` | `soft` \| `neutral` \| `blunt` | |
| `humor_mode` | `off` \| `light` | |
| `emoji_mode` | `off` \| `on` | |
| `question_rate` | `low` \| `medium` | |
| `disagreement_mode` | `avoid` \| `allow_nuance` | |
| `optimization_authenticity` | int 0-100 | 0 authentic … 100 optimized |
| `tone_formal_casual` | int 0-100 | 0 formal … 100 casual |
| `energy_calm_punchy` | int 0-100 | 0 calm … 100 punchy |
| `stance_neutral_opinionated` | int 0-100 | 0 neutral … 100 opinionated |
| `guardrails` | object | `avoid_words[]`, `avoid_topics[]`, `custom_rules[]` |
| `special_notes` | string \| null | |
| `ai_model` | `openai` \| `claude` \| `grok` | provider for this voice |
| `use_niche_context` | boolean | include niche/positioning in the prompt |
| `max_example_tokens` | int | budget for voice examples |
| `max_inspiration_tokens` | int | budget for inspiration |
| `auto_refresh_enabled` | boolean | weekly example auto-refresh |
| `refresh_day_of_week` | int 0-6 | 0=Sunday |

Related: **VoiceExample** (`UserVoiceExample`) — `content_text`, `content_type`,
`source` (`auto`\|`pinned`), `is_excluded`, `pinned_rank`, `engagement_score`,
`token_count`.

## Pattern

A proven pattern (`extracted_patterns` table).

| Field | Type | Notes |
| --- | --- | --- |
| `id` | uuid | |
| `pattern_type` | string | hook / format / topic / trigger |
| `pattern_name` | string | editable label |
| `pattern_value` | string | the pattern itself |
| `multiplier` | number | engagement vs. the user's average |
| `confidence_score` | number | |
| `is_enabled` | boolean | applied during generation when true |
| `extraction_batch` | string | non-destructive history |
| `created_at` | datetime | |

## Inspiration

A saved post + style analysis (`InspirationPost` in
[`src/types/inspiration.ts`](../../src/types/inspiration.ts)).

| Field | Type | Notes |
| --- | --- | --- |
| `id` | uuid | |
| `raw_content` | string | the post text |
| `source_url` | string \| null | deduplicated |
| `author_handle` | string \| null | |
| `platform` | string | |
| `voice_analysis` | object \| null | `tone[]`, `sentenceStyle`, `vocabulary`, `perspective`, `patterns[]`, `signaturePhrases[]` |
| `format_analysis` | object \| null | `structure`, `length`, `lineBreakUsage`, `paragraphStyle`, `usesLists`, `openingStyle`, `closingStyle` |
| `analysis_status` | `pending` \| `analyzing` \| `completed` \| `failed` | |
| `created_at` / `updated_at` | datetime | |

## NicheProfile

Analyzed niche (`NicheProfile` in [`src/types/niche.ts`](../../src/types/niche.ts)).

| Field | Type | Notes |
| --- | --- | --- |
| `niche_summary` | string \| null | |
| `content_pillars` | string[] | |
| `topic_clusters` | TopicCluster[] | `name`, `keywords[]`, `post_count`, `avg_engagement`, `top_post_ids[]`, `share_pct` |
| `positioning` | object \| null | `target_audience`, `unique_angle`, `positioning_statement` |
| `last_analyzed_at` | datetime \| null | |
| `total_posts_analyzed` | int | |

## ContentStrategy

Weekly cadence (v1 `ContentStrategy`; defaults from the strategy route).

| Field | Type | Default |
| --- | --- | --- |
| `posts_per_week` | int ≥ 0 | 5 |
| `threads_per_week` | int ≥ 0 | 1 |
| `replies_per_week` | int ≥ 0 | 10 |
| `pillar_targets` | array of `{ pillar, posts_per_week }` | `[]` |

## Subscription & credits

Plans, limits, and credit packs live in
[`src/types/subscription.ts`](../../src/types/subscription.ts); see
[../api/credits.md](../api/credits.md) for the values.
