# Handoff: GALLEY — Content Automation design-system restyle

> Pulled from the Claude Design project "Content Automation Design System"
> (design_handoff_galley/) on 2026-07-04. Reference spec — not production code.

## Overview

GALLEY is a complete visual re-foundation of the **content-automation** React library
(the X/Twitter writing-assistant product). Direction: "rooted in the history of writing" —
The Monospace Web as the aesthetic north star, iA Writer as the editor model, letterpress /
proofreading as the interaction vocabulary. Dark-only. The component **APIs do not change**;
only tokens and component styling do, plus one new pattern layer (proof-marks) and one
component re-cut (ScoreDial → proof grade).

The reference implementation of every component style is `galley.css` (in this folder).
Lift exact values from it.

## Design Tokens — drop-in values

Keep the existing token **names** (in `src/app/globals.css`); replace **values**.
Component code should compile untouched.

### Backgrounds (warm near-black "ink")
- `--color-bg-base: #0C0B09`
- `--color-bg-surface: #121110`
- `--color-bg-elevated: #191713`
- `--color-bg-hover: #242118`

### Text (unbleached "paper")
- `--color-text-primary: #EAE6DA`
- `--color-text-secondary: #A6A193`
- `--color-text-muted: #6F6B5F`

### Primary — paper (letterpress block buttons: paper background, ink text)
- `--color-primary-400: #FFFDF4` (hover)
- `--color-primary-500: #EAE6DA`
- `--color-primary-600: #D6D1C2`

### Accent — "rubric", the copyeditor's red pencil
- `--color-accent-400: #F0653D`
- `--color-accent-500: #E04B24`
- `--color-accent-600: #A53315`
- Red wash for backgrounds: `rgba(224,75,36,0.12)`

### Status
- `--color-success-500: #93AC7C` (sap green)
- `--color-warning-500: #D9A441` (ochre — also the "highlight/praise" ink)
- `--color-danger-500: #E04B24` (shares rubric)

### Borders ("rules")
- `--color-border-subtle: rgba(234,230,218,0.13)`
- `--color-border-default: rgba(234,230,218,0.24)`
- `--color-border-strong: rgba(234,230,218,0.42)`
- `--color-border-focus: #E04B24`

