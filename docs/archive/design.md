# Landing Page Design Guide

> Design specification for the Agents for X landing page.
> Derived from analysis of Tweet Hunter, SuperX, and PostOwl — three high-converting X/Twitter growth SaaS landing pages.
> **Grounded in the app's existing design system** to ensure brand continuity between landing page and product.

---

## 1. Aesthetic Direction

**Tone:** Dark-mode premium with electric accent energy.
All three reference sites use a dark-first palette with high-contrast accent colors. SuperX leans into a deep navy/black with yellow-gold accents. Tweet Hunter uses a near-black base with blue/purple highlights and bold CTAs. PostOwl pairs dark backgrounds with warm brand tones.

**Core Mood:** Confident, modern, creator-native. The page should feel like a tool built by someone who lives on X, not a generic SaaS template. Think "indie hacker premium" — polished but not corporate.

**Brand Continuity:** The landing page must feel like a natural extension of the app dashboard. Same Slate-900 darks, same Indigo primary, same font stack. When a user clicks "Get Started" and enters the app, the visual transition should be seamless — not jarring.

**Differentiation:** Unlike the reference sites which lean heavily on feature lists, our page should lead with the *agentic* angle — AI that acts on your behalf, not just assists.

---

## 2. Color System

All colors are pulled directly from the app's global CSS design tokens. The landing page introduces NO new brand colors — only landing-page-specific applications of existing tokens (glow effects, hero gradients, etc.).

```css
:root {
  /* =============================================
     CORE TOKENS — imported from app design system
     ============================================= */

  /* Background layers (darkest → lightest) */
  --color-bg-base: #020617;          /* Slate-950 — page background */
  --color-bg-surface: #0F172A;       /* Slate-900 — card/section backgrounds */
  --color-bg-elevated: #1E293B;      /* Slate-800 — elevated surfaces, hover states */
  --color-bg-hover: #334155;         /* Slate-700 — active/pressed states */

  /* Glass effects */
  --color-glass-subtle: rgba(255, 255, 255, 0.03);
  --color-glass-medium: rgba(255, 255, 255, 0.06);
  --color-glass-strong: rgba(255, 255, 255, 0.10);

  /* Borders */
  --color-border-subtle: rgba(255, 255, 255, 0.06);
  --color-border-default: rgba(255, 255, 255, 0.10);
  --color-border-strong: rgba(255, 255, 255, 0.15);
  --color-border-focus: #6366F1;

  /* Text */
  --color-text-primary: #F8FAFC;     /* Slate-50 — headings, primary body */
  --color-text-secondary: #94A3B8;   /* Slate-400 — descriptions, secondary copy */
  --color-text-muted: #64748B;       /* Slate-500 — captions, fine print */
  --color-text-inverse: #020617;     /* For text on accent-colored backgrounds */

  /* Primary — Indigo (dominant accent) */
  --color-primary-50: #EEF2FF;
  --color-primary-100: #E0E7FF;
  --color-primary-200: #C7D2FE;
  --color-primary-300: #A5B4FC;
  --color-primary-400: #818CF8;
  --color-primary-500: #6366F1;      /* Primary CTA, highlights, focus rings */
  --color-primary-600: #4F46E5;
  --color-primary-700: #4338CA;

  /* Accent — Orange (secondary accent, used sparingly) */
  --color-accent-400: #FB923C;
  --color-accent-500: #F97316;       /* Secondary highlights, badges, special callouts */
  --color-accent-600: #EA580C;

  /* Success — Green */
  --color-success-400: #4ADE80;
  --color-success-500: #22C55E;

  /* Shadows — from app design system */
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -2px rgba(0, 0, 0, 0.3);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -4px rgba(0, 0, 0, 0.4);
  --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.4);
  --shadow-glow-primary: 0 0 20px rgba(99, 102, 241, 0.3);
  --shadow-glow-accent: 0 0 20px rgba(249, 115, 22, 0.3);

  /* Radii — from app design system */
  --radius-sm: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;
  --radius-2xl: 1.5rem;
  --radius-full: 9999px;

  /* Transitions — from app design system */
  --transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-base: 200ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-slow: 300ms cubic-bezier(0.4, 0, 0.2, 1);

  /* =============================================
     LANDING PAGE EXTENSIONS
     New tokens that extend (not override) the
     app design system for marketing contexts.
     ============================================= */

  /* Hero gradients */
  --gradient-hero-bg: linear-gradient(
    180deg,
    #020617 0%,
    #0c1029 40%,
    #131337 60%,
    #0F172A 100%
  );
  --gradient-accent: linear-gradient(135deg, var(--color-primary-500), var(--color-primary-400));
  --gradient-accent-warm: linear-gradient(135deg, var(--color-primary-500), var(--color-accent-500));

  /* Glow tokens for landing page ambient effects */
  --glow-primary-soft: rgba(99, 102, 241, 0.08);
  --glow-primary-medium: rgba(99, 102, 241, 0.15);
  --glow-primary-strong: rgba(99, 102, 241, 0.25);
  --glow-accent-soft: rgba(249, 115, 22, 0.08);

  /* Landing page specific shadows */
  --shadow-hero-image: 0 25px 50px -12px rgba(0, 0, 0, 0.5),
                        0 0 60px var(--glow-primary-soft);
  --shadow-cta-glow: 0 4px 16px rgba(99, 102, 241, 0.3);
  --shadow-cta-glow-hover: 0 6px 24px rgba(99, 102, 241, 0.4);

  /* Landing page type scale extensions (hero/display sizes not needed in app) */
  --text-hero: clamp(3rem, 6vw, 5rem);
  --text-display: clamp(2rem, 4vw, 3.25rem);
  --text-feature-title: clamp(1.25rem, 2.5vw, 1.75rem);
}
```

