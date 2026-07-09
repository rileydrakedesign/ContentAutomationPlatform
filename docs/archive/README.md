# Archive

Superseded, historical, or pre-pivot documents. **Kept for provenance, not as current
truth.** Nothing here should be relied on for how the product works today — use the
[PRD](../product/prd.md) and [feature docs](../features/README.md) instead.

Archived in the 2026-06-26 docs cleanup (the "Grammarly pivot" doc reorg). All moved with
`git mv`, so history is preserved.

| File / dir | What it was | Superseded by |
|---|---|---|
| `PRD.md` | Original PRD (2026-03) — generation-primary | [docs/product/prd.md](../product/prd.md) |
| `PRODUCT_FEATURES.md` | Feature list (2026-03) | [docs/product/product-features.md](../product/product-features.md) |
| `agent-for-x/` | Early GTM + product-features (2026-02) | `research/` + product docs |
| `IMPLEMENTATION.md`, `project.md` | Early scaffolding notes (2026-02) | feature docs |
| `PHASE2_HANDOFF.md` | Phase-2 build handoff (2026-05) | shipped; feature docs |
| `HANDOFF_DASHBOARD_IMPROVEMENTS.md` | Dashboard work handoff (2026-06) | shipped |
| `BACKLOG.md` | Large pre-pivot backlog (2026-05) | re-scope post-pivot from PRD §11 |
| `SHIP_GATE.md` | Pre-pivot launch-readiness checklist (2026-06) | superseded by current state |
| `MCP_PROD_READINESS_PLAN.md`, `MCP_LAUNCH_HUMAN_TASKS.md`, `PUBLIC_API_AND_MCP_PLAN.md` | MCP/API launch plans | shipped; [docs/mcp](../mcp/), [docs/api](../api/), [mcp-and-public-api](../features/mcp-and-public-api.md) |
| `CHROME_EXTENSION_MARKETING.md`, `CHROME_EXTENSION_LISTING_COPY.md`, `CHROME_EXTENSION_COMPETITORS.md` | Extension marketing/listing/competitor copy | `research/marketing-positioning/` |
| `chrome_extension_addition.md` | Early extension notes (2026-01) | [chrome-extension](../features/chrome-extension.md) |
| `x_post_frameworks.md` | Post frameworks (2026-01) | `LLM-post-guidelines/` (live, prompt-referenced) |
| `design.md` | Old design system (2026-03, 37K) | `.interface-design/system.md` (current) |
| `railway_error.md` | One-off debug note | — |
| `refactoring/` | Old refactor notes (2026-01) | done |

## Not archived (intentionally kept where they are)

- **Root pivot specs** — `GRAMMARLY_PIVOT_PLAN.md`, `GRAMMARLY_PIVOT_UX.md`,
  `GRAMMARLY_ASSISTANT_ARCHITECTURE_HANDOFF.md`: still the design rationale of record, and
  `research/` links to them by repo-root path. (Their TODO lists are stale — that work
  shipped.) See [docs/product/README.md](../product/README.md).
- **`research/`** — maintained strategy/positioning/ICP; untouched.
- **`LLM-post-guidelines/`** — referenced by the prompt engine (`src/lib/openai/prompts/`); live.
- **`supabase/MIGRATIONS_TO_APPLY.md`** — operational, kept next to the migrations.
