# Content Automation — design system conventions

A dark-themed React UI kit for an X (Twitter) writing-assistant product. Components are the app's real shipped code; compose them, don't reimplement them.

## Setup & wrapping

No theme provider is required — design tokens are plain CSS custom properties defined in `styles.css` (which `@import`s `_ds_bundle.css`). Link that one stylesheet and the tokens resolve.

These components are built for a **dark canvas**. Put screens on the base background or they'll look unstyled:

```jsx
<div style={{ background: "var(--color-bg-base)", minHeight: "100vh", color: "var(--color-text-primary)" }}>
  {/* your screen */}
</div>
```

Brand display fonts (Space Grotesk headings, DM Sans body) are loaded by the host app at runtime; absent them, the bundle falls back to `system-ui` and still renders correctly.

## Styling idiom — Tailwind v4 + CSS-var tokens

Style with **Tailwind utility classes**; reach for brand values through **arbitrary-value utilities backed by CSS-var tokens**, e.g. `className="bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] rounded-[var(--radius-lg)]"`. Every component also accepts `className` for your own layout glue. Use the real token names — don't invent hex values:

| Family | Tokens (real names) |
|---|---|
| Backgrounds | `--color-bg-base` (darkest), `--color-bg-surface`, `--color-bg-elevated`, `--color-bg-hover` |
| Text | `--color-text-primary`, `--color-text-secondary`, `--color-text-muted` |
| Brand | `--color-primary-50…700` (indigo), `--color-accent-400…600` (orange) |
| Status | `--color-success-*`, `--color-warning-*`, `--color-danger-*` |
| Borders | `--color-border-subtle`, `--color-border-default`, `--color-border-strong`, `--color-border-focus` |
| Radius | `--radius-sm/md/lg/xl/2xl/full` · Shadow `--shadow-sm/md/lg/xl`, `--shadow-glow-primary` |
| Spacing | `--space-1…12` · Fonts `--font-heading`, `--font-body`, `--font-mono` |

Prefer component props over restyling: `Button` takes `variant`/`size`/`loading`/`icon`/`glow`; `Badge` takes `variant`/`dot`; `Card` takes `hover`/`selected`/`glass`/`glow`.

## Where the truth lives

Read `styles.css` (and the `_ds_bundle.css` it imports) for the full token + utility set, and each component's `<Name>.d.ts` (the prop contract) and `<Name>.prompt.md` (usage) before building with it.

## Idiomatic snippet

```jsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Button, Badge } from "content-automation";

<div style={{ background: "var(--color-bg-base)", padding: 24 }}>
  <Card hover className="max-w-[420px]">
    <CardHeader action={<Badge variant="primary">Scheduled</Badge>}>
      <CardTitle>Morning thread</CardTitle>
      <CardDescription>Goes out tomorrow at 9:00 AM</CardDescription>
    </CardHeader>
    <CardContent>
      <p className="text-[var(--color-text-secondary)] text-sm">Optimize for replies, not likes.</p>
    </CardContent>
    <CardFooter>
      <Button size="sm">Edit</Button>
      <Button size="sm" variant="ghost">Preview</Button>
    </CardFooter>
  </Card>
</div>
```

Compounds compose explicitly: `Card` with `CardHeader/CardTitle/CardDescription/CardContent/CardFooter`; `Tabs` with `TabsList/TabsTrigger/TabsContent`.
