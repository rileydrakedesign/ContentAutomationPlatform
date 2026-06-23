# Getting started with the v1 API

The Agents For X REST API lets you generate, draft, check, schedule, and publish
X content in your voice, read your analytics, and manage patterns, inspiration,
niche, and strategy — programmatically.

## 1. Get an API key

In the app, go to **Settings → API Keys** and create a key. It is shown **once**
and looks like:

```
sk_live_AbC123...
```

Grant it the [scopes](authentication.md#scopes) the integration needs. Keep the
key secret — it authenticates as your account and spends your credits.

## 2. Base URL

```
https://app.agentsforx.com/api/v1
```

All paths in the docs are relative to this base (e.g. `GET /health`).

## 3. Authenticate

Send the key as a Bearer token on every request:

```
Authorization: Bearer sk_live_...
```

## 4. Your first request

`GET /health` is unauthenticated, but if you pass a key it echoes the key's
scopes and rate limit — the quickest way to confirm your key works:

```bash
curl https://app.agentsforx.com/api/v1/health \
  -H "Authorization: Bearer sk_live_..."
```

```json
{
  "status": "ok",
  "version": "1.0.0",
  "authenticated": true,
  "scopes": ["drafts:read", "drafts:write", "publish:write"],
  "rate_limit": 60
}
```

Then confirm identity, X connection, and credit balance with `GET /me`:

```bash
curl https://app.agentsforx.com/api/v1/me \
  -H "Authorization: Bearer sk_live_..."
```

## 5. The OpenAPI spec & interactive reference

- **Machine-readable spec:** `GET /api/v1/openapi.json` (OpenAPI 3.1).
- **Interactive reference:** browse and try endpoints at **`/developers`**
  (rendered with Scalar from that spec).

The spec is the source of truth for request fields, response shapes, credit
costs (`x-credits`), and required scopes (`x-required-scopes`). A repo test keeps
it in sync with the actual routes.

## 6. A real workflow

The canonical loop — **generate (or write) → voice-check → publish** — is shown
end-to-end with curl, JavaScript, and Python in [examples.md](examples.md).

## Next

- [authentication.md](authentication.md) — keys, scopes, and the two credential types
- [credits.md](credits.md) — what each call costs and how 402s work
- [errors.md](errors.md) — error shape, status codes, rate limits
- [examples.md](examples.md) — copy-paste requests
- [../mcp/overview.md](../mcp/overview.md) — use it from an AI agent instead
