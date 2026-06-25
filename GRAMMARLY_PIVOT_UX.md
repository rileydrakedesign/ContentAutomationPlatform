# "Grammarly for Tweets" — UI/UX & Logic Deep-Dive

**Companion to `GRAMMARLY_PIVOT_PLAN.md`** · **Date:** 2026-06-24 · **Status:** Design exploration

Covers the three surfaces the assistant lives in, how each *metric* is best represented (highlight vs score vs badge), the hover-to-explain interaction, and the quality/cost/speed logic with options explored.

---

## 1. The three surfaces and their constraints

| Surface | Editor we're decorating | We control it? | Space | User intent | Cost tolerance |
|---|---|---|---|---|---|
| **A. X post box** (extension) | X inline + full-screen composer (`tweetTextarea_0`, Draft.js) | No — inject | Tight | Deliberate, high-value original post | Medium (worth a beat) |
| **B. X reply box** (extension) | X reply modal (`tweetTextarea_0` in `#layers`) | No — inject | Very tight | Fast, high-volume | Low (many drafts) |
| **C. Dashboard compose modal** | Our `<ComposeEditor>` | **Yes** | Roomy | Most deliberate | Highest |

The extension already injects into exactly these X nodes and already drives the Draft.js paste pipeline (`content.js:1744–1862`). We're adding a *decoration + scoring layer*, not new injection plumbing.

**One engine, three skins.** The check engine (§6) is identical everywhere; only the presentation density changes. The extension runs Tier-0 fully **client-side** (zero backend cost); Tier 1/2 go through the same background-worker → API path that already serves `/api/voice/check`.

---

## 2. Three visual primitives — and the rule for choosing

We have three ways to show a signal. The mistake to avoid is forcing every metric into underlines. The decision rule:

```
Is the issue tied to a SPECIFIC span of text that's PRESENT in the draft,
and can we anchor that span cheaply + reliably?
   ├─ YES → UNDERLINE (in-text highlight, hover to explain)
   └─ NO  → Is it a holistic quality of the whole draft?
              ├─ YES → SCORE / GRADE  (Voice Match, Performance, Post Score)
              └─ NO  → it's a discrete state or something MISSING → BADGE / CHIP
```

The critical realization: **absence can't be underlined.** "No reply hook" and "missing a high-lift pattern" have no span to mark — they're badges/suggestion-chips, never underlines. And **positives shouldn't be underlined** either (a green underline under a *good* thing reads as an error). So:

- **Underline = "fix this span."** Always a warning palette, color-coded by category.
- **Badge = a discrete state.** Green = good signal present; amber = caution; it can also be a *suggestion chip* ("+ open with a question").
- **Score = a holistic quality.** A number or grade you push upward.

---

## 3. Metric-by-metric: best representation + color

