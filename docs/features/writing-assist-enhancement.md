# Live AI Writing-Feedback Tools: Backend Logic, Cadence & Model Strategy

**A recency-filtered technical analysis (compiled July 2026)**

Scope: how tools in the Grammarly / LanguageTool class serve actionable writing
suggestions in real time — covering client-side firing cadence, the suggestion
lifecycle, the split between deterministic algorithms and ML/LLMs, model-serving
and load-balancing, and the product heuristics that govern what actually gets shown.

> **Recency note.** Findings below were parsed to remove or down-rank techniques
> that no longer reflect production/state-of-the-art practice. Where a technique is
> retained for context but is no longer the frontier (e.g. pure tagging-based GEC),
> it is explicitly labeled. A short "Superseded / down-ranked" appendix records what
> was cut and why. Primary sources are engineering blogs and peer-reviewed papers;
> third-party reconstructions of internal numbers are flagged as such.

---

## 1. The core mental model: two loops at different speeds

The central architectural idea is that these tools are **not** one system reacting to
every keystroke. They are two decoupled loops with very different latency budgets, and
most of the perceived responsiveness comes from the fast loop hiding the slow loop. [1][2]

- **Fast loop (client).** Typing, accepting, and dismissing suggestions generate event
  streams the client processes immediately to update the UI — underline positioning,
  card rendering, re-anchoring. Grammarly's web editor uses a reactive architecture
  built on an RxJS-based abstraction they call "atoms" (equivalent to what other
  frameworks now call *signals*), where an observable notifies listeners on change. [2]
  None of this requires a network round trip.

- **Slow loop (cloud).** The actual analysis runs server-side: the text change is sent
  to the back-end, which scans for issues and returns suggestions that then appear as
  cards in the editor. [1] The grammar checking itself runs on models hosted in the
  cloud, not locally, though lightweight spelling/PII passes are increasingly pushed
  on-device to trim latency. [3]

Nearly every design decision downstream exists to keep the fast loop feeling instant
while the slow loop catches up asynchronously.

---

## 2. Cadence: when the request actually fires

The request is **not** per-keystroke. The universal pattern is **debouncing**: the
analysis call fires only after the user pauses. [4][5]

- **Mechanism.** A resettable timer — each keystroke clears the prior timer and starts
  a new one, so the call runs only after typing stops for a set delay (commonly
  ~200–500 ms, tuned per app). [4]
- **Why.** A skilled typist produces ~6 keypresses/second; firing per keystroke would
  mean ~6 requests/second/user, which is untenable at scale. [5]

Mature editors use **debounce and throttle for different jobs**:

| Technique | Fires | Used for | Rationale |
|-----------|-------|----------|-----------|
| **Debounce** | after a pause | the analysis request | "intent detection" — analyze the settled text, not transient half-words [6] |
| **Throttle** | at most once per interval | background autosave | guarantees periodic execution so work isn't lost if the user navigates away mid-pause [6] |

Net cadence: keystrokes stream in → a debounced trigger waits for a short lull → the
changed region is sent → suggestions stream back → the client's reactive layer paints
them. Completed words and sentence boundaries are natural firing points because
half-typed tokens yield noisy, quickly-invalidated suggestions.

---

## 3. The suggestion lifecycle: what happens when a suggestion is applied

This is where the most interesting backend logic lives, and it is well documented. [1][7]

**State machine.** Each suggestion is a stored object. On acceptance, its state moves
from `registered` (relevant and correct) to `applied` (remove from the system). [1]

**Edits are expressed as operational-transform (OT) / Delta operations** — the same
representation used for ordinary user text changes — so a suggestion is just a Delta in
a transform field of the OT protocol. [1]

**Rebasing (the hard part).** The moment one edit lands, every other pending suggestion
is anchored to a now-stale document version. The Delta Manager must **rebase** all
registered suggestions against the new text — conceptually identical to a `git rebase`.
This is also why "accept all" is non-trivial: naively composing all suggestion Deltas at
once corrupts the text, because each was authored against the pre-edit state. [1]

**Invalidation for relevance.** If the user fixes an issue themselves, the pending
suggestion must disappear. Simple cases are easy (target word changed → hide); multi-
sentence suggestions are harder and need dedicated invalidation logic. [7]

A 2025 LLMOps analysis frames this pattern as broadly current: building intelligent
client-side logic that adapts model outputs to changing contexts reduces the need for
expensive model re-inference, and the rebase operation is conceptually analogous to how
modern LLM apps re-anchor prompt contexts or tool calls when conversation state
changes. [7] In other words, the client re-anchors and invalidates locally so it does
not re-hit the model on every edit.

---

## 4. Deterministic algorithms vs ML vs LLMs (recency-updated)

