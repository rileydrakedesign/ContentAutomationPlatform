# Guide: Inspiration

The inspiration library is a set of posts you want to learn from. Each saved post
is **auto-analyzed** for its voice and format, and that analysis feeds into the
[assembled voice context](../architecture/voice-system.md) so generation can adapt
(not copy) styles you admire.

## Saving inspiration

- **API:** `POST /inspiration` (scope `inspiration:write`, **3 credits**).
- **MCP:** `add_inspiration`.

Body: `content` (required, the post text), optional `url` (deduplicated —
re-saving the same URL returns `409`), `authorHandle`, `metrics`,
`post_timestamp`. The response is created with `analysis_status: pending`; the
voice/format analysis runs in the **background**.

## Reading the library

- **API:** `GET /inspiration` (scope `inspiration:read`, free) → `{ inspiration: [...] }`.
- **MCP:** `list_inspiration`.

Poll the list for `analysis_status: completed` to see the analysis. The analysis
shape (`voice_analysis`, `format_analysis`) is in
[reference/data-models.md](../reference/data-models.md#inspirationpost).

## Deleting

`DELETE /inspiration/{id}` (scope `inspiration:write`, free).

## How it influences generation

Once analyzed, inspiration contributes to the **inspiration** section of the
assembled prompt (token-budgeted via `max_inspiration_tokens` in voice settings).
You can also pass a one-off `inspirationPost` to `POST /drafts/generate` (MCP
`generate_post`'s `inspiration`) to adapt a single post's style for that
generation only — adapt, never copy.

## Tips

- Save posts that exemplify a hook or structure you want more of, not random
  viral posts off-niche.
- A `run_tuneup` reports **inspiration alignment** — whether your saved
  inspiration matches your niche; prune the ones that don't.
