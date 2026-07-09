# Notes for the next /design-sync run

The design-system checker in the design project repeatedly flags two issues that
originate in the compiled `_ds_bundle.css` (read-only in the design project — they
must be fixed here, at sync time):

1. **35 unclassifiable tokens** — all Tailwind v4 build internals:
   `--tw-*`, `--animate-spin`, `--animate-pulse`, `--ease-in-out`,
   `--default-transition-duration`, `--default-transition-timing-function`, etc.
2. **36 custom properties under component-style selectors** — Tailwind utility
   plumbing like `--tw-space-y-reverse` declared inside rules such as
   `:where(& > :not(:last-child))`.

## Requested fix (preferred)

Exclude the Tailwind-internal namespaces from token extraction entirely:
`--tw-*`, `--animate-*`, `--ease-*`, `--default-transition-*`.
They are build artifacts, not authored design tokens.

## Alternative

Emit `/* @kind other */` after each such declaration so they register as
intentionally uncategorized.

## Judgment call

If easing/duration should be real motion tokens, keep `--ease-in-out` and
`--default-transition-*` and annotate them `/* @kind other */` instead of
excluding them.
