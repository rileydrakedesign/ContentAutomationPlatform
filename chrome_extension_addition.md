# Chrome Extension + Dashboard Integrated App  
## Product & UX Development Outline (Loose / Stack-Agnostic)

---

## Product Vision
Create a personal X post assistant that helps creators:
- capture high-signal posts (their own and others’) while browsing
- learn what performs well over time
- turn that learning into repeatable post structures and voice patterns
- generate better posts using real personal data instead of generic templates

The system should feel like:
- **Extension = frictionless capture**
- **Dashboard = thinking, learning, and writing**

---

## Core Experience Principles
- Capture should never interrupt browsing flow
- Organization should be optional but encouraged
- Insights should emerge automatically from usage
- Writing should stay simple: *source + inspiration → draft*

---

## Component Responsibilities

### Chrome Extension — Capture Layer
**Purpose:** Collect signal, not think.

The extension exists to save posts *in context* with as little friction as possible.

Primary responsibilities:
- Save post content when the user explicitly asks
- Capture visible metadata and engagement context
- Let the user optionally add lightweight intent (tags / collections)
- Sync reliably and transparently with the dashboard

What the extension should *not* do:
- Analytics
- Writing or generation
- Deep browsing or management

If the user spends more than a few seconds in the extension UI, something is wrong.

---

### Dashboard — Library, Insight, and Writing Layer
**Purpose:** Turn captured signal into leverage.

The dashboard is where:
- posts live long-term
- patterns are discovered
- writing happens

It should feel calm, intentional, and focused on reuse.

---

## Key User Flows

### Flow 1 — Capture a Post
- User browses X normally
- User clicks **Save**
- Post is added to the system immediately
- Optional: quick tag or collection assignment
- User continues browsing

Success criteria:
- No cognitive interruption
- No required decisions
- Clear confirmation that the post is saved

---

### Flow 2 — Inbox Triage
Captured posts land in an **Inbox**.

Inbox behaviors:
- Fast bulk triage
- Optional organization
- Clear distinction between:
  - *My posts*
  - *Inspiration posts*

Inbox should reward light organization without requiring it.

---

### Flow 3 — Learning From Your Own Posts
Posts marked as “My posts” unlock learning.

Over time, the system should surface:
- which posts performed best
- recurring hook patterns
- common structures
- tone and length trends

The output of this learning is not charts—it’s **reusable guidance**:
- templates
- phrasing tendencies
- structure defaults

---

### Flow 4 — Writing a New Post
Writing always starts from intent, not data.

Studio flow:
1. Choose a **source** (voice note transcript)
2. Choose **inspiration**
   - single post
   - collection
   - “my best posts”
3. Generate a draft
4. Iterate lightly
5. Save or export

The user should never feel like they’re “prompt engineering.”

---

## Content Objects (Conceptual)

### Captured Post
A saved post is a reference object, not just text.

It represents:
- wording
- structure
- context
- performance (when available)
- *why it was saved*

---

### Voice Source
Voice sources represent raw thinking:
- transcripts
- notes
- ideas
- fragments

They are intentionally messy.

---

### Collection
Collections are *working sets*, not folders.

They might represent:
- a creator
- a post style
- a recurring theme
- a personal experiment

Collections should feel disposable and flexible.

---

### Template (Emergent)
Templates are derived, not authored upfront.

They emerge from:
- repeated use
- high-performing posts
- consistent structure patterns

Users shouldn’t need to “design” templates; they should discover them.

---

## UX Patterns That Matter

### Save in Context
- In-page save affordance is critical
- Popup-only capture feels heavy
- Clear visual feedback builds trust

---

### Progressive Structure
- First-time users can save without organizing
- Power users can tag, group, and refine
- The product should never punish minimal effort

---

### Gentle Intelligence
Insights should feel like:
> “Here’s what *you* tend to do when posts work”

Not:
> “Here’s a generic best practice”

---

## Success Metrics (Qualitative)
- Users save posts reflexively
- Inbox does not grow unbounded
- Users reuse their own past posts as inspiration
- Generated drafts feel “close” on first pass
- Users trust the system’s voice alignment

---

## Near-Term Product Evolution (Non-Prescriptive)

Potential directions as usage grows:
- automatic clustering of similar posts
- suggested inspirations during writing
- “you’ve written this before, differently” prompts
- light performance feedback loop after posting
- post-type presets (“breakdown”, “story”, “observation”)

These should be pulled by user behavior, not pushed prematurely.

---

## Product Definition of Done
The product is working when:
- capturing posts feels effortless
- writing feels faster and more “you”
- past success is continuously reused
- the system improves *because* it’s used
- the tool feels personal, not generic

The extension and dashboard should disappear into the workflow—  
the only thing the user notices is better posts.
