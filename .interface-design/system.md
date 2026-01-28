# Design System

Content analytics command center for solo creators.

## Intent

**Who:** Solo creator, morning routine. Building their personal brand before/after main work. Needs efficiency, not complexity.

**Task:** Understand what's working. See patterns in content performance, learn from data. 5 minutes, not 50.

**Feel:** Command center. Dense, powerful, information-rich. Control over everything — but glanceable.

---

## Signature

**Morning Briefing Density**

The interface assumes limited time. Everything is glanceable but deep on demand.

- Numbers always have context ("↑ 23% vs last week")
- Patterns surface automatically ("Posts before 8am get 2x engagement")
- Metrics show trend, not just value
- Time-based strips show when engagement happened
- Hierarchy: analytics first, creation second

---

## Spacing

**Base unit:** 4px

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px (1) | Tight gaps, dense data |
| sm | 6px (1.5) | Compact element spacing |
| md | 8px (2) | Standard element spacing |
| lg | 12px (3) | Component padding |
| xl | 16px (4) | Card padding, section gaps |
| 2xl | 24px (6) | Section margins |

**Density shift:** Tighter than before. Use `p-3` or `p-4` for cards (was `p-4` or `p-6`). Use `gap-2` or `gap-3` for grids (was `gap-4` or `gap-6`).

**Patterns:**
- Card padding: `p-3` or `p-4`
- Section spacing: `space-y-4` or `mb-4`
- Data grids: `gap-2`
- Form spacing: `space-y-3`

---

## Colors

**Theme:** Warm slate command center

### Surfaces
| Role | Token | Notes |
|------|-------|-------|
| App background | `slate-950` | Warm dark base |
| Card surface | `slate-900` | Slight warmth |
| Nested surface | `slate-800` | Inputs, nested cards |
| Hover surface | `slate-700` | Interactive states |
| Subtle surface | `slate-800/50` | Tab containers |

### Text
| Role | Token |
|------|-------|
| Primary | `white` |
| Body | `slate-300` |
| Secondary | `slate-400` |
| Muted | `slate-500` |
| Disabled | `slate-600` |

### Borders
| Role | Token |
|------|-------|
| Default | `slate-800` |
| Subtle | `slate-700` |
| Input focus | `slate-500` |
| Selected | `amber-500` |

### Accent Colors
| Role | Default | Hover | Usage |
|------|---------|-------|-------|
| Primary | `amber-500` | `amber-400` | Actions, attention, signals |
| Link | `amber-400` | `amber-300` | Text links |
| Success/Up | `teal-400` | `teal-300` | Positive trends, health |
| Warning | `amber-400` | `amber-300` | Attention needed |
| Danger/Down | `red-400` | `red-300` | Negative trends, errors |
| Neutral trend | `slate-400` | — | No change |

### Badge Variants
```
default:   bg-slate-800 text-slate-300 border-slate-700
primary:   bg-amber-500/10 text-amber-400 border-amber-500/20
success:   bg-teal-500/10 text-teal-400 border-teal-500/20
warning:   bg-amber-500/10 text-amber-400 border-amber-500/20
danger:    bg-red-500/10 text-red-400 border-red-500/20
```

---

## Depth

**Strategy:** Borders only (no shadows)

Fits command center density. Clean separation without visual noise.

- Cards: `border border-slate-800`
- Hover: `hover:border-slate-700`
- Selected: `border-amber-500`
- Focus: `focus:border-slate-500`

---

## Typography

**Font:** System default (consider monospace-heavy for data)

| Element | Classes |
|---------|---------|
| Page title | `text-xl font-semibold text-white` |
| Section heading | `text-base font-medium text-white` |
| Card title | `text-sm font-semibold text-white` |
| Body | `text-sm text-slate-300` |
| Label | `text-xs font-medium text-slate-400 uppercase tracking-wide` |
| Description | `text-sm text-slate-500` |
| Metric value | `text-2xl font-semibold text-white font-mono tabular-nums` |
| Metric label | `text-xs text-slate-500 uppercase tracking-wide` |
| Trend | `text-xs font-medium` + color |
| Timestamp | `text-xs text-slate-500 font-mono` |

**Note:** Tighter than before. Page titles `text-xl` (was `text-2xl`). More uppercase labels for data clarity.

---

## Border Radius

| Element | Radius |
|---------|--------|
| Cards, containers | `rounded-lg` |
| Buttons, inputs | `rounded-md` |
| Badges, small elements | `rounded` |

---

## Component Patterns

### Card
```tsx
// Standard
<div className="bg-slate-900 border border-slate-800 rounded-lg p-3">

// Interactive
<div className="bg-slate-900 border border-slate-800 rounded-lg p-3
  hover:border-slate-700 transition cursor-pointer">

// Selected/Active
<div className="bg-slate-900 border border-amber-500 rounded-lg p-3">
```

