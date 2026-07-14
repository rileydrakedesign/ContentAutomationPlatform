# MCP & Public API — Source of Truth

> The agent/integration surface: a hosted **MCP server** (33 tools) and a **public v1 REST API**, both over one backend with shared scopes, rate limits, and credit metering. **Status (2026-06-26): live in production.** Both transports ship from `registerTools()`; the OpenAPI spec is drift-tested against the route tree. **Replies are handoff-only on this surface** (§2).
>
> User-facing guides already exist and are maintained — **do not duplicate them here.** REST: [`docs/api/`](../api/getting-started.md). MCP: [`docs/mcp/`](../mcp/overview.md). Generated per-tool reference: [`docs/mcp/tools.generated.md`](../mcp/tools.generated.md). This doc is the engineering index that ties the surface to the code.

---

## 1. Role — one backend, three surfaces

The product is reachable three ways over **one** backend, **one** credit currency, and **one** scope set (`docs/README.md`):

- **Web app** (session cookie / Supabase auth).
- **v1 REST API** — `/api/v1/*`, API-key auth (`sk_live_...`).
- **MCP server** for AI agents — a stdio npm package (API key) and a hosted streamable-HTTP gateway (OAuth 2.1).

The MCP tool layer is a **thin wrapper over the REST API**: each tool maps to exactly one v1 endpoint via a shared HTTP client (`mcp/src/tools.ts:6`). So REST is the real contract; MCP is a typed, instruction-steered front door onto it. Whatever scopes, rate limits, and credit charges apply to a REST route apply identically to the MCP tool that calls it.

---

## 2. MCP server

### Architecture (transport-agnostic core)

The MCP code lives in `mcp/` and is built so the **same tool layer serves two transports**:

| File | Role |
| --- | --- |
| `mcp/src/tools.ts` | `registerTools(server, api)` — all 33 Zod tool defs. No transport assumptions; each tool calls one REST endpoint via `ApiClient`. |
| `mcp/src/client.ts` | `ApiClient` — HTTP client: bearer auth, 30s timeout, retries/backoff, 429 handling, credit-header capture (`x-credits-charged` / `-remaining`, `client.ts:172`), typed `ApiError` + actionable hints (`client.ts:43`). No MCP imports. |
| `mcp/src/server.ts` | `buildServer()` — constructs `McpServer` with `INSTRUCTIONS` + `registerTools`. |
| `mcp/src/stdio.ts` | stdio entrypoint (npm package). Reads `CONTENT_API_KEY` / `CONTENT_API_URL`; startup health ping. |
| `src/app/api/v1/mcp/route.ts` | **Hosted gateway** — streamable-HTTP, OAuth 2.1. Imports the *same* `registerTools` from `mcp/src/tools.ts` (`route.ts:17`). |

Both transports register the identical set, so the tool list, inputs, costs, and behavior are guaranteed to match (`mcp/README.md:93`, `docs/mcp/overview.md` "Two transports, one tool set").

**Hosted-gateway wiring detail:** `registerTools` binds one `ApiClient` at registration time, but each HTTP request carries its own OAuth token. The gateway bridges this with `AsyncLocalStorage` — an ALS proxy delegates every call to a per-request client created from the caller's bearer token (`src/app/api/v1/mcp/route.ts:31-55`, `:102-107`). Retries on writes are deliberately **not** blind: a POST that times out may have published, so the client surfaces the ambiguity instead of double-posting (`mcp/src/client.ts:121-123`).

### The philosophy: `get_writing_context` → you write → `check_draft`

The server's `INSTRUCTIONS` (`mcp/src/server.ts`) are the product's editorial stance, in priority order. The tour they open with is **`get_writing_context` → `check_draft` → `find_reply_posts`**:

1. **Write it yourself (preferred, free):** `get_writing_context` returns the user's assembled voice system prompt + proven patterns + platform rules; the agent writes the post/reply directly. "You are the best available writer; this is free."
2. **Generation only seeds a draft (3 credits):** `generate_post` / `generate_reply` run the platform's server-side model with the same voice context — described as "seed a draft you'll edit," to be used only if the agent cannot write directly.
3. **Tune the draft (3 credits):** `check_draft` scores 0-100 against the tuned voice + patterns, returns what matches / where it deviates / a suggested edit; iterate before saving or publishing.
4. **Reply by handoff, never by publish:** `find_reply_posts` surfaces repliable targets; the agent appends `&text=<url-encoded reply>` to the target's `intent_url` and gives the user the link. There is **no reply-publish tool** (§2, "Replies are handoff-only").
5. **Re-analyze when stale (5 credits):** `whoami` / `get_writing_context` return `context_freshness`; when `retune_recommended` is true, suggest `run_tuneup` (freshness assembled in `src/app/api/v1/me/route.ts:34-61`).
6. **Publish an original post only after explicit user confirmation** — irreversible and public.

