# Product Docs

The product definition layer — *what* we're building and *why*.

| Doc | Purpose |
|---|---|
| [prd.md](prd.md) | **Master PRD** — the canonical product definition (assistant-primary). Start here. |
| [product-features.md](product-features.md) | Current-state catalog of everything the product does today, with status flags. |

## Related

- **Strategy, positioning, ICP, copy** → [`research/`](../../research/README.md). Maintained
  separately; the PRD inherits its category, wedge, and ICP from there.
- **Engineering source-of-truth per subsystem** → [`../features/`](../features/README.md).
- **Pivot design rationale (historical)** → the three pivot specs at **repo root**:
  `GRAMMARLY_PIVOT_PLAN.md`, `GRAMMARLY_PIVOT_UX.md`,
  `GRAMMARLY_ASSISTANT_ARCHITECTURE_HANDOFF.md`.
  > These remain at repo root because `research/` references them by that path. They capture
  > the *original design intent* of the Grammarly pivot. **Caveat:** the architecture
  > handoff's "bugs / TODO" list is now **stale** — that work shipped. For current reality,
  > trust [prd.md](prd.md) and the [feature docs](../features/README.md).