The honest practitioner answer: **a layered hybrid**, where cheap deterministic layers
still carry much of the volume, but the *frontier* has moved to LLMs. [8][9]

### 4.1 The layered stack (still current)

From cheapest/most-predictable to most-capable/most-expensive:

1. **Legacy rules & lookup.** Fast, deterministic checks — capitalization at sentence
   start, terminal punctuation, high-frequency confusions. LanguageTool is the canonical
   open example: tokenize → sentence-segment (SRX) → POS-tag → optional chunk → match
   hand-written **XML rules** describing erroneous POS-tag patterns; ~1,600+ English rules,
   extendable by editing XML. Notably it checks for *typical errors*, not grammaticality
   per se. [10][11]
2. **Statistical layer.** n-gram frequency and language-model perplexity to flag
   uncommon sequences and commonly confused words. [11]
3. **Narrow ML models.** Each targets one correction type.
4. **General neural GEC.** Handles many error types at once. [8]

**Arbitration between layers is itself deterministic.** Every match — rule-based or ML —
carries a unique **rule ID**, and IDs drive prioritization and de-duplication: if a rule
works 9 times out of 10 but the 10th needs deeper context, the AI model can be
prioritized over the rule, preventing endless correction loops and competing
suggestions on the same span. [8]

### 4.2 The neural tier — where recency matters most

**Two paradigms, now framed as minimal-edit vs fluency-edit GEC** [12]:

