# design-sync notes — content-automation

This repo is a **Next.js app**, not a packaged component library. The sync runs in **package shape, synth-entry mode** (no `dist/`, no built `.d.ts`). The scoped design system is a curated subset of `src/components/`.

## How this sync is wired (read before re-syncing)

- **Bundle entry is a hand-written barrel**: `.design-sync/ds-entry.tsx` re-exports ONLY the curated components. This is required — the default synth entry does `export * from` every `src/` file, which pulls server actions / Supabase / Stripe / Node code into the browser IIFE and fails to bundle. Pass it via `--entry ./.design-sync/ds-entry.tsx`. **When adding a component to `componentSrcMap`, also add its export to the barrel**, or it won't be on `window.ContentAutomation`.
- **`@/` aliases** resolve through `.design-sync/sync-tsconfig.json` (`cfg.tsconfig`), which sets `baseUrl: ".."` so `@/*` → repo `src/*` from inside `.design-sync/`.
  - The path plugin matches a bare directory import before `/index.ts`, so directory imports need an **exact** mapping listed BEFORE `@/*`. Today: `@/lib/analysis/assistant` → its `index.ts` (used by ScoreDial). Add similar exact entries if a new component imports a directory via `@/`.
- **CSS is pre-compiled**: `.design-sync/compile-css.mjs` runs the repo's Tailwind v4 (`@tailwindcss/postcss`) over `src/app/globals.css` → `.design-sync/compiled.css` (`cfg.cssEntry`). The converter only copies CSS; it can't run Tailwind. **Re-run `node .design-sync/compile-css.mjs` whenever component class usage or globals.css tokens change**, then rebuild.
- **Real prop contracts** come from `cfg.dtsPropsFor` (hand-written, since there's no built `.d.ts`). Keep these in sync with the source interfaces when a component's props change.
- **Grouping**: ui primitives land under group `general` (their `ui/` dir is a generic container name); ScoreDial under `assistant`. Cosmetic only. To regroup, add `cfg.docsMap.<Name>` stubs with `category:` frontmatter.

## Browser / render check

- Playwright 1.61.1 installed in `.ds-sync/node_modules`; needs **both** `chromium` and `chromium-headless-shell` (validate uses the headless shell — `npx playwright install chromium-headless-shell`).

## Known render warns (triaged — not new on re-sync)

- `[TOKENS_MISSING]` (~15 vars: `--container-max`, `--color-border`, `--color-bg-card`, `--color-bg-default`, `--color-bg-primary/secondary/tertiary`, …). **Inert.** These belong to utility classes used by OTHER app components that Tailwind's full-repo scan emitted into `compiled.css`; the 11 synced components don't use them. Non-blocking.
- `[GRID_OVERFLOW]` resolved via `cfg.overrides`: ScoreDial + Tabs use `cardMode: "column"`.

## Fonts

- Brand fonts (Space Grotesk / DM Sans / Geist Mono) are injected by Next.js `next/font` at runtime via CSS vars (`--font-space-grotesk`, etc.) and are **not shipped**. Components fall back to `system-ui` and render correctly. If brand fonts are ever wanted in the bundle, wire `cfg.extraFonts` or `cfg.runtimeFontPrefixes`.

## Scope

- Synced so far (solo wave): Button, IconButton, Card, Badge, StatusBadge, TypeBadge, Tabs, Input, Textarea, SliderDial, ScoreDial.
- **Deferred display-card wave** (need setup before they render statically):
  - `next/link`-dependent (UpgradePrompt, many `home/` cards): add a `next/link` (+ `next/image`, `next/navigation`) shim mapping in `sync-tsconfig.json` pointing at a tiny anchor stub.
  - Provider-dependent (`AiUsageCounter` → `useSubscription`): set `cfg.provider` to `SubscriptionProvider` (re-export it via the barrel + componentSrcMap).
  - Data-fetching cards (BoostOpportunitiesCard, NextBestAction, VoiceHealthCard, OutcomeAttributionCard, HomePage — anything importing `@/lib/utils/apiFetch`): render loading/empty statically. Author previews with mocked props or skip.
  - Good static-friendly next candidates (props-driven): ConsistencyTracker, TopPostsCard, StrategyProgress, QuickActionsBar, SetupChecklist, ApprovedReadyCard, DraftsToReviewCard, SavedInspirationCard (most use `next/link` → need the shim).

## Re-sync risks (what can silently go stale)

- **`cfg.dtsPropsFor`** is hand-maintained — if a source component's props change, the shipped `.d.ts` won't reflect it until updated here. No automated check.
- **`compiled.css`** is a build artifact checked in implicitly via `cssEntry`; if globals.css tokens change and `compile-css.mjs` isn't re-run, the shipped CSS drifts from source.
- **Barrel/`componentSrcMap` drift**: a component in `componentSrcMap` but missing from `ds-entry.tsx` builds a card whose component isn't on the global → renders blank.
- Previews import lucide icons; the per-preview esbuild bundle of `lucide-react` is slow (~minutes cold) — builds with previews can exceed a 2-min foreground timeout. Run them backgrounded.