### Radius & shadow — abolished
- `--radius-sm` … `--radius-2xl`, `--radius-full`: **0px** (zero, don't delete)
- `--shadow-sm` … `--shadow-xl`, `--shadow-glow-*`: **none**

### Fonts
- `--font-heading`, `--font-body`, `--font-mono`:
  `"JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace`
  (Google Fonts; weights 400/500/700/800 + italic 400; `font-variant-ligatures: none`)
- **New token** `--font-writer: "iA Writer Quattro", ui-monospace, monospace` — the writing
  surface ONLY (editor body, draft previews, proof copy). iA Writer Quattro S is SIL-OFL,
  webfonts at github.com/iaolo/iA-Fonts (self-host the woff2 files; regular + italic).

## Layout System — the character grid

- Vertical unit **24px** (`--lh`). ALL margins/paddings/heights are multiples of 24px.
  Body text is 15px/24px.
- Horizontal unit **1ch** of 15px JetBrains Mono (≈9px). Gutters 1/2/3/4ch.
- Reading measure 56–64ch. The editor column is exactly **56ch**.
- Type scale (size/line): display 56/72 (masthead only) · numeral 44/48 (proof grades) ·
  editor 18/30 (Quattro) · base 15/24 · small 12/24 (labels, buttons, meta).
- Headings are **not bigger** — 15px bold UPPERCASE, letterspaced 0.14em, 2px top rule.

## Rules (depth system — replaces shadows)

- Double rule `3px double border-strong` — masthead / app-chrome ends
- Heavy rule `2px solid border-strong` — section heads
- Hairline `1px solid border-default` — cards, tables, dividers
- Dotted `1px dotted border-default` — card footers, tertiary separation
- Registration (crop) marks: 9×9px corner L-shapes in `--color-text-muted`, offset -5px,
  on at most one object per view (selected card / draft under review).

## Components — change notes (APIs unchanged; see galley.css for exact values)

- **Button** — 12px/24px bold uppercase, letterspacing 0.08em, padding `7px 2ch`.
  `primary`: paper bg (#EAE6DA), ink text, hover #FFFDF4. `secondary`: transparent, 1px
  border-strong. `ghost`: text-only, underline on hover. `danger`: rubric text + rubric-dim
  border, fills solid rubric on hover. All: **translateY(1px) while :active** (letterpress),
  color transitions 100ms linear, focus = 1px rubric outline offset 2px. `loading`: label +
  blinking block cursor `▌` (1s steps(1)), no spinner. `glow` prop renders identical to primary.
- **IconButton** — 32×32 square, 1px border-default, transparent; hover fills bg-hover.
- **Badge** — no pill, no background. Uppercase 12px wrapped in literal brackets `[draft]`
  (brackets in text-muted). Variant = text color: primary→paper bold, accent→rubric-bright,
  success→sap, warning→ochre, outline→paper-1.
- **StatusBadge** — 1px-bordered square chip, `7px square dot` + uppercase label:
  scheduled=ochre, posted=sap, rejected=rubric.
- **TypeBadge** — a "type sort": single glyph (T/R/Q) in a 28px square, 1px border-strong,
  bg-elevated, `inset 0 -2px 0 rgba(0,0,0,0.5)` (only inset shadows are permitted).
- **Card** — flat: 1px hairline border, bg-surface, radius 0, NO shadow. Footer separated by
  a dotted rule. Selected/hover use bg + border shifts, never elevation.
- **Input** — typewriter fill-in line: no box, transparent bg, 1px bottom rule only; focus
  brightens rule to paper; `caret-color: rubric`. Label above: 12px uppercase muted 0.12em.
- **Textarea** — boxed: 1px border-default, bg-surface. Char count right-aligned 12px muted.
- **SliderDial** — rule-and-sort: 1px track (border-strong), 9×17px square paper thumb, no
  fill, no glow. Value readout in brackets `[64]` in rubric-bright. End labels 12px muted.
- **Tabs** — newspaper section heads: 12px uppercase, inactive muted, active = paper bold +
  **2px rubric underline** on the 1px list rule. Counts in parentheses, muted.
- **ScoreDial → "proof grade"** — no circular dial. A bordered stamp: tiny uppercase
  `PROOF Nº <n>` on top, 44px/800 numeral, ruled-off uppercase verdict below. Bands: ≥90
  "Clean proof" · 60–89 "Light marks" · <60 "Foul proof" (border/numeral/verdict → rubric).
  `provisional/checking`: numeral 50% + blinking cursor. `errorCount` → "n marks" in verdict.

## New pattern layer — proof-marks (§07)

Assistant feedback renders as proofreader's marks on the text + a margin note. Not toasts.
- Strike (delete): `line-through` 1.5px rubric, struck text → text-secondary.
- Squiggle (reconsider): `underline wavy` rubric, offset 4px, `text-decoration-skip-ink: none`.
- Caret (insert): superscript red `^`; proposed text in rubric-bright.
- Highlight (praise): ochre wash `rgba(217,164,65,0.18)` — the ONLY non-red mark.
- Margin notes: 12px rubric-bright, superscript ref numerals (¹²³); note card bg-surface,
  1px subtle border + 2px rubric left rule (ochre for praise).
- Actions: `Accept` applies in place; `Stet` dismisses the mark. `remaining === 0` →
  proof "clean" → scheduling enabled.

## Editor (§08)

After iA Writer: full-bleed bg-base, chrome = two 12px hairline bars (top filename + proof
state; bottom char/sentence count + read time). Centered **56ch** column, iA Writer Quattro
18/30, **red block caret** (2px rubric, 1s steps(1) blink). Proof-marks render inline.

## Motion — mechanical, not organic

Button press 1px translateY instant (0ms) · state changes color/bg only 100ms linear (no
easing) · caret & loading 1s steps(1) blink · selection `::selection{background:rubric;color:ink-0}`.
**Forbidden**: glows, springs, parallax, scale transforms, drop shadows, gradients,
border-radius, spinners, skeleton shimmer.

## Suggested order of work

1. Apply the token values (globals.css — everything reskins at once).
2. Zero radii/shadows and swap fonts; fix visual fallout component by component (§06 notes).
3. Re-cut ScoreDial as the proof grade; flatten SliderDial; bracket the Badges.
4. Build the proof-marks pattern layer + editor treatment.
5. Re-run /design-sync (with NOTES-for-design-sync.md applied) to refresh the design project.