- **Seq2Edit / tagging** (encoder-only; e.g. Grammarly's **GECToR**, 2020): predicts a
  per-token edit operation (keep/insert/delete/replace) in a single forward pass. Its
  original selling point was ~10× faster inference than autoregressive seq2seq. [13][14]
- **Seq2Seq** (encoder-decoder): generates the corrected text.

> **Down-ranked for recency.** GECToR-style tagging (2020) is still useful for
> *minimal-edit*, latency- and cost-constrained production, but it is **no longer the
> research state of the art**. Since 2024, decoder-only **LLMs** achieve SOTA on GEC,
> and for minimal-edit English benchmarks LLMs only surpassed traditional seq2edit/
> seq2seq very recently (2025). Treat "tagging is how you make neural GEC fast" as a
> partial, dated premise — see §5. [12][15][16]

**The LLM caveat — overcorrection.** LLMs excel at fluency edits but tend to *over-edit*,
replacing acceptable text and drifting from minimal corrections; a core limitation is
that "probability is not grammaticality," so rare-but-valid words get flagged as
errors. [12][17] This is precisely why deterministic guardrails and minimal-edit
constraints matter **more**, not less, in an LLM-centric stack.

---

## 5. Making LLM correction real-time (the key 2025–2026 update)

The old dichotomy — "tagging is fast, generation is slow" — has been substantially
undercut by **speculative decoding**, which as of late 2025 moved from research to a
production standard with native support in vLLM and TensorRT-LLM (NVIDIA reporting
~3.6× throughput on H200; ~2–3× latency reduction with unchanged output quality). [18][19]

**GEC is a canonical speculative-decoding case.** Because a corrected sentence is mostly
identical to the input, **Shallow Aggressive Decoding (SAD)** uses the erroneous input
sentence *itself* as the speculative draft and has the LLM verify the whole sentence in
parallel — reported ~9–12× speedup. [20][21] This is the modern route to "LLM-quality
correction at typing latency," and it reframes the serving problem: you no longer must
choose between a fast tagger and a slow generator.

Speculative decoding is most effective exactly in this regime — low-concurrency,
interactive, single-request serving (chat, code assistants, real-time correction) — where
spare GPU compute between sequential token steps is used by a small draft model. [22]

---

## 6. Serving & load balancing

Scale framing (order-of-magnitude): a top-tier service processes ~1 billion words/day,
implying tens of millions of requests/day and hundreds of sustained RPS with much higher
peaks, against an end-to-end budget of ~100 ms. [23]

> **Sourcing caveat.** The specific RPS / per-instance throughput / 100 ms figures come
> from a third-party *reconstruction* of Grammarly's system, not Grammarly's own
> disclosures. Treat them as representative of the pattern, not verified internals. [23]

The architecture that follows from those constraints is standard modern MLOps [23][24]:

- **Microservices** (auth, document store, grammar/inference engine, billing…),
  typically on **Kubernetes** with **horizontal pod autoscaling** on the inference tier
  so capacity tracks bursty load. [23][24]
- **gRPC** for low-latency internal model calls (compact binary, streaming) over JSON/REST. [23]
- **Caching** to avoid recomputation — sentence/phrase embeddings cached (e.g. Redis)
  because real traffic is heavily repetitive. [23]
- **Optimized inference runtimes** (e.g. ONNX Runtime on GPU) with **batching** for
  throughput; **speculative decoding** where an LLM tier is in play (§5). [23][18]
- **Graceful degradation** — fall back to simpler rules when AI tiers are saturated or
  unavailable; the layered stack (§4.1) doubles as the fallback path. [25]

**Self-hosting + compression (privacy/cost driven).** The LanguageTool team hosts all
inference on their own GPU servers rather than external APIs — a privacy requirement
(EU data residency, no retention without opt-in) — and actively compresses/accelerates
models for unit economics. They explicitly declined GPT-3/4 dependence in favor of
in-house open models balancing speed, cost, and accuracy. [8][9]

---

## 7. The product-heuristics layer: whether to show a suggestion at all

Beyond "is this an error," a tuning layer decides whether a *valid* suggestion should
surface — this governs the "feel." [8][26]

- **Precision vs recall, chosen per context**, guided by whether users *applied,
  rejected, or ignored* a suggestion — the primary feedback loop. Grammarly echoes this
  on the product side: user interactions train which suggestions are useful. [8][26]
- **Suppression of correct-but-annoying rules.** Technically valid rules users dislike
  (prescriptivism that has drifted from real usage) get turned off deliberately, since
  language evolves. [8]
- **Distribution-matched training data**, so common real-world errors dominate. [8]
- **Partial rollouts + A/B tests + expert manual review** before shipping; watch for
  users rejecting a change quickly. [8]
- **Over-editing guardrails on the ML/LLM side** — edit distance (Levenshtein), cosine
  similarity, and edit tagging keep a generative model from changing more than warranted
  and preserve original meaning (directly counters LLM overcorrection, §4.2). [8]

---

## 8. Open source you can actually read

- **`grammarly/gector`** — reference seq2edit ("tag, not rewrite") implementation; the
  clearest window into the fast tagging tier (AllenNLP + HF Transformers). [14]
- **LanguageTool** (LGPL, full Java engine downloadable) — canonical open rule engine:
  XML rule format, SRX segmentation, POS pipeline, n-gram/statistical checks. [10][11]
- **`@grammarly/focal` / focal-atom** — client-side reactive "signals" for repainting
  suggestions without re-inference. [2]
- **SymSpell** (MIT) — extremely fast spell-correction at the cheap deterministic bottom
  of the stack. [11]
- **`richardxoldman/llms-for-minimal-gec`** — 2025 recipe for adapting decoder-only LLMs
  to minimal-edit GEC (the current-frontier tier). [15]

Pairing the GECToR repo (tagging tier) with LanguageTool source (rule tier) and a
minimal-edit LLM recipe (frontier tier) gives you all three layers of the modern hybrid.

---

## Appendix: superseded / down-ranked for recency

| Item | Status | Reason |
|------|--------|--------|
| GECToR "tag, not rewrite, 10× faster" as *the* way to do fast neural GEC (2020) | **Down-ranked** | Still valid for minimal-edit, latency/cost-constrained tiers, but no longer research SOTA; LLM-based GEC leads since 2024. [12][15] |
| "Autoregressive generation is inherently too slow for real-time" | **Superseded** | Speculative decoding (esp. input-as-draft SAD for GEC) makes generative LLMs viable at interactive latency. [18][20] |
| Pure rule-based checking (XML rules, 2003 lineage) as representative of the field | **Contextualized** | Retained only as the cheap/deterministic *legacy tier* and degradation fallback — not the frontier. [10][25] |
| Product-detail specifics | **Noted** | Grammarly's parent rebranded (Superhuman Suite, 2025); "Expert Review" discontinued March 2026 — minor, product-level, not architectural. [3] |

---

## References

1. Grammarly Engineering Blog — *How Suggestions Work in the Grammarly Editor* (OT/Delta, rebasing, applied/registered states), 2022. https://www.grammarly.com/blog/engineering/how-suggestions-work-grammarly-editor/
2. Grammarly Engineering Blog — *Learn About Signals With @grammarly/focal* (reactive atoms/signals), 2023. https://www.grammarly.com/blog/engineering/signals-with-focal-library/
3. autogpt.net — *What Are Grammarly's AI Features (2026)* (cloud architecture; Superhuman rebrand; Expert Review discontinued), 2026. https://autogpt.net/what-are-grammarlys-ai-features/
4. Medium (J. Sharma) — *What is Debouncing?* (resettable-timer mechanism, thresholds), 2025. https://medium.com/@jaikumarsharma94130/what-is-debouncing-how-to-build-a-debounced-search-bar-in-react-388eaa172888
5. Developer Way — *How to debounce and throttle in React* (keypress rate, request reduction), 2023. https://www.developerway.com/posts/debouncing-in-react
6. Tomek Dev — *Throttle vs Debounce on real examples* (autosave = throttle; intent = debounce). https://tomekdev.com/posts/throttle-vs-debounce-on-real-examples
7. ZenML LLMOps Database — *Grammarly: Production-Scale NLP Suggestion System* (invalidation, rebase-as-modern-pattern), 2025. https://www.zenml.io/llmops-database/production-scale-nlp-suggestion-system-with-real-time-text-processing
8. Data Science Talent — *Using Open Sourced LLMs in Language* (Bartmoss St Clair, LanguageTool: rule-ID prioritization, hybrid layering, precision/recall, self-hosting), 2024. https://datasciencetalent.co.uk/using-open-sourced-llms-in-language-by-bartmoss-st-clair/
9. Data Science Conversations — *Using Open Source LLMs for GEC* (LanguageTool declined GPT-3/4; in-house, low-latency, privacy), 2024. https://datascienceconversations.com/podcasts/using-open-source-llms/
10. Wikipedia — *LanguageTool* (XML/Java rules, n-grams, "typical errors not grammaticality"), 2026. https://en.wikipedia.org/wiki/LanguageTool
11. Naber et al. / systematic review (arXiv:1804.00540) — LanguageTool pipeline and ~1,614 English XML rules; statistical + perplexity checks. https://arxiv.org/pdf/1804.00540
12. Staruch et al., *Adapting LLMs for Minimal-edit GEC*, BEA 2025 (arXiv:2506.13148) — minimal- vs fluency-edit; LLM SOTA; overcorrection. https://arxiv.org/html/2506.13148v1
13. Omelianchuk et al., *GECToR – Grammatical Error Correction: Tag, Not Rewrite*, ACL BEA 2020. https://aclanthology.org/2020.bea-1.16/
14. GitHub — *grammarly/gector* (official implementation; ~10× faster inference claim). https://github.com/grammarly/gector
15. GitHub — *richardxoldman/llms-for-minimal-gec* (2025 LLM minimal-edit recipe; released with [12]).
16. arXiv:2604.06573 — *Scoring Edit Impact in GEC* (field "shifted towards LLM-based GEC"), 2026. https://arxiv.org/html/2604.06573
17. Bryant et al., *Grammatical Error Correction: A Survey of the State of the Art*, MIT Press Computational Linguistics, 2023 ("probability is not grammaticality"). https://direct.mit.edu/coli/article/49/3/643/115846/
18. Introl — *Speculative Decoding: 2–3× LLM Inference Speedup* (Dec 2025: research→production standard; vLLM/TensorRT-LLM; H200 3.6×). https://introl.com/blog/speculative-decoding-llm-inference-speedup-guide-2025
19. COLING 2025 Tutorial — *Speculative Decoding for Efficient LLM Inference*. https://speculative-decoding.github.io/
20. Xia et al., *Unlocking Efficiency … A Survey of Speculative Decoding* (arXiv:2401.07851) — SAD uses errorful input as draft, 9–12× speedup. https://arxiv.org/pdf/2401.07851
21. Sun et al., *Instantaneous Grammatical Error Correction with Shallow Aggressive Decoding*, ACL-IJCNLP 2021 (arXiv:2106.04970; discussed in [19][20]).
22. Red Hat Developer — *How speculative decoding delivers faster LLM inference* (interactive/low-concurrency regime), 2026. https://developers.redhat.com/articles/2026/06/12/how-speculative-decoding-delivers-faster-llm-inference
23. developersvoice.com — *Grammarly in .NET* (third-party reconstruction: ~1B words/day, ~100 ms budget, gRPC, ONNX, Redis, K8s HPA), 2025. https://developersvoice.com/blog/practical-design/grammarly-dotnet-implementation-guide/
24. technologywithvivek.com — *Behind the Scenes of Grammarly* (microservices, Docker/K8s, Go/C++ services), 2025. https://www.technologywithvivek.com/2025/05/Top%20programming%20languages%20used%20in%20Grammarly.html
25. System Design Handbook — *Grammarly System Design* (five-nines reliability, graceful degradation to simpler rules), 2025. https://www.systemdesignhandbook.com/guides/grammarly-system-design-interview/
26. Grammarly — *How Grammarly's Product Works* (user interactions train usefulness; hybrid human + neural + rule-based). https://www.grammarly.com/how-grammarly-works

---

*Compiled July 2026. Architecture/blog details reflect public disclosures as of their
publication dates; the research-frontier claims (§4.2, §5) reflect 2024–2026 GEC and
LLM-serving literature. Reconstructed internal metrics are flagged inline.*