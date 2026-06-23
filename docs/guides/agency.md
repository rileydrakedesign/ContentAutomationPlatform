# Guide: Agency (multi-account)

The **Agency** tier lets one account manage **isolated voice profiles for many
clients** — a ghostwriter or small agency's #1 pain is voice drift across
clients, and that is exactly our wedge. Each client is a fully isolated voice:
their niche, patterns, examples, and analytics come only from *their* posts and
never bleed into another client's voice.

> Tier-gated: the Agency plan (`multiAccount` limit). Hidden until its Stripe
> price ID is configured. Available in the web app at **`/agency`**.

## How isolation works

Each client profile (`agency_clients` row) doubles as an isolated **data island**:
the client's voice settings, examples, extracted patterns, niche, and analytics
live in the same per-user tables as a normal account, keyed by the client's id.
Because every client has a distinct id, the entire single-account engine — the
[prompt assembler](../architecture/voice-system.md), [voice-check](../architecture/voice-system.md#voice-check-the-tuner),
and the [Voice Tune-Up](voice-tuneup.md) — is reused **unchanged** per client, and
voices structurally cannot cross. Cross-account access only ever happens through
the service role *after* an ownership check, so the normal single-account
isolation is never touched.

## Workflow

1. **Add a client** — `POST /api/agency/clients` (`{ client_name, client_handle? }`).
2. **Onboard their voice** — import the client's X analytics CSV
   (`POST /api/agency/clients/{id}/csv`), then run a per-client Voice Tune-Up
   (`POST /api/agency/clients/{id}/tuneup`). You get that client's own Voice
   Report — niche, positioning, and proven patterns mined from *their* top posts
   (with [provenance](patterns.md#patterns-as-insight-at-the-moment-of-writing)).
3. **Write & check in their voice** —
   `GET /api/agency/clients/{id}/context?type=post|reply` returns the assembled
   writing context for that client (write it yourself), and
   `POST /api/agency/clients/{id}/check` voice-checks a draft against *that*
   client's tuned voice.
4. **Govern** — set `approval_required` per client, and a `white_label` brand for
   that client's shared report. Remove a client with
   `DELETE /api/agency/clients/{id}` (purges their data island).

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/agency/clients` | List the client roster |
| POST | `/api/agency/clients` | Add a client |
| GET/PATCH/DELETE | `/api/agency/clients/{id}` | Read / update / delete a client |
| POST | `/api/agency/clients/{id}/csv` | Import the client's analytics CSV |
| POST | `/api/agency/clients/{id}/tuneup` | Per-client Voice Report |
| POST | `/api/agency/clients/{id}/check` | Voice-check in the client's voice |
| GET | `/api/agency/clients/{id}/context` | Assembled writing context for the client |

These are **web-app (session-auth) endpoints**, not part of the v1 agent API — the
agency surface is a human workflow.