**Color Usage Rules:**

- `--color-bg-base` (#020617) is the page background. No exceptions.
- `--color-bg-surface` (#0F172A) is for cards, testimonials, feature blocks, and any "raised" content area.
- `--color-bg-elevated` (#1E293B) is for inputs, hover states on cards, and the "popular" pricing tier.
- `--color-primary-500` (#6366F1) is the dominant accent. Used for primary CTAs, glow effects, active states, and key highlights. It should account for ~10% of the visual weight on any given viewport.
- `--color-accent-500` (#F97316) is the secondary accent. Used *very sparingly* — feature badges, special callouts, the gradient-text effect. Never for primary CTAs.
- The `gradient-text` effect from the app design system (Indigo → Orange) is available for hero headlines or section headers where extra visual punch is needed.
- Text hierarchy is enforced through the three text tiers: `--color-text-primary`, `--color-text-secondary`, `--color-text-muted`. Never use color to differentiate — use opacity/lightness.

---

## 3. Typography

The landing page uses the **exact same font stack** as the app dashboard. This ensures brand continuity.

**Font Stack (from app globals.css):**

| Role | Font | CSS Variable | Weight | Usage |
|------|------|-------------|--------|-------|
| Display / Headings | **Space Grotesk** | `var(--font-heading)` | 600–700 | Hero H1, section H2s, feature H3s |
| Body | **DM Sans** | `var(--font-body)` | 400–500 | Descriptions, paragraphs, nav links |
| Mono / Stats | **Geist Mono** | `var(--font-mono)` | 400 | Metrics, code snippets, stat callouts |

> **Note on font choice:** Space Grotesk is the app's heading font and must be used on the landing page for brand continuity. While some landing page guides recommend avoiding it, consistency between marketing and product trumps standalone font preferences. Space Grotesk as a display face is distinctive enough for our context, especially when paired with the Slate-950 dark palette and Indigo accents.

**Type Scale:**

The app's type scale (`--text-xs` through `--text-3xl`) covers body and heading sizes. The landing page extends it with larger display sizes for hero/marketing contexts:

```css
/* App tokens (already defined) */
--text-xs: 0.75rem;      /* 12px — fine print */
--text-sm: 0.875rem;     /* 14px — app default body, nav links */
--text-base: 1rem;       /* 16px — landing page body copy */
--text-lg: 1.125rem;     /* 18px — feature descriptions */
--text-xl: 1.25rem;      /* 20px — feature titles (H4) */
--text-2xl: 1.5rem;      /* 24px — sub-section heads (H3) */
--text-3xl: 1.875rem;    /* 30px — section heads (H2) */

/* Landing page extensions */
--text-hero: clamp(3rem, 6vw, 5rem);         /* 48–80px — Hero H1 only */
--text-display: clamp(2rem, 4vw, 3.25rem);   /* 32–52px — Section H2 display */
--text-feature-title: clamp(1.25rem, 2.5vw, 1.75rem);  /* Feature H3 */
```

**Line Heights (from app):**
```css
--leading-tight: 1.25;    /* Display/hero text, headings */
--leading-normal: 1.5;    /* Body text */
--leading-relaxed: 1.625; /* Long-form reading */
```

For the landing page hero specifically, use a tighter line height than the app default:
```css
.hero-headline {
  font-family: var(--font-heading);
  font-size: var(--text-hero);
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -0.02em;
}
```

**Two-tone heading pattern (critical — all three reference sites use this):**

```html
<h2>
  <span style="color: var(--color-text-muted)">Step up your</span>
  <br />
  <span style="color: var(--color-text-primary)">X game</span>
</h2>
```

The muted/highlighted split creates instant visual hierarchy and is a defining pattern across all three reference sites. Use this on every major section heading. Optionally, the highlighted phrase can use the `gradient-text` class from the app CSS for an Indigo → Orange gradient treatment.

**Font Loading (Next.js):**

```typescript
// app/layout.tsx — fonts are already loaded via next/font
import { Space_Grotesk, DM_Sans } from 'next/font/google';
import localFont from 'next/font/local';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
});
const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
});
const geistMono = localFont({
  src: './fonts/GeistMono-Regular.woff2',
  variable: '--font-geist-mono',
  display: 'swap',
});
```

---

## 4. Layout & Spatial Composition

### 4.1 Page Structure (Section Order)

Follow this exact section flow, derived from the common structure across all three reference sites:

```
1. NAVBAR
2. HERO (headline + subhead + CTA + hero visual)
3. SOCIAL PROOF BAR (logos, avatars, or "Join X,XXX+ creators")
4. TESTIMONIAL CAROUSEL (embedded tweet-style cards)
5. PAIN → SOLUTION BRIDGE (short emotional copy block)
6. FEATURE SHOWCASE (3–5 features, alternating layout)
7. HOW IT WORKS (3-step numbered flow)
8. MORE FEATURES GRID (compact grid of secondary features)
9. PRICING
10. FAQ (accordion)
11. FINAL CTA (full-width, bold)
12. FOOTER
```

### 4.2 Container & Grid

```css
--container-max: 1200px;
--container-narrow: 800px;
--container-wide: 1400px;
--section-padding: clamp(4rem, 8vw, 8rem) 0;
--grid-gap: 2rem;            /* Matches app --space-8 */
```

- Use CSS Grid for feature layouts, not Flexbox.
- Feature showcase sections alternate between: image-left/text-right and text-left/image-right (Tweet Hunter pattern).
- No section should feel like the previous one. Vary between: full-width, contained, asymmetric, card-grid.

### 4.3 Spacing Philosophy

Use the app's spacing scale (`--space-*` tokens) for internal element spacing:

```css
/* Internal spacing uses app tokens */
--space-4: 1rem;     /* Minimum gap between related elements */
--space-6: 1.5rem;   /* Card internal padding */
--space-8: 2rem;     /* Card padding, group spacing */
--space-10: 2.5rem;  /* Between heading and content */
--space-12: 3rem;    /* Between sub-sections */
```

- Section vertical padding should be generous: `clamp(4rem, 8vw, 8rem)`.
- Card padding: `var(--space-8)` minimum (2rem).
- Heading-to-body gap: `var(--space-5)` (1.25rem).
- CTA buttons: `var(--space-4) var(--space-10)` padding (1rem 2.5rem).

---

## 5. Component Specifications

### 5.1 Navbar

```
Layout: Logo (left) | Nav links (center) | CTA button (right)
Position: Fixed, top: 0, z-index: var(--z-sticky)
Background: transparent initially → glass effect on scroll
Height: 64px–72px
```

On scroll, apply the app's `.glass` utility class:
```css
.navbar.scrolled {
  background: var(--color-glass-medium);     /* rgba(255,255,255,0.06) */
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-bottom: 1px solid var(--color-border-subtle);
}
```

**Nav links:** 4–5 max. Suggested: Features, Pricing, Blog, FAQ. Style with `var(--font-body)`, `var(--text-sm)`, `var(--color-text-secondary)`.

**CTA button in nav:** Ghost/outlined style using app tokens:
```css
.nav-cta {
  background: transparent;
  color: var(--color-text-primary);
  font-family: var(--font-body);
  font-size: var(--text-sm);
  font-weight: 500;
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border-default);
  transition: all var(--transition-fast);
}
.nav-cta:hover {
  border-color: var(--color-primary-500);
  background: var(--glow-primary-soft);
}
```

**Mobile:** Hamburger menu. Full-screen overlay with `var(--color-bg-base)` background and large tap targets.

### 5.2 Hero Section

This is the most critical section. Reference sites dedicate 80–100vh to the hero.

**Structure:**
```
[Badge/pill — e.g., "Now in Beta" or "Chrome Extension Available"]
[Headline — 2-3 lines max, two-tone style]
[Subheadline — 1-2 sentences, --color-text-secondary]
[CTA buttons — primary + secondary, side by side]
[Trust line — "7-day free trial · Cancel anytime"]
[Hero image/screenshot — app UI, slight perspective tilt, glow effect]
```

**Background treatment:**
```css
.hero {
  background: var(--gradient-hero-bg);
  position: relative;
  overflow: hidden;
}
/* Ambient glow orb behind headline */
.hero::before {
  content: '';
  position: absolute;
  top: -20%;
  left: 50%;
  transform: translateX(-50%);
  width: 600px;
  height: 600px;
  background: radial-gradient(circle, var(--glow-primary-medium) 0%, transparent 70%);
  pointer-events: none;
  z-index: 0;
}
```

**Hero headline pattern (from SuperX):**
```
Grow faster on 𝕏
with [rotating word: hidden insights | smart analytics | actionable data]
```

Consider a text-cycling animation in the headline for the key differentiating phrase. SuperX does this extremely well — a word rotates through 3-4 value props with a smooth fade/slide transition.

**Hero image treatment:**
```css
.hero-image {
  border-radius: var(--radius-2xl);           /* 1.5rem */
  border: 1px solid var(--color-border-default);
  box-shadow: var(--shadow-hero-image);
  transform: perspective(1000px) rotateX(2deg);
}
```

### 5.3 Social Proof Bar

Immediately below the hero. Two patterns from references:

**Pattern A — Avatar strip (Tweet Hunter):**
Horizontally scrolling row of user avatars (circular, 40–48px) with an overlapping stack effect and text "Join 5,644+ X pros."

**Pattern B — Metric badges (SuperX):**
"Loved by 1,458+ creators" with a Product Hunt badge and Chrome Web Store badge.

**Implementation:** Use overlapping avatars with negative margin:
```css
.avatar-stack img {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-full);
  border: 2px solid var(--color-bg-base);
  margin-left: -12px;
}
```

### 5.4 Testimonial Cards (Tweet-Style)

All three reference sites embed testimonials styled as actual X/Twitter posts. This is a genre convention — do NOT use generic quote cards.

**Tweet card structure:**
```
┌─────────────────────────────────────┐
│ [Avatar] Name              [X logo] │
│          @handle                     │
│                                      │
│ Tweet body text here with            │
│ @mentions highlighted in accent.     │
│                                      │
│ 10:22 PM · Sep 18, 2025             │
│                                      │
│ 13 Retweets  5 Quotes  63 Likes     │
└─────────────────────────────────────┘
```

**Styling (using app surface tokens):**
```css
.tweet-card {
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-2xl);
  padding: var(--space-6);
  max-width: 380px;
  transition: all var(--transition-base);
}
.tweet-card:hover {
  border-color: var(--color-border-strong);
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
}
.tweet-card .mention {
  color: var(--color-primary-400);
}
.tweet-card .timestamp {
  color: var(--color-text-muted);
  font-size: var(--text-xs);
}
.tweet-card .stats {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  font-family: var(--font-mono);
}
```

Display 3 testimonial cards in a horizontal row on desktop, single-column carousel on mobile.

### 5.5 Feature Showcase Sections

This is the meat of the page. Each feature gets its own section with an alternating layout.

**Layout pattern (from Tweet Hunter):**

```
Section A:
[Text block — left 45%] [Image/screenshot — right 55%]

Section B:
[Image/screenshot — left 55%] [Text block — right 45%]
```

**Text block structure per feature:**
```
[Small category label — pill/badge, e.g., "AI Chat Mode"]
[Feature headline — H3, bold, font-heading]
[Feature description — 2-3 sentences, --color-text-secondary]
[3 mini feature bullets with icons]
```

**Category badge (uses app pill pattern):**
```css
.feature-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-full);
  background: var(--glow-primary-soft);
  border: 1px solid rgba(99, 102, 241, 0.2);
  color: var(--color-primary-300);
  font-size: var(--text-xs);
  font-weight: 500;
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
```

**Mini feature bullets (from SuperX):**
```
┌──────────────────────────────────┐
│ [icon]  Personalized Output       │
│         Adapts to your style      │
└──────────────────────────────────┘
```

**Image treatment:**
```css
.feature-screenshot {
  border-radius: var(--radius-xl);
  border: 1px solid var(--color-border-default);
  box-shadow: var(--shadow-lg);
}
```

### 5.6 How It Works (Numbered Steps)

Three steps, horizontal on desktop, vertical on mobile. Reference: Tweet Hunter's "Tactic example" sections.

```
[1]──────────[2]──────────[3]
Find          Add your      Schedule
inspiration   own twist     and repeat
```

**Step number (using app accent gradient):**
```css
.step-number {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-full);
  background: var(--gradient-accent);
  color: white;
  font-family: var(--font-heading);
  font-weight: 700;
  font-size: var(--text-xl);
  display: grid;
  place-items: center;
  box-shadow: var(--shadow-glow-primary);
}
```

Connect steps with a dashed or gradient line on desktop.

### 5.7 Feature Grid (Compact)

For secondary features that don't need a full showcase section. Reference: Tweet Hunter's "All the features you were hoping for" section.

**Layout:** 2-column or 3-column grid of checkmark items grouped by category.

```
Content Creation          Scheduling & Automation
✓ Viral tweets library    ✓ Schedule tweets/threads
✓ AI-powered writing      ✓ Auto DM
✓ Topic search            ✓ Auto Plug
✓ Thread generator        ✓ Evergreen tweets
```

**Styling:**
- Category headers: `var(--font-heading)`, `var(--text-lg)`, `var(--color-text-primary)`
- Checkmarks: `var(--color-primary-400)` or `var(--color-success-400)` for variety
- Feature text: `var(--text-sm)`, `var(--color-text-secondary)`
- AI-powered features get a small ⚡️ badge in `var(--color-accent-400)`

### 5.8 Pricing Section

**Pattern (from SuperX):** Simple 2-tier card layout, side by side.

```
┌─────────────────┐  ┌─────────────────┐
│     STARTER      │  │   PRO (Popular)  │ ← highlighted
│                  │  │                  │
│    $XX/month     │  │    $XX/month     │
│                  │  │                  │
│ Feature list     │  │ Feature list     │
│ ✓ ...            │  │ ✓ Everything in  │
│ ✓ ...            │  │   Starter, plus: │
│                  │  │ ✓ ...            │
│ [Get Started]    │  │ [Get Started]    │
└─────────────────┘  └─────────────────┘
```

**Standard card:** Uses app `.surface` class (`--color-bg-surface` + `--color-border-default`).

**"Popular" card should:**
- Use `--color-bg-elevated` background
- Apply the app's `.gradient-border` utility (Indigo → Orange gradient border)
- Include a "Most Popular" badge using `--color-accent-500`
- Add `var(--shadow-glow-primary)` for ambient glow
- Be slightly larger (extra padding) than the other card

**Price display:**
```css
.price {
  font-family: var(--font-heading);
  font-size: var(--text-3xl);
  font-weight: 700;
  color: var(--color-text-primary);
}
.price-period {
  font-family: var(--font-body);
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}
```

### 5.9 FAQ Section

Accordion-style, collapsed by default. Reference: Tweet Hunter's FAQ is clean and minimal.

```css
.faq-item {
  border-bottom: 1px solid var(--color-border-subtle);
  padding: var(--space-6) 0;
}
.faq-question {
  font-family: var(--font-heading);
  font-weight: 600;
  font-size: var(--text-lg);
  color: var(--color-text-primary);
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: color var(--transition-fast);
}
.faq-question:hover {
  color: var(--color-primary-300);
}
.faq-answer {
  color: var(--color-text-secondary);
  font-size: var(--text-base);
  line-height: var(--leading-relaxed);
  padding-top: var(--space-4);
}
.faq-icon {
  transition: transform var(--transition-slow);
  color: var(--color-text-muted);
}
.faq-item[open] .faq-icon {
  transform: rotate(45deg);
  color: var(--color-primary-400);
}
```

### 5.10 Final CTA Section

Full-width, high-impact. Reference: SuperX's "Take The Easy Route. Grow With SuperX!" section.

```css
.final-cta {
  background: var(--color-bg-surface);
  position: relative;
  text-align: center;
  padding: clamp(4rem, 8vw, 8rem) 0;
}
/* Ambient glow behind the CTA */
.final-cta::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 500px;
  height: 300px;
  background: radial-gradient(ellipse, var(--glow-primary-medium) 0%, transparent 70%);
  pointer-events: none;
}
```

Headline should match hero energy — use `var(--text-hero)` or `var(--text-display)`.

### 5.11 Footer

Minimal. Reference sites keep it tight.

```
[Logo]                    [Product links]  [Resources]  [Legal]
[One-line tagline]        Features         Blog         Terms
                          Pricing          Changelog    Privacy
[Social icons: X link]    Chrome Ext       Docs
```

```css
.footer {
  background: var(--color-bg-base);
  border-top: 1px solid var(--color-border-subtle);
  padding: var(--space-12) 0 var(--space-8);
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}
```

---

## 6. Buttons & Interactive Elements

All button styles extend the app's `.interactive` base class and use app design tokens.

### Primary CTA Button
```css
.btn-primary {
  background: var(--gradient-accent);
  color: white;
  font-family: var(--font-body);
  font-weight: 600;
  font-size: var(--text-base);
  padding: var(--space-3) var(--space-8);
  border-radius: var(--radius-xl);
  border: none;
  cursor: pointer;
  transition: all var(--transition-base);
  box-shadow: var(--shadow-cta-glow);
}
.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-cta-glow-hover);
}
.btn-primary:active {
  transform: scale(0.98);
}
```

### Secondary / Ghost Button
```css
.btn-secondary {
  background: transparent;
  color: var(--color-text-primary);
  font-family: var(--font-body);
  font-weight: 500;
  font-size: var(--text-base);
  padding: var(--space-3) var(--space-8);
  border-radius: var(--radius-xl);
  border: 1px solid var(--color-border-default);
  cursor: pointer;
  transition: all var(--transition-base);
}
.btn-secondary:hover {
  border-color: var(--color-primary-500);
  background: var(--glow-primary-soft);
}
```

### Badge / Pill
```css
.badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-4);
  border-radius: var(--radius-full);
  background: var(--glow-primary-soft);
  border: 1px solid rgba(99, 102, 241, 0.2);
  color: var(--color-primary-300);
  font-size: var(--text-xs);
  font-weight: 500;
}
```

---

## 7. Animations & Motion

The app design system defines several animation keyframes and utility classes. The landing page reuses those and adds marketing-specific sequences.

### 7.1 Reusable App Animations

These are already defined in the app's globals.css — use them directly:

| Class | Keyframe | Use on landing page |
|-------|----------|---------------------|
| `.animate-fade-in` | `fadeIn` | General reveals |
| `.animate-slide-up` | `slideUp` | Section entries |
| `.animate-scale-in` | `scaleIn` | Modal/card popups |
| `.animate-pulse-glow` | `pulse-glow` | Hero CTA emphasis |

### 7.2 Page Load Sequence (landing page extension)

Stagger the hero elements on initial load:

```css
.hero-badge     { animation: slideUp 0.6s ease both; animation-delay: 0.1s; }
.hero-headline  { animation: slideUp 0.6s ease both; animation-delay: 0.2s; }
.hero-subhead   { animation: slideUp 0.6s ease both; animation-delay: 0.35s; }
.hero-cta       { animation: slideUp 0.6s ease both; animation-delay: 0.5s; }
.hero-image     { animation: slideUp 0.8s ease both; animation-delay: 0.6s; }
```

> Uses the app's existing `slideUp` keyframe — no new keyframe needed.

### 7.3 Scroll-Triggered Reveals

Use `IntersectionObserver` to trigger fade-in-up animations on section entry:

```javascript
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
}, { threshold: 0.15 });

document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
```

```css
.reveal {
  opacity: 0;
  transform: translateY(32px);
  transition: opacity 0.6s ease, transform 0.6s ease;
}
.reveal.visible {
  opacity: 1;
  transform: translateY(0);
}
```

### 7.4 Headline Word Cycling (Hero)

Implement with a vertical slide animation:

```css
.word-cycle {
  display: inline-block;
  overflow: hidden;
  height: 1.2em;
  vertical-align: bottom;
}
.word-cycle span {
  display: block;
  animation: cycle 6s ease-in-out infinite;
}
@keyframes cycle {
  0%, 20%   { transform: translateY(0); }
  25%, 45%  { transform: translateY(-100%); }
  50%, 70%  { transform: translateY(-200%); }
  75%, 95%  { transform: translateY(-300%); }
}
```

The cycling text should use the app's `gradient-text` class or `var(--color-primary-400)` to visually distinguish it from the static headline text.

### 7.5 Hover Micro-interactions

- Cards: `translateY(-4px)` + `var(--shadow-lg)` on hover
- CTAs: `translateY(-2px)` + glow intensification (matches app `.interactive:active { transform: scale(0.98) }`)
- Nav links: Color shift to `var(--color-primary-400)` + optional underline slide
- Feature icons: Slight scale (1.05) on parent card hover
- Tweet cards: Border color shifts to `var(--color-border-strong)` on hover

### 7.6 Social Proof Marquee

Auto-scrolling horizontal strip (infinite marquee):

```css
.marquee {
  overflow: hidden;
  white-space: nowrap;
}
.marquee-inner {
  display: inline-flex;
  animation: scroll 30s linear infinite;
}
@keyframes scroll {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
```

Duplicate the content so it loops seamlessly.

### 7.7 Reduced Motion

The app already handles this — the landing page inherits the same media query:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 8. Responsive Breakpoints

```css
/* Mobile first — aligns with Tailwind defaults */
--bp-sm: 640px;
--bp-md: 768px;
--bp-lg: 1024px;
--bp-xl: 1280px;
```

**Key responsive behaviors:**

| Element | Desktop | Tablet | Mobile |
|---------|---------|--------|--------|
| Hero headline | `--text-hero` (5rem) | 3rem | 2.25rem |
| Feature sections | Side-by-side | Side-by-side | Stacked |
| Pricing cards | Horizontal | Horizontal | Stacked |
| Testimonial cards | 3 columns | 2 columns | 1 column carousel |
| Nav | Horizontal links | Hamburger | Hamburger |
| Feature grid | 3 columns | 2 columns | 1 column |
| Section padding | 8rem vertical | 5rem | 3.5rem |

---

## 9. Imagery & Visual Assets

### 9.1 App Screenshots
- Capture real UI screenshots at 2x resolution
- Place in a minimal browser chrome or floating card frame
- Round corners: `var(--radius-2xl)` (1.5rem)
- Add ambient glow: `var(--shadow-hero-image)`
- Optional: Slight 3D perspective tilt (`perspective(1000px) rotateX(2deg)`)

### 9.2 Icons
- Use a consistent icon library: **Lucide** (already used in app if applicable)
- Icon size in feature cards: 24px
- Icon color: `var(--color-primary-400)` for emphasis, `var(--color-text-muted)` for secondary
- For feature category icons, use custom SVGs with `var(--glow-primary-soft)` circular backgrounds

### 9.3 Background Effects
- Hero section: `var(--gradient-hero-bg)` with a radial glow orb using `var(--glow-primary-medium)`
- Optional: Noise texture overlay at 2–4% opacity for a grain effect
- Optional: Subtle grid or dot pattern in the background (very low opacity)
- Between sections: Use gradient fades, not hard color breaks

---

## 10. Copy & Content Guidelines

### 10.1 Voice
- Direct, confident, no hedging. "Grow your X audience" not "Help you potentially grow."
- Second person ("you/your") throughout.
- Short sentences. Punchy paragraphs. Max 2–3 sentences per description block.
- Use X-native terminology: "tweets," "threads," "engagement," "followers," "DMs."

### 10.2 Headline Formulas (from references)

**Hero headlines:**
- "Build & Monetize your 𝕏 audience" (Tweet Hunter)
- "Grow faster on 𝕏 with [cycling keyword]" (SuperX)
- Pattern: [Action verb] + [outcome] + on 𝕏

**Section headlines (two-tone):**
- "Step up your / X game" (Tweet Hunter)
- "How we help you / grow on X" (Tweet Hunter)
- "SuperX Just / Leveled Up" (SuperX)
- Pattern: [Muted context phrase] / [Bold key phrase]

**Feature headlines:**
- "Write 100 high quality tweets in less than 1 hour" (Tweet Hunter)
- "Your Voice. Infinite Firepower." (SuperX)
- "Post at the perfect time. Every time." (SuperX)
- Pattern: Specific, outcome-oriented, slightly aspirational

### 10.3 CTA Copy
- Primary: "Get Started for Free" or "Try for Free" (with X logo icon)
- Secondary: "See how it works" or "View pricing"
- Trust text below CTA: "7-day free trial · Cancel anytime" or "No credit card required"
- All three reference sites include the X/Twitter logo in their primary CTA button

---

## 11. Technical Implementation Notes

### 11.1 Framework
Build with **Next.js** (App Router) — the same framework as the app. The landing page can live as a route group `(marketing)` within the same Next.js project, or as a standalone deployment. Either way, it shares the same Tailwind config and globals.css.

### 11.2 Shared CSS
The landing page should import the app's `globals.css` to get all base tokens, utility classes (`.glass`, `.surface`, `.gradient-text`, `.gradient-border`, `.interactive`, etc.), and animation keyframes for free. Landing-page-only extensions (hero gradient, glow tokens, display type scale) are added in a `landing.css` file that layers on top.

### 11.3 Performance Targets
- Lighthouse Performance: > 90
- First Contentful Paint: < 1.5s
- Cumulative Layout Shift: < 0.1
- Lazy load all images below the fold
- Use `loading="lazy"` and `srcset` for responsive images
- Inline critical CSS for above-the-fold content

### 11.4 SEO Essentials
- Semantic HTML: one `<h1>`, logical heading hierarchy
- Meta title: "[Product Name] — [Core Value Prop for X/Twitter]"
- Meta description: Action-oriented, 150 chars max
- Open Graph image: Custom OG card (1200×630) matching the landing page aesthetic
- Structured data: SoftwareApplication schema

### 11.5 Analytics & Conversion Tracking
- Track CTA clicks (hero, nav, mid-page, final)
- Track scroll depth (25%, 50%, 75%, 100%)
- Track pricing section visibility
- Track FAQ interactions

---

## 12. Design System Mapping Reference

Quick lookup for how landing page concepts map to app design tokens:

| Landing Page Concept | App Token / Utility |
|---------------------|---------------------|
| Page background | `--color-bg-base` (#020617) |
| Card background | `--color-bg-surface` (#0F172A) or `.surface` class |
| Elevated card / hover | `--color-bg-elevated` (#1E293B) or `.surface-elevated` class |
| Glassmorphism navbar | `.glass` utility class |
| Primary accent | `--color-primary-500` (#6366F1) |
| Secondary accent | `--color-accent-500` (#F97316) |
| Gradient text (Indigo→Orange) | `.gradient-text` utility class |
| Gradient border (Indigo→Orange) | `.gradient-border` utility class |
| Primary heading text | `--color-text-primary` (#F8FAFC) |
| Secondary body text | `--color-text-secondary` (#94A3B8) |
| Muted/caption text | `--color-text-muted` (#64748B) |
| Subtle border | `--color-border-subtle` (rgba 0.06) |
| Default border | `--color-border-default` (rgba 0.10) |
| Card hover interaction | `.interactive` utility class |
| Indigo glow shadow | `--shadow-glow-primary` |
| Orange glow shadow | `--shadow-glow-accent` |
| Heading font | `--font-heading` (Space Grotesk) |
| Body font | `--font-body` (DM Sans) |
| Mono/stats font | `--font-mono` (Geist Mono) |
| Skeleton loading | `.skeleton` utility class |
| Focus ring | `--color-border-focus` (#6366F1) via `:focus-visible` |

---

## 13. Anti-Patterns to Avoid

These are common mistakes in X/Twitter SaaS landing pages. Do NOT do any of the following:

1. **White/light background** — Every successful competitor uses dark mode. Our app is dark mode. Going light will feel off-brand for both the X ecosystem and our own product.
2. **Generic stock illustrations** — No abstract blob people, no isometric office scenes. Use real app screenshots or custom graphics.
3. **Too many CTAs above the fold** — One primary, one secondary max in the hero.
4. **Feature dump without hierarchy** — The first 3 features get full showcase sections. Everything else goes in the compact grid.
5. **Missing social proof** — Every section transition should reinforce trust. Avatars, counts, tweet embeds.
6. **Walls of text** — No paragraph in the landing page should exceed 3 sentences. Use visual hierarchy instead.
7. **Different font stack than the app** — Do NOT introduce new fonts just for the landing page. Brand continuity requires Space Grotesk + DM Sans + Geist Mono.
8. **Different color palette than the app** — Do NOT invent new brand colors. Use the Slate/Indigo/Orange palette from globals.css.
9. **Purple gradient on white** — The most clichéd AI SaaS pattern. Avoid at all costs.
10. **No mobile optimization** — 60%+ of X users are mobile. The page must be flawless on mobile.
11. **Slow hero image** — Compress aggressively. Use WebP. The hero screenshot should load in < 500ms.
12. **Brand disconnect** — If a user can tell the landing page was designed separately from the app, it's a failure. Same tokens, same feel, elevated for marketing.

---

## 14. Quick Reference Checklist

Before shipping, verify:

- [ ] All colors trace back to `globals.css` tokens (no hardcoded one-off colors)
- [ ] Font stack matches app: Space Grotesk (headings), DM Sans (body), Geist Mono (stats)
- [ ] Dark mode palette uses exact Slate scale from app (`#020617`, `#0F172A`, `#1E293B`)
- [ ] Hero has: badge, two-tone headline, subhead, 2 CTAs, trust text, app screenshot
- [ ] At least one text-cycling or animated element in the hero
- [ ] Social proof bar with real numbers immediately below hero
- [ ] 3+ tweet-style testimonial cards (not generic quote boxes)
- [ ] 3–5 feature sections with alternating image/text layout
- [ ] How-it-works section with 3 numbered steps
- [ ] Compact feature grid for secondary features
- [ ] Pricing section with 2 tiers and a highlighted "popular" option using `.gradient-border`
- [ ] FAQ accordion with 6–10 questions
- [ ] Final CTA section that matches hero energy
- [ ] Staggered load animations using app's `slideUp` keyframe
- [ ] Scroll-triggered reveal animations on sections
- [ ] Navbar uses `.glass` utility on scroll
- [ ] `prefers-reduced-motion` respected (inherited from app CSS)
- [ ] All images lazy-loaded below fold
- [ ] Mobile responsive at all breakpoints
- [ ] Page load < 3s on 3G
- [ ] Custom OG image set
- [ ] Entering the app from the landing page feels like a seamless transition, not a context switch