| Metric | Nature | Source | Representation | Color |
|---|---|---|---|---|
| **Spelling / grammar** | local span, present | Tier-0 local checker / Tier-1 LLM | **Underline** + hover-fix | 🔴 Red |
| **Clarity** (wordy, weak hook phrasing, passive) | local span | Tier-0 linter / Tier-2 | **Underline** + hover | 🔵 Blue |
| **Voice drift** (a phrase that doesn't sound like you) | fuzzy span | Tier-2 Live Read | **Underline** (only if confidently anchored) | 🟣 Purple |
| **External link** | exact span (the URL) | Tier-0 deterministic | **Underline** on the URL + hover ("links demoted; move to a reply") | 🟠 Amber |
| **Engagement-bait phrase** | exact span | Tier-0 | **Underline** + hover | 🟠 Amber |
| **Banned `avoid_words`** | exact span | Tier-0 (from guardrails) | **Underline** + hover | 🟠 Amber |
| **Voice Match** | holistic 0–100 | Tier-2 | **Score** | banded |
| **Performance / resemblance to your winners** | holistic | Tier-1/2 | **Grade A–F** (less false precision than a number) | banded |
| **Post Score** (headline blend) | holistic | composed | **Score** (the one number) | banded |
| **Reply hook present?** | binary | Tier-0 | **Badge** ✓/✗ | green / grey |
| **Native media / dwell-worthy length** | binary | Tier-0 | **Badge** ✓ | green |
| **Missing high-lift pattern** | absence | Tier-2 | **Suggestion chip** ("+ Add a stat") | amber/neutral |
| **Char count / over-limit** | global counter | Tier-0 | **Badge / counter** | neutral → red |
| **Thread-split opportunity** | global | Tier-0 | **Badge / nudge** | neutral |

**Color principle:** category → color, severity → underline *style* (dotted = suggestion, solid = warning, double = problem). Five underline colors max (Red/Blue/Purple/Amber), tested against X dark + light (the extension already ships both themes, `content.css`).

---

## 4. Hover-to-explain interaction (the core micro-UX)

Exactly as you described — quiet by default, explanatory on demand:

```
State 1 (ambient):   the user just sees a colored underline under the span.
                     ~~~~~~  (no labels, no clutter)

State 2 (hover/tap): a popover card rises above the span:

        ┌───────────────────────────────────────┐
        │ 🟠 REACH RISK                           │   ← category chip, colored
        │ Link in the main post                   │   ← what
        │ Posts with external links are demoted   │
        │ ~30–50%. X wants you to stay on-app.    │   ← WHY (grounded, from x-algorithm.ts)
        │                                         │
        │  [ Move link to a reply ]   [ Dismiss ] │   ← Accept (one-click) / Dismiss
        └───────────────────────────────────────┘
                      ▼ ~~~~~~~~~~
        ...check out https://mysite.com/post ...
```

Rules:
- **Hover** on desktop; **tap** on mobile/extension opens the same card (X is heavily mobile-web, but the extension is desktop-Chrome — tap matters mainly for the dashboard modal on tablets).
- Card always carries: **category** (colored) · **what** · **why (grounded reason)** · **Accept** · **Dismiss**.
- "Why" is never generic — it cites the X mechanism (algorithm weight) or *your* pattern multiplier (`reply ≈ 27× a like`, `your "question hook" pattern → 2.3×`). This is the trust differentiator.
- **Accept** applies the fix in-place (deterministic ones are instant local edits; for the extension, it re-uses the proven paste-injection path). **Dismiss** removes the underline and (optionally) remembers it for that draft.
- Only one popover open at a time; Esc closes.

---

## 5. The score area — per surface

Holistic scores live in a persistent area, never as underlines. Two layouts:

**Compact "score orb" (extension, tight space) — the Grammarly hallmark.**
A small circular badge pinned to the **bottom-right corner of the compose box**, reusing the extension's existing fixed-positioning approach (same machinery as the opportunity pill, `content.js:373`).

```
   ┌──────────────────────────────────────────┐
   │  What's on your mind?                     │
   │  Just shipped the new ~~~~~ feature and... │
   │                                           │
   │                                    ╭────╮  │
   │                              218   │ 82 │  │ ← orb: Post Score, banded color
   │                                    ╰────╯  │   red dot = N correctness errors
   └──────────────────────────────────────────┘
```

- Idle: shows the **Post Score** (banded green/amber/red). A small red number-dot overlays it when there are correctness errors (Grammarly's exact pattern).
- Working: gentle pulse while a Tier-2 read is in flight ("checking…").
- **Click → expands a panel** above/beside the box:

```
   ╭─────────────────────────────────╮
   │ Post Score            82  ▲      │
   │ ─────────────────────────────── │
   │ 🟣 Voice Match        88         │  ← sub-scores
   │ 🟡 Performance        B+         │
   │ 🟢 Reach   ✓hook ✓length ⚠link  │  ← reach = badge row, not a number
   │ ─────────────────────────────── │
   │ SUGGESTIONS (3)                  │
   │ 🟠 Move link to a reply  [Fix]   │  ← cards mirror the underlines
   │ 🟣 "utilize"→"use"       [Fix]   │
   │ 🟡 + Open with a question [Add]  │  ← absence-type suggestion chip
   ╰─────────────────────────────────╯
```

**Side/bottom panel (dashboard modal, roomy).**
Same content, always-visible, no orb needed — sub-scores top-right, suggestion cards stacked down the side, category-count pill row at the top (filterable). This is the `GRAMMARLY_PIVOT_PLAN.md §4` layout.

**Reply box** gets a *stripped* orb — replies are judged mostly on Voice Match + correctness, so the orb shows **Voice Match** (not a full Post Score) and the panel is shorter. Keep it distinct from the **opportunity pill** (which already answers a different question: *should I reply to this post at all*).

---

## 6. The logic — quality vs cost vs speed (options explored)

This is the heart of it. Three latency tiers, and for each metric we pick the cheapest method that's good enough.

### Tier 0 — instant, deterministic, **free**, every keystroke (client-side in the extension)
No network. Powers all amber/deterministic underlines, all badges, the char counter, and the **Reach** sub-score. Already exists as `computeAlgorithmFlags()` (`prepublish-read.ts:126`) — port it into the content script so it runs with **zero backend cost**. This single tier delivers most of the day-one value and 100% of the "live" feel.

Add to Tier 0:
- **Local grammar/clarity checker** — *option explored:* a WASM checker (e.g. Harper / nlprule) or a `retext`/`write-good`-style linter running client-side. **Free, instant, private, no per-keystroke API calls.** Lower ceiling than an LLM but covers 80% of typos/wordiness. **Recommended** as the default correctness layer; LLM correctness becomes an opt-in "deep check."

### Tier 1 — debounced ~1.2s, cheap, low cost
- **Performance / resemblance** — *options explored:*
  - (a) **LLM judge** (current `runPrepublishRead`): best explanations, slowest, priciest.
  - (b) **Embedding cosine** of the draft vs a **cached centroid of the user's top performers**: one cheap embeddings call, ~100ms, gives a solid resemblance *number* — but no "why."
  - (c) **Hybrid (recommended):** embedding cosine for the live **Performance grade** (cheap/fast, updates as you type), and reserve the LLM only for the **"missing pattern" suggestions** (Tier 2 / on-demand). Best balance — the grade feels live and costs almost nothing; the expensive judgment runs rarely.

### Tier 2 — debounced ~3s after pause, judgment LLM, **subscription-gated** (per locked decision)
- **Merged "Live Read"** — one call returns Voice Match score, anchored voice-drift span(s), and missing-pattern suggestions. Replaces today's two separate 3-credit round-trips (voice-check + read). Fast model. Cached by `draft_hash`.

### The cost-control stack (apply all)
1. **Deterministic-first** — Tier 0 is free and does the heavy lifting; many sessions never trigger paid tiers.
2. **Debounce + idle gate** — LLM only fires on a typing pause ≥ threshold; never per keystroke.
3. **Hash-cache** (`voice_check_results` / `prepublish_reads` already key on `draft_hash`) — unchanged text = $0; normalize whitespace before hashing.
4. **Min-delta gate** — skip Tier 2 unless the draft changed by > a word boundary / N chars, so fixing one typo doesn't re-run the read.
5. **Triviality gate** — no Tier 2 under ~15 chars ("gm" shouldn't cost a call).
6. **Single in-flight + coalescing** — one Live Read per field; new typing cancels/supersedes the prior request.
7. **Merge calls** (voice + patterns in one) — halves cost and latency.
8. **Model tiering** — fast model live; big model only for explicit "deep check" / generation.
9. **Optimistic local re-score** — on Accept (e.g. link removed), recompute the deterministic sub-scores instantly with no round trip; LLM re-runs only on next pause.
10. **Entitlement gate** — live LLM = subscription; free tier gets Tier 0 + a few manual deep checks/day. (Doubles as the Pro upsell the popup already markets.)

### Perceived speed
Tier 0 paints **instantly** so the field always feels alive; the orb shows a "checking…" pulse and the LLM-backed scores/underlines **fade in** when they land. The user never waits on a blocking spinner.

### Per-surface aggressiveness (the balance)

| | Tier 0 | Tier 1 (perf grade) | Tier 2 (Live Read) |
|---|---|---|---|
| **A. X post box** | auto, live | auto on pause | **auto on pause** (high-value original content) |
| **B. X reply box** | auto, live | auto on pause | **on-demand only** (panel-open or existing voice-check button) — replies are high-volume; auto-LLM each draft is too costly |
| **C. Dashboard modal** | auto, live | auto on pause | auto on pause (most aggressive) |

This keeps the expensive tier opt-in exactly where volume is highest (replies), and automatic where value is highest (original posts + dashboard).

---

## 7. In-X-box underlines: the Draft.js reality

Decorating a box we don't own is the one genuinely hard part. Options:

- **(a) True inline underlines in X's box** — overlay a layer that mirrors the text and draws underlines using `Range.getClientRects()` for each span. This is how Grammarly does it; it's *possible* (it's a real contenteditable) but fragile against Draft.js re-renders, scroll, and X DOM churn.
- **(b) Panel-only on X** — no in-box underlines; all findings live in the orb panel as cards with the offending text **quoted**. Robust, low-effort, lower fidelity.
- **(c) Hybrid (recommended):** underline **only the Tier-0, exact-match, deterministic spans** (link, bait phrase, avoid-word, typo) — these are trivially and reliably anchorable — and route all **fuzzy LLM spans** (voice drift) to the **panel as quoted cards**, not in-box underlines. Best robustness-to-value ratio, and it sidesteps the LLM-miscount problem entirely on the surface we control least.

**Reliability rules for any in-X underline:** re-anchor on Draft.js mutation via the MutationObserver the extension already runs (`content.js:2079`); debounce redraws; and **when anchor confidence drops, hide the underline rather than risk drawing it in the wrong place** (a misplaced underline is worse than none). The dashboard modal (surface C), which we fully own via the overlay editor, can show the full fuzzy-underline experience safely.

---

## 8. Anchoring rule (applies everywhere)
The LLM returns the **verbatim quote** for each finding, never raw character offsets (models miscount). We resolve `start/end` locally by searching for that quote. If the quote isn't found verbatim → **downgrade to a panel card, no underline.** This makes wrong-position underlines structurally impossible.

---

## 9. Open decisions
1. **In-X underlines:** ship hybrid (c) — deterministic-only underlines on X, fuzzy in panel? Or invest in full Range-rect overlays on X from day one?
2. **Performance metric:** embedding-cosine grade (cheap/live) vs LLM judge (rich/slow) vs hybrid? (Recommend hybrid.)
3. **Score vs grade:** Performance as a letter grade (A–F) and Voice/Post as 0–100 numbers? Or all numbers? (Recommend grade for Performance to avoid false precision.)
4. **Reply-box Tier 2:** strictly on-demand, or auto on pause for Pro users only?
```
