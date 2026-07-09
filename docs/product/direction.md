# Direction — Future Enhancements & Vision

> **Forward-looking, not yet built.** This is where we're steering, not what's shipped. The
> canonical *current* product definition is the **[PRD](prd.md)**; this doc tracks the
> bets beyond it. When an item here ships, fold it into the PRD and leave a pointer.
>
> **Status:** living document · **Updated:** 2026-06-26 · **Owner:** Riley

---

## The thesis — the algorithm is the new publisher

For five hundred years, getting words to an audience meant getting past a **publisher**: the
press operator, the newspaper editor, the broadcaster. They decided what reached people and
what didn't. That gatekeeper never disappeared — it changed shape. Today the publisher is an
**algorithm**. X's ranking, Substack's recommendation graph, LinkedIn's feed, Google's
index — each one decides who sees your words, and each one runs by its own opaque, shifting
rules.

The modern writer now answers to *many* publishers at once, and **there are too many to keep
track of.** Every platform reranks constantly; growth advice is folklore; the rules that won
yesterday lose today. Writers cope by either chasing the algorithm until their voice
flattens into generic engagement-bait, or ignoring it and going unseen.

**Our job is to collapse that fog at the moment of writing** — to keep you *in accordance
with the algorithms without losing your unique idea and voice.* We tell you where a piece
will lose to the ranking and where it stops sounding like you, and we fix both in one pass.

**Human first, AI assisted.** The writer keeps the pen. AI is the heads-up display and the
optional on-ramp — never the author. This is the line that separates us from the wave of
"generate it for me" tools that produce confident, clean, soulless text. We make *your*
writing land; we don't replace it.

---

## Direction 1 — A design system rooted in the history of writing

The product's look and feel should evoke **the lineage of the written word** — the craft and
authority of the institutions that carried writing for centuries — rather than the
interchangeable SaaS-dashboard aesthetic. We are a writing tool; it should feel like one.

**Inspiration set:** the Gutenberg press · newspaper and broadsheet typography · the
typewriter · editorial / masthead layout · letterpress, ink, and proof-marks · the
copyeditor's red pencil.

**Design principles to develop:**

- **Typography as the interface.** Editorial type hierarchy, real text columns, considered
  measure and leading — the page should read like a page, not a form.
- **The proof-mark vocabulary.** Underlines, margin marks, and annotations drawn from
  copyediting tradition — the assistant's feedback *is* a proofreader's markup, made literal.
- **Press / typewriter materiality.** Restrained skeuomorphic cues (ink, paper, platen,
  registration marks) used as accents, not theme-park decoration.
- **Authority and calm.** The newspaper and the printed book signal trust and permanence;
  the UI should feel composed and credible, the opposite of frantic engagement dashboards.

**Design inspiration (references):**

- **[The Monospace Web](https://owickstrom.github.io/the-monospace-web/) — primary design
  inspiration.** The overall aesthetic north star: monospace type, grid discipline, ink-on-
  paper restraint, and the printed-document feel we're building the whole system around.
- **[iA Writer](https://ia.net/writer) — primary inspiration for the editor.** Its minimal,
  borderless, full-screen writing surface is the model for our editor: nothing on screen but
  the words, the writer in focus, chrome out of the way.
- **[In Search of the Perfect Writing Font](https://ia.net/topics/in-search-of-the-perfect-writing-font)**
  — iA's reasoning on typography for writing; informs our type and "perfect writing font" choices.
- **[The Pudding](https://pudding.cool/)** — editorial, type-led visual storytelling; a
  reference for treating the page as composed editorial layout rather than a SaaS dashboard.
- **[US Graphics Company](https://usgraphics.com/)** — technical/industrial precision,
  systematic grids, and information-dense composition done with craft.

> Builders: this is the design *north star*, not a spec. Token/component work lands in the
> design system; record concrete decisions there and link back here. See the recent
> `ScoreDial` / primitives Design-Sync import as the first step in this direction.

---

## Direction 2 — From X-only to a writing assistant for every modern publication

Today the assistant is scoped to **X**. The destination is a **full-scale writing AI
assistant for all modern publications** — anywhere writing meets an algorithm:

- **X / Twitter** — the beachhead (shipped).
- **Substack** — newsletters and the recommendation graph.
- **LinkedIn** — professional feed ranking.
- **Google** — Docs as a writing surface; Search as the ranking layer (SEO-aware writing).
- ...and the long tail: Medium, blogs, Threads, email, wherever the writer publishes.

Each surface is **a different publisher with different rules**, but the core stays constant:
two opacities (voice + algorithm), one editor, one set of underlines, one credit currency.
What changes per platform is the **ranking model** behind the algorithm score and the
**surface integration** (where the editor lives).

**What this implies for the architecture:**

- **Pluggable ranking models.** The "will it lose to the algorithm" engine generalizes from
  X's mechanics to a per-platform ranking module. The voice engine is already
  platform-agnostic (it's grounded in *your* writing).
- **Many surfaces, one engine.** Reach every writing surface the way we already reach three:
  web app, REST API, and MCP — plus browser extension / native integrations so the assistant
  rides along inside Substack, LinkedIn, Google Docs, etc.
- **One voice, everywhere.** Your voice model and top-performing patterns travel with you
  across platforms, so the assistant keeps you sounding like *you* no matter who's publishing.

---

## Open questions / to expand later

- Sequencing: which platform after X, and what's the minimum ranking model that's credible?
- Integration form factor per surface (extension vs. native app vs. API embed).
- How plan-gating and credits map across multiple platforms.
- How the historical-writing design language adapts to surfaces we don't control (extension
  overlays inside someone else's UI).

---

*Add new bets above as bullet-then-section. Keep this doc about **direction**; once a bet is
committed and scoped, promote it to the [PRD](prd.md).*