### Metric Card (Signature Pattern)
```tsx
<div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
  <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
    Views
  </p>
  <div className="flex items-baseline gap-2">
    <span className="text-2xl font-semibold text-white font-mono tabular-nums">
      12.4k
    </span>
    <span className="text-xs font-medium text-teal-400">
      ↑ 23%
    </span>
  </div>
  <p className="text-xs text-slate-500 mt-1">vs last 7 days</p>
</div>
```

### Pattern Callout (Signature Pattern)
```tsx
<div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
  <p className="text-sm text-amber-400">
    Your threads outperform single posts by 3x
  </p>
</div>
```

### Button - Primary
```tsx
<button className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400
  text-slate-900 font-medium rounded-md transition">
  Action
</button>

// Full width
<button className="w-full py-2 bg-amber-500 hover:bg-amber-400
  text-slate-900 font-medium rounded-md transition
  disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed">
  Generate
</button>
```

### Button - Secondary
```tsx
<button className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700
  text-white rounded-md transition">
  Cancel
</button>
```

### Button - Ghost
```tsx
<button className="px-3 py-1.5 text-slate-400 hover:text-white
  hover:bg-slate-800 rounded-md transition">
  Options
</button>
```

### Text Link
```tsx
<a className="text-amber-400 hover:text-amber-300 transition">
  View details
</a>

// Muted
<a className="text-slate-400 hover:text-white transition">
  Settings
</a>
```

### Input
```tsx
<input className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700
  rounded-md text-white placeholder-slate-500 text-sm
  focus:outline-none focus:border-slate-500" />
```

### Badge
```tsx
<span className="inline-flex items-center px-2 py-0.5
  text-xs rounded bg-slate-800 text-slate-300 border border-slate-700">
  Label
</span>
```

### Trend Indicator
```tsx
// Up (positive)
<span className="text-xs font-medium text-teal-400">↑ 23%</span>

// Down (negative)
<span className="text-xs font-medium text-red-400">↓ 12%</span>

// Neutral
<span className="text-xs font-medium text-slate-400">→ 0%</span>
```

### Error Message
```tsx
<div className="bg-red-500/10 border border-red-500/20
  text-red-400 px-3 py-2 rounded-md text-sm">
  Error message
</div>
```

### Tabs
```tsx
// Container
<div className="flex gap-1 bg-slate-800/50 p-1 rounded-lg">

  // Tab (active)
  <button className="px-3 py-1 rounded-md text-sm
    bg-slate-700 text-white">
    Active
  </button>

  // Tab (inactive)
  <button className="px-3 py-1 rounded-md text-sm
    text-slate-400 hover:text-white hover:bg-slate-700/50">
    Inactive
  </button>
</div>
```

---

## Layout

### Page Container
```tsx
<div className="max-w-6xl mx-auto px-4">
```

### Page Header (Compact)
```tsx
<div className="mb-4">
  <h1 className="text-xl font-semibold text-white">Insights</h1>
  <p className="text-slate-500 text-sm mt-0.5">What's working</p>
</div>
```

### Section Spacing
```tsx
<div className="space-y-4">
  {/* Sections */}
</div>
```

### Data Grid (Dense)
```tsx
// Stats row
<div className="grid grid-cols-4 gap-2">

// Two column
<div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
```

### Nav
```tsx
<nav className="border-b border-slate-800 bg-slate-950">
  <div className="max-w-6xl mx-auto px-4 py-2
    flex items-center justify-between">
```

---

## Transitions

All interactive elements: `transition`

Duration: ~150ms (fast, command-center responsive)

---

## Migration Notes

### Color Changes
| Old (zinc) | New (slate) |
|------------|-------------|
| `zinc-950` | `slate-950` |
| `zinc-900` | `slate-900` |
| `zinc-800` | `slate-800` |
| `zinc-700` | `slate-700` |
| `zinc-600` | `slate-600` |
| `zinc-500` | `slate-500` |
| `zinc-400` | `slate-400` |
| `zinc-300` | `slate-300` |
| `blue-600` | `amber-500` |
| `blue-500` | `amber-400` |
| `blue-400` | `amber-400` |
| `blue-300` | `amber-300` |
| `green-400` | `teal-400` |
| `green-300` | `teal-300` |

### Spacing Changes
| Old | New |
|-----|-----|
| `p-6` | `p-4` or `p-3` |
| `p-4` | `p-3` |
| `mb-6` | `mb-4` |
| `gap-4` | `gap-3` or `gap-2` |
| `space-y-6` | `space-y-4` |
| `text-2xl` (titles) | `text-xl` |
| `text-lg` (headings) | `text-base` or `text-sm font-semibold` |

### New Patterns to Add
- Metric cards with trend context
- Pattern callout boxes
- Uppercase tracking-wide labels for data
- Monospace + tabular-nums for numbers
