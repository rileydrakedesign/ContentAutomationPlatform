# algo-principles.md
Algorithm-aligned principles for generating X posts + replies (derived from the open-source xai-org/x-algorithm repo’s documented ranking objectives, targets, and filters).

## 0) Objective
Generate posts and replies that increase the likelihood of:
- **Meaningful engagement** (replies, quotes, reposts)
- **Depth actions** (click, profile click, follows)
- **Time-on-post** (dwell / reading / viewing)
…while minimizing negative feedback signals (e.g., “not interested,” mutes, reports).

## 1) Core ranking model reality (what to optimize for)
The rank score is described as a **weighted combination of predicted user actions**. Write content that reliably increases predicted probabilities for:
- **Reply** and **Quote** (conversation + debate)
- **Share** (forwardability)
- **Click** and **Profile click** (depth)
- **Follow author** (conversion)
- **Dwell / media viewing** (time)

And actively avoid patterns that raise predicted probabilities for negative actions:
- “Not interested”
- Mute / block / report

## 2) Universal content rules (apply to posts and replies)
### 2.1 Optimize for at least 2 “winning actions”
Every output must intentionally drive **at least two** of:
- Reply, Quote, Share, Click, Profile Click, Follow, Dwell

### 2.2 One-screen clarity + skimmability
- Use short lines, clear structure, and readable density.
- Prefer lists, steps, checklists, or crisp paragraphs over walls of text.

### 2.3 Deliver value quickly (no vague bait)
- Hook must create curiosity **and** the body must pay it off with specifics.
- Do not be cryptic. Do not “thread-bait” without substance.

### 2.4 Novelty over near-duplicates
- Avoid producing near-identical posts/replies.
- Rephrase is not enough—introduce a new angle, example, or constraint.

### 2.5 Reduce “negative-signal” risk
Avoid:
- Spammy CTAs (“like/repost/follow” phrasing)
- Overheated ragebait framing
- Repetitive promo language
- Unclear claims or misleading certainty

## 3) Post principles (what the generator should produce)
### 3.1 Post archetypes that align with high-value actions
Choose 1 primary archetype per post (and include the structure):
1) **Framework / Decision rule**  
   - Hook: “Use this rule to decide X”  
   - Body: 3–7 steps or criteria  
   - CTA: “What’s your rule?” (reply/quote)
2) **Tactical checklist**  
   - Hook: “If you do X, run this checklist”  
   - Body: checklist + example  
   - CTA: “Want a version for [subcase]?” (reply)
3) **Contrarian w/ proof**  
   - Hook: “Most people get X wrong”  
   - Body: claim → reasoning → example → caveat  
   - CTA: “What am I missing?” (high-signal replies)
4) **Case study / teardown**  
   - Hook: “Here’s how X worked (and why)”  
   - Body: context → move → result → lesson  
   - CTA: “Should I break down Y next?” (reply)
5) **Comparison / tradeoff**  
   - Hook: “A vs B: here’s when each wins”  
   - Body: decision table / bullets  
   - CTA: “Which camp are you in?” (replies + quotes)

### 3.2 Post format requirements
- Strong first line (hook) that signals the topic + payoff.
- Body should contain at least one of:  
  - numbered steps  
  - a checklist  
  - a decision rule  
  - a concrete example  
- End with a **non-spam** prompt that invites expert replies:
  - “What’s the edge case I’m missing?”
  - “What would you change for [specific scenario]?”
  - “Which assumption breaks first?”

### 3.3 Dwell boosters (use sparingly, only when honest)
- “Here’s the exact template: …”
- “Save this for later: …”
- “If you only remember one thing: …”

## 4) Reply principles (what the generator should produce)
### 4.1 Replies are conversion assets
A reply should read like a mini-post that triggers:
- profile clicks
- follows
- quote reposts

### 4.2 Reply structure (default)
Use this 3-part format unless the user requests otherwise:
1) **Stance (1 line):** agree/disagree/nuance, clearly.  
2) **Value (2–5 lines):** new insight, missing step, correction, or framework.  
3) **Concrete (1 example):** a scenario, metric, or tiny template.

### 4.3 “Single-reply completeness”
Assume only one reply from you will be seen or selected prominently in a thread.
- Put the best version of the idea in **one** reply.
- Do not split key logic across multiple replies.

### 4.4 Reply types to choose from (pick 1)
1) **Add a missing step** (“One step you’re missing is…”)  
2) **Tighten the claim** (“I’d narrow this to… because…”)  
3) **Offer an edge case** (“This breaks when…”)  
4) **Provide a mini-template** (“Here’s a 3-line version you can reuse…”)  
5) **Friendly correction** (“Small correction: … source/logic …”)  

### 4.5 Reply anti-patterns
Avoid:
- generic praise (“Great post!”) with no payload
- repeating the OP in new words
- dunking / hostile tone
- engagement-bait questions (“Thoughts?”) with no substance

## 5) Safety + filter-aware guidelines (content survivability)
- Avoid risky phrasing that might be interpreted as harassment or incitement.
- Avoid sensitive-topic escalation and personal attacks.
- Keep claims tight, specific, and non-defamatory.

## 6) “Action mapping” checklist (use during generation)
Before finalizing output, ensure it includes at least:
- **One depth trigger:** a concrete artifact, example, or template (click/dwell)
- **One conversation trigger:** a precise question or tradeoff (reply/quote)
- **Zero spam signals:** no “like/follow/repost” directives, no repetitive promo

## 7) Output spec for the suggester (how to write)
### 7.1 Style
- Minimal fluff, high density, readable formatting.
- Prefer short sentences.
- Prefer direct, falsifiable claims with constraints.
- Include caveats when needed (“This applies when… / unless…”).

### 7.2 Post length
- Default: 5–12 lines total.
- If longer, use clear section breaks or numbering.

### 7.3 Reply length
- Default: 3–8 lines.
- If the thread is high-signal, allow up to ~12 lines with structure.

## 8) Templates (ready for generation)
### Post template: Framework
- Hook: “If you’re trying to [goal], use this rule:”
- Steps:
  1) …
  2) …
  3) …
- Example: “Example: …”
- Close: “What’s the edge case you’ve run into?”

### Post template: Contrarian w/ proof
- Hook: “Most advice on [topic] fails because [reason].”
- Claim: “The real lever is [lever].”
- Proof: “Why: …”
- Example: “In practice: …”
- Close: “If you disagree, which assumption is wrong?”

### Reply template: Add missing step
- Stance: “Agree—this is directionally right.”
- Missing step: “One step that changes outcomes is: …”
- Reason: “Because: …”
- Example: “Example: …”
- Prompt: “Curious—are you optimizing for [A] or [B]?”

### Reply template: Tighten claim
- Stance: “I’d narrow this slightly: …”
- Constraint: “This is true when…”
- Edge case: “It breaks when…”
- Example: “Example: …”

---
End of file.