This get-context → write → check loop is the assistant model; generation is a backstop.

### Replies are handoff-only (C1 audit, closed 2026-07)

Programmatic replies are outside what the product will do (X's Feb-2026 rules), so the reply path on this surface is a **handoff**, not a publish:

- **`publish_reply` was removed** from the MCP catalog.
- **`POST /api/v1/publish/now` with `contentType: "X_REPLY"` returns `410 Gone`** with `code: "deprecated"` — the check runs **before** the token lookup, the daily cap, and the credit debit, so a deprecated call never charges (`src/app/api/v1/publish/now/route.ts:30-48`). `X_REPLY` is still *recognized* so old callers get a purposeful 410 instead of a validation error.
- **`GET /api/v1/search/reply-targets`** (MCP `find_reply_posts`) returns, per target, **`post_url`** (permalink) and **`intent_url`** (`https://x.com/intent/post?in_reply_to=<id>`, `src/lib/x-api/search-mapping.ts:138-141`). Callers append `&text=<url-encoded reply>` and open it: X's composer opens pre-filled and the **human** sends it.
- Both schedule routes already rejected replies.

### Tool catalog (33 tools, grouped as in `tools.ts`)

Identity/config: `whoami`, `health`, `get_credits`, `get_voice_settings`, `update_voice_settings`, `get_niche`. Generation/tuning: `get_writing_context`, `check_draft`, `run_tuneup`, `generate_post`, `generate_reply`, `send_feedback`. Drafts: `list_drafts`, `get_draft`, `create_draft`, `update_draft`, `delete_draft`. Publishing: `publish_post`, `publish_thread`, `schedule_post`. Queue: `list_queue`, `cancel_scheduled`, `list_published`. Analysis: `get_analytics`, `get_best_times`, `sync_analytics`, `get_tweet`, `search_tweets`, `find_reply_posts`. Patterns/inspiration: `list_patterns`, `toggle_pattern`, `list_inspiration`, `add_inspiration`.

> **No strategy tools.** `get_strategy` / `update_strategy` were removed with the 2026-07 slim; the weekly strategy is edited in the app (Settings → Strategy) and still feeds every assembled prompt. The v1 REST route `GET/PUT /strategy` and the `strategy:read` / `strategy:write` scopes remain.

> **Do not document tool inputs/types/costs here.** That reference is **generated** from the Zod schemas via `cd mcp && npm run gen-docs` (generator: `mcp/src/tool-doc-gen.ts`) into [`docs/mcp/tools.generated.md`](../mcp/tools.generated.md) — **never hand-edit it.** A narrative tour is in [`docs/mcp/tools.md`](../mcp/tools.md).

---

## 3. Public v1 REST API

All routes live under `src/app/api/v1/`. Every route is wrapped by `withApiAuth(requiredScopes, handler)` (`src/lib/api/v1-handler.ts:22`), which does auth → per-key rate limit → per-user + global aggregate limits → handler → error mapping. Metered routes charge via `requireCredits()` and stamp credit headers via `withCreditHeaders()` (`src/lib/billing/credits.ts:248`, `:268`).

### Route map by domain (scope · credits · plan gate)

| Domain | Route(s) | Methods | Scope | Credits | Notes |
| --- | --- | --- | --- | --- | --- |
| Health | `/health` | GET | none | free | Auth optional; echoes key scopes + rate limit |
| Account | `/me` | GET | none | free | Identity, X connection health, credits, `context_freshness` |
| Drafts | `/drafts`, `/drafts/{id}` | GET/POST/PATCH/DELETE | `drafts:read` / `drafts:write` | free | |
| Generation | `/drafts/generate` | POST | `drafts:generate` | 3 | Daily generate cap (`checkDailyActionCap`) |
| Voice | `/voice` | GET/PATCH | `voice:read` / `voice:write` | free | tone/energy/stance dials, guardrails |
| Voice | `/voice/context` | GET | `voice:read` | free | Assembled writing prompt (powers `get_writing_context`) |
| Voice | `/voice/check` | POST | **`voice:read`** | 3 | Note: read-scope, not write |
| Insights | `/insights/tuneup` | POST | `voice:write` | 5 | Full re-analysis → Voice Report |
| Publishing | `/publish/now` | POST | `publish:write` | 3 / 30·url | `X_POST` / `X_THREAD` only. Daily publish cap; partial-thread refund + `x_partial_thread`. **`X_REPLY` → 410 `deprecated`** (before any debit) |
| Publishing | `/publish/schedule` | POST | `publish:write` | 3 / 30·url | **Pro plan** (`plan_limit`); debit at schedule, refund on cancel |
| Publishing | `/publish` | GET | `publish:read` | free | Scheduled-post history (all states) |
| Queue | `/queue`, `/queue/{id}` | GET/DELETE | `publish:read` / `publish:write` | free | Cancel refunds |
| Analytics | `/analytics`, `/analytics/best-times` | GET | `analytics:read` | 1 | |
| Analytics | `/analytics/sync` | POST | `analytics:read` | 15 | **Pro plan**; delta timeline sync |
| Tweets | `/tweets/{id}` | GET | `analytics:read` | 1 | Fetch tweet by id/URL |
| Search | `/search`, `/search/reply-targets` | GET | `search:read` | 1·per-post (min 5) | **Pro plan**; charges per post X returns. Reply targets carry `post_url` + `intent_url` (handoff) |
| Patterns | `/patterns`, `/patterns/{id}` | GET/PATCH | `patterns:read` / `patterns:write` | free | |
| Inspiration | `/inspiration`, `/inspiration/{id}` | GET/POST/DELETE | `inspiration:read` / `inspiration:write` | 3 on create | Auto-analyzed in background |
| Niche | `/niche` | GET | `niche:read` | free | |
| Strategy | `/strategy` | GET/PUT | `strategy:read` / `strategy:write` | free | PUT replaces stored strategy. **No MCP tool** — edited in-app (Settings → Strategy) |
| Feedback | `/feedback` | POST | `drafts:write` | free | like/dislike on generations |

Two routes under `/api/v1` are **not** part of the REST contract and are excluded from the drift test: `/openapi.json` (serves the spec) and `/mcp` (the OAuth gateway, §4) — see `src/lib/api/openapi-spec.test.ts:21`.

### OpenAPI: single source of truth + drift test

- **Spec source:** `src/lib/api/openapi-spec.ts` (~53 KB, OpenAPI 3.1, hand-authored). Each operation carries `x-required-scopes` and `x-credits` extensions.
- **Served at:** `GET /api/v1/openapi.json` (`src/app/api/v1/openapi.json/route.ts`).
- **Rendered at:** `/developers` — a standalone Scalar HTML page (route handler, **not** a React page, so it lives outside the auth shell; allowlisted public in `src/proxy.ts`) loading `/api/v1/openapi.json` with a self-hosted bundle from `/developers/scalar` (`src/app/developers/route.ts:14-47`).
- **Drift guard:** `src/lib/api/openapi-spec.test.ts` asserts the set of `METHOD /path` pairs in the spec **equals** the implemented route tree under `src/app/api/v1` — adding/removing a route without updating the spec fails the test (`:73-83`). It is structural (path+method), not a per-field diff.

---

## 4. Auth, scopes, OAuth, API keys

### Two credential types, one shape

`validateApiKey()` (`src/lib/api/auth.ts:35`) accepts two bearer kinds and resolves both to the same `ApiKeyInfo` `{ userId, keyId, scopes, rateLimit }`:

1. **`sk_live_...` API keys** — REST API + stdio MCP package. SHA-256 hashed at rest; looked up in `api_keys` (checks `revoked_at` / `expires_at`, bumps `last_used_at`) (`auth.ts:67-98`). Generated by `generateApiKey()` (`auth.ts:18`); created in Settings → API Keys with chosen scopes.
2. **`mcp_at_...` OAuth access tokens** — hosted MCP gateway only. Validated via `validateOAuthBearer()`; rate limit derived from the user's plan since OAuth tokens have no per-key row (`auth.ts:47-63`).

### Scopes

The 16 scopes are defined once in `src/lib/api/scopes.ts` (`ALLOWED_SCOPES`) and consumed everywhere: per-route `withApiAuth([...])`, the OAuth consent screen labels (`src/app/oauth/authorize/page.tsx:11-28`), and both `/.well-known` metadata docs. `requireApiAuth` enforces *all* required scopes are present, else 403 `forbidden` listing the missing ones (`auth.ts:124-131`).

### OAuth 2.1 (hosted MCP gateway)

Standards-compliant public-client flow (PKCE + dynamic client registration), so claude.ai / Claude Code can connect with no key handling:

- **Discovery:** `/.well-known/oauth-authorization-server` (RFC 8414) and `/.well-known/oauth-protected-resource` (RFC 9728) — the gateway 401 carries `WWW-Authenticate` pointing at the latter (`src/app/api/v1/mcp/route.ts:74-96`).
- **Registration:** `POST /api/oauth/register` (RFC 7591) — open but IP rate-limited; public clients only (`token_endpoint_auth_method: none`); https or localhost redirect URIs (`src/app/api/oauth/register/route.ts`).
- **Authorize:** `/oauth/authorize` — logged-in user consent screen; mints a PKCE-bound authorization code (`src/app/oauth/authorize/page.tsx`).
- **Token:** `POST /api/oauth/token` — `authorization_code` (PKCE-verified, single-use) and rotating `refresh_token` grants (`src/app/api/oauth/token/route.ts`).
- The gateway accepts **only** `mcp_at_` tokens; API keys are rejected there by design (`mcp/route.ts:74-91`).

---

## 5. Metering (credits) on this surface

The single source of truth is `src/lib/billing/credits.ts`. `CREDIT_COSTS` (`:11`) prices every metered action (1 credit = $0.01): generate 3, voice.check 3, tuneup 5, publish.tweet 3, **publish.tweet_with_url 30** (X bills link posts ~10–13×), tweets.read 1, search.per_post 1, analytics.read 1, analytics.sync 15, inspiration.create 3.

- **URL detection** (`containsUrl`, `:64`) decides the 3-vs-30 publish price via a TLD allowlist (`LINKED_TLDS`) so `node.js` / `e.g.` don't false-trigger.
- **Charge flow:** `requireCredits()` debits (allowance bucket first, then non-expiring packs) and returns a ready-made 402 `INSUFFICIENT_CREDITS` (with balance + top-up URL) when short (`:248-265`). Headers `X-Credits-Charged` / `X-Credits-Remaining` are stamped by `withCreditHeaders()` and read back by the MCP client into its `credits:` trailer.
- **Refunds:** failed external calls refund to the **allowance** bucket only (never packs — prevents schedule+cancel laundering expiring credits) (`refundCredits`, `:144`). Publish refunds the un-posted remainder of a partial thread (`src/app/api/v1/publish/now/route.ts:188-194`).
- **Daily caps** (`checkDailyActionCap`, `:213`) are an abuse backstop on top of credits for publish/generate, counted from today's ledger debits → 429 `daily_cap`.
- **Plan allowances** (README): Free 100 / Pro 2,000 / Agent 7,500 monthly credits, reset on the billing anniversary. Plan resolution: `effectivePlan()` (`:92`).

Per-action pricing for end users lives in [`docs/api/credits.md`](../api/credits.md); do not restate it here.

---

## 6. Pivot alignment

`server.ts` centers the **assistant loop** — `get_writing_context` (free, agent writes) → `check_draft` (tune) → `find_reply_posts` (where the growth is) — over server-side generation, whose tools are described as seeding "a draft you'll edit." This matches the product pivot toward a writing assistant.

**Catalog reframed (2026-07):** the tool grouping and framing now foreground the write→check loop — the generation section comment is retitled *"Writing & voice-check (the write → check loop)"*, and the vestigial `ai_model` input (OpenAI/Claude/Grok) was removed from `update_voice_settings` after the model picker was retired app-wide (Claude is baked). The surviving tool *names* (`generate_post`, `generate_reply`, `publish_post`, `publish_thread`) are unchanged on purpose — they are stable public API / OAuth-scope identifiers, so generation is subordinated via grouping, ordering, and description weighting rather than renames.

**Catalog slimmed (2026-07): 36 → 33 tools.** Removed exactly three: `publish_reply` (replies are handoff-only), `get_strategy` and `update_strategy` (strategy is edited in the app; the REST route and scopes remain).

---

## 7. Key files

| Path | Role |
| --- | --- |
| `mcp/src/server.ts` | MCP server build + `INSTRUCTIONS` (the philosophy) |
| `mcp/src/tools.ts` | 33 tool defs (Zod) → one REST endpoint each |
| `mcp/src/client.ts` | Transport-agnostic HTTP client (auth, retries, credit headers) |
| `mcp/src/stdio.ts` | stdio npm-package entrypoint |
| `mcp/src/tool-doc-gen.ts` | Generates `docs/mcp/tools.generated.md` (`npm run gen-docs`) |
| `src/app/api/v1/*/route.ts` | The REST handlers (one per resource) |
| `src/app/api/v1/mcp/route.ts` | Hosted MCP gateway (OAuth, streamable HTTP) |
| `src/lib/api/v1-handler.ts` | `withApiAuth` — auth + rate limit + error mapping |
| `src/lib/api/auth.ts` | Key/token validation, scope enforcement |
| `src/lib/api/scopes.ts` | `ALLOWED_SCOPES` (the 16 scopes) |
| `src/lib/api/limiter*.ts`, `rate-limit.ts` | Per-key / per-user / global tenant-fair limits |
| `src/lib/api/openapi-spec.ts` | OpenAPI 3.1 spec (source of truth) |
| `src/lib/api/openapi-spec.test.ts` | Spec↔route drift guard |
| `src/lib/billing/credits.ts` | `CREDIT_COSTS`, debit/refund, caps, headers |
| `src/app/api/oauth/*`, `src/app/oauth/authorize/page.tsx` | OAuth register / token / consent |
| `src/app/.well-known/oauth-*` | OAuth discovery metadata |
| `src/app/developers/route.ts` | Public Scalar API reference page |

**Pointers:** MCP guides → [`docs/mcp/`](../mcp/overview.md). REST guides → [`docs/api/`](../api/getting-started.md). Generated tool reference → [`docs/mcp/tools.generated.md`](../mcp/tools.generated.md).

---

## 8. Current state & gaps

- **Live & parity-guaranteed.** stdio package + hosted gateway share `registerTools`; spec↔route drift is test-enforced. Scopes, rate limits, and credit metering apply identically across all three surfaces.
- **Manual sync points (no test enforces these):**
  - `CREDIT_COSTS` (`credits.ts`) vs. the per-tool prices written into tool descriptions (`tools.ts`) and the OpenAPI `x-credits` extensions — three hand-maintained copies of the same numbers.
  - `docs/mcp/tools.generated.md` must be regenerated (`npm run gen-docs`) after any `tools.ts` change, or the published reference drifts. A locally-installed `@agentsforx/mcp` can also lag the hosted gateway until upgraded.
- **Catalog framing reframed and slimmed to 33** (§6): grouping/descriptions foreground the write→check loop, the dead `ai_model` input was removed, and `publish_reply` / `get_strategy` / `update_strategy` are gone. Surviving tool *names* intentionally unchanged (stable public API / OAuth identifiers).
- **Deprecated-but-recognized surface:** `POST /publish/now` still accepts `contentType: "X_REPLY"` in its parser purely to return a 410 `deprecated`. It is in the OpenAPI spec as such — do not "fix" it by re-adding a reply path.
- **Scope nuance to watch:** `/voice/check` requires `voice:read` (not `voice:write`) — intentional (checking doesn't mutate) but easy to misjudge when granting keys.

---

## 9. Related docs

- MCP overview & transports: [`docs/mcp/overview.md`](../mcp/overview.md) · setup [`docs/mcp/setup.md`](../mcp/setup.md) · workflows [`docs/mcp/workflows.md`](../mcp/workflows.md) · generated reference [`docs/mcp/tools.generated.md`](../mcp/tools.generated.md)
- REST getting started: [`docs/api/getting-started.md`](../api/getting-started.md) · auth & scopes [`docs/api/authentication.md`](../api/authentication.md) · credits [`docs/api/credits.md`](../api/credits.md) · errors [`docs/api/errors.md`](../api/errors.md) · examples [`docs/api/examples.md`](../api/examples.md)
- Architecture: [`docs/architecture/overview.md`](../architecture/overview.md) · the loop & cross-surface parity [`docs/architecture/loop.md`](../architecture/loop.md)
- Package README: [`mcp/README.md`](../../mcp/README.md)
