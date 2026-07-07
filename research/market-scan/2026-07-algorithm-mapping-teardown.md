# How the Market Maps the X Algorithm — and What Is Actually Knowable

> **Purpose:** Investigate how companies selling "algorithm scoring / alignment" actually derive their scores, against the ground truth of what X has genuinely disclosed. Primary source: a direct read of the **`xai-org/x-algorithm` source code** (cloned and inspected 2026-07-07; release commit dated **2026-05-15**, "Open-source X Recommendation Algorithm" — the updated drop following the Jan 20, 2026 release). Secondary: competitor methodology claims via recent web research.
> **Why it matters:** our product's core promise is a *grounded* algorithm read. This doc establishes (a) what we can claim with receipts, (b) what competitors are claiming without them, and (c) the narrative gifts hiding in the actual source.
> **Date:** 2026-07-07 · companion to `2026-07-direct-competitor-scan.md`

---

## 1. Ground truth: what the open-source release actually contains (verified by reading the code)

Repo structure: `home-mixer` (Rust orchestration: sources → hydrators → filters → scorers → selectors), `thunder` (in-network candidates), `phoenix` (the Grok-based transformer: retrieval + ranking, JAX), `grox` (LLM content-understanding service), `candidate-pipeline` (framework), plus an ads-blending module and a runnable mini model (256-dim, 2-layer) via Git LFS.

### 1a. The ranking formula — shape public, numbers withheld

`home-mixer/scorers/weighted_scorer.rs` computes exactly what the README describes:

```
Final Score = Σ ( weight_i × P(action_i) )        // then author-diversity attenuation + normalization
```

over **19 predicted-engagement terms** (the README lists 15 heads; the scorer adds granular share variants and continuous dwell):
`favorite, reply, retweet, photo_expand, click, profile_click, video_quality_view (gated ≥ min video duration), share, share_via_dm, share_via_copy_link, dwell, quote, quoted_click, continuous dwell_time, follow_author` **(positive)** and `not_interested, block_author, mute_author, report` **(negative)**.

**Crucially: every weight constant (`p::FAVORITE_WEIGHT`, `p::REPLY_WEIGHT`, …) lives in a `params` module that is NOT in the release** — `ranking_scorer.rs` even reads them via dynamic `params.get(...)`, i.e., they're runtime-tunable server-side. **X published the formula but redacted the coefficients.** Anyone publishing "the 2026 weights" is extrapolating or fabricating (§3).

### 1b. "No hand-engineered features" — the transformer learns relevance

Stated in README Key Design Decisions and consistent with the code: the model consumes the user's engagement-history sequence + hash-based author/post embeddings; there is no feature file of content heuristics. Two consequences:

- **There is NO explicit link-demotion rule in the released ranking code.** The only "link" in the scorer is the *share_via_copy_link* engagement head (a positive). The measured 30–50% link-post reach gap (2025–26 empirical studies) is real-world attested but is a *learned/upstream behavior*, not a visible rule. → Our copy should say "measured behavior," never "a rule in the code."
- **Candidate isolation** (posts can't attend to each other during inference; scores are per-post consistent and cacheable) — a design fact that makes per-draft scoring *conceptually legitimate*: X itself scores each post independently against a user context.

### 1c. The narrative gift: X runs an LLM read on every post — including a slop score

The `grox/` service is the part nobody in the market is talking about, and it's the closest thing to *our product inside X's own stack*:

- **`banger_initial_screen.py`** — a Grok VLM classifier run through the publish-annotation pipeline that returns, per post: a **`quality_score` (0–1; "banger" threshold ≥ 0.4)**, a description, tags, taxonomy categories, **`slop_score` (1–3 scale)**, and boolean metadata including **`isHighQuality`** and **`isSpam`** (`task_pub.py` records slop_score_1/2/3 and is_high_quality counters on every annotated post).
- **`spam.py`** — `SpamEapiLowFollowerClassifier`: an LLM spam screen aimed at **low-follower accounts' comments** (directly relevant to the reply-guy segment: small accounts' replies are LLM-judged for spam).
- **`reply_ranking.py`** — a `ReplyScorer` LLM that scores replies for conversation ranking (reply quality is judged, not just counted).
- **`safety_ptos.py`, `post_safety_screen_deluxe.py`** — safety/policy screens.
- **The classifier prompts (`grox/prompts/…`) are redacted** — the criteria exist but weren't published, same as the weights.

**Product implication (big):** *X literally scores your post with an LLM at publish time — for quality and for slop.* Our pre-publish LLM read is a mirror of the platform's actual mechanism, run *before* you ship instead of after. No competitor is using this fact. ("The algorithm now reads your post with Grok and scores it for slop. We run the same kind of read before you post.")

### 1d. What else is verified in-code

- **Filters** (deterministic, pre-scoring): age, dedup/conversation-dedup, previously-seen/served, self-posts, muted keywords, blocked/muted authors, retweet dedup, ineligible-subscription, visibility filtering. No content-quality heuristics here.
- **Author diversity attenuation** — repeated same-author candidates are down-scored in a session (don't expect multiple posts to all rank at once).
- **Negative heads are first-class** — `not_interested`, `block_author`, `mute_author`, `report` are predicted and weighted negatively. The 2023-era lesson (negative feedback is brutal) survives architecturally even though the −74/−369 numbers don't carry over.
- **Video is special-cased** — the VQV (video quality view) weight only applies above a minimum duration; continuous `dwell_time` is a separate term from binary `dwell`.
- **Grok Topics / content categories** feed the pipeline (taxonomy in the banger screen; topic hydrators in home-mixer) — topical relevance mediated by LLM understanding, replacing the old SimClusters story.

---

## 2. How the scoring/alignment products actually map the algorithm (methodology teardown)

| Product | Method (as claimed/observed) | Grounded in the 2026 release? | Personal? | Weakness |
|---|---|---|---|---|
| **TweetAlgo** (free + "AI Boost") | Deterministic checklist: length, media presence, question hooks, banned words, emoji, links, account type → 0–100 "viral score," spam risk, dwell estimate, estimated reach from follower count. Rewrites via **Gemini**. | Loosely — factor names echo the discourse (dwell, bait), but scores/estimates have no stated source; several factors (e.g., link penalties as a hard rule) aren't in the release. | No — same score for everyone. | Unfalsifiable numbers ("estimated reach"); generic rewrite engine on top. Lead-magnet economics. |
| **OpenTweet Algorithm Scorer** (free) | 8-dimension checklist: length, hook, engagement triggers, readability, hashtags, value/substance, CTA, spam signals. | No — classic copywriting heuristics relabeled as "algorithm." | No | Readability/CTA/hashtags aren't ranking terms in any X release, 2023 or 2026. |
| **tweetpredictor.io** (free) | "9 proven factors" from wording/structure/timing → forecast likes/RTs/reach. | No stated basis. | No | Predicts absolute engagement with no account context — structurally impossible to be accurate. |
| **viralpredictor.com** | A/B compare variants with an engagement forecast. | No stated basis. | No | Same as above. |
| **PostEverywhere Viral Score** (free) | Hooks/spacing/sentiment pattern-matching "against thousands of high-performing posts" + publishes a "simplified 2026 formula": *Likes×1 + Retweets×20 + Replies×13.5 + Profile Clicks×12 + Link Clicks×11 + Bookmarks×10*. | **Partly fabricated** — that table splices 2023 heavy-ranker numbers (13.5, 12, 11) with invented ones (RT×20, bookmarks×10); the actual 2026 weights are redacted (§1a). Bookmarks aren't even a scored head in the release. | No | The clearest example of the market's credibility gap. |
| **SuperX "Algorithm Simulator"** ($39/mo) | LLM "virtual audience": simulates how users+algorithm might react to a draft, predicts engagement, A/B tests variants; claims to stay current by "constantly analyzing the X feed." | Indirectly — persona simulation is a defensible proxy for a transformer that predicts P(action) per user, but it's a black box: no per-claim grounding, no stated tie to the release. | Partially (your niche/feed context) | Prediction without explanation; unverifiable "stays up to date" claim. The most serious methodology in the scorer set. |
| **Grok "Enhance your post"** (X native, testing) | Rewrites via Grok (proofread, styles); presumably could see internal signals but currently just text-to-text rewriting. | n/a (is the platform) | No voice model | Takes the pen; no coaching, no why. |
| **Educator/blog layer** (Typefully, ppc.land, singhajit, tianpan, piunikaweb…) | Read the release, publish explainers; monetize adjacent products. | Yes (the good ones) | n/a | Analysis, not tooling — but they're training the market to expect receipts. |

**Pattern:** the free scorers map *folklore*, not the algorithm; the one paid simulator (SuperX) maps *plausible black-box prediction*; **nobody maps the release itself, per-user, with citations.** The market's "algorithm alignment" is almost entirely: (a) 2023 weight nostalgia, (b) copywriting heuristics relabeled, (c) invented reach estimates, or (d) unexplainable simulation.

---

## 3. The three tiers of "knowable" (our claims framework)

**Tier A — verified in the published code (cite the repo file):**
The 19-term weighted-sum shape; the full list of positive/negative predicted actions; dwell (binary + continuous) and video-quality-view as first-class terms; author-diversity attenuation; candidate isolation; muted-keyword and dedup filters; the publish-time Grok annotation pipeline with `quality_score` (banger ≥ 0.4), `slop_score` (1–3), `isHighQuality`/`isSpam` metadata; LLM spam screening of low-follower comments; LLM reply ranking.

**Tier B — empirically attested, not in the code (say "measured," cite the study/date):**
Link-post reach gap (~30–50%, tightened early 2026); early-velocity effects (first 30–60 min); engagement-bait down-ranking (policy statements + Tier-A negative heads make the *mechanism* plausible); reply>like *ordering* (2023 weights + unchanged head structure make it the safest ordering assumption, but the 27× number is 2023's).

**Tier C — folklore / fabricated (never claim; call out competitors who do):**
Any specific 2026 numeric weight (all redacted); "bookmarks are weighted ×10"; hashtag counts as ranking factors; readability/CTA scores; absolute reach predictions from text alone.

---

## 4. Implications for the product (actionable)

1. **Update `src/lib/analysis/x-algorithm.ts`** (currently a 2023-weights snapshot with an "announced Grok migration" caveat — now outdated):
   - Reframe the table around the **2026 head list** (what X predicts) with 2023 numbers demoted to "last published coefficients (2023); 2026 coefficients are redacted."
   - Keep the *ordering* claims (replies/dwell/profile-clicks ≫ likes; negative feedback catastrophic) as Tier-B with the head structure as Tier-A support.
   - Reword the link flag: "measured ~30–50% reach gap for link posts (2025–26 studies)" — not a rule in the code.
   - Add new Tier-A flags where deterministic checks map to real mechanisms: video length gate (VQV), author-diversity (don't stack posts), muted-keyword exposure.
   - Update `X_ALGORITHM_CAVEAT` to cite `xai-org/x-algorithm` (Jan/May 2026) and the weights-redaction fact — honesty *is* the differentiator (§3).
2. **Adopt the "X scores slop; we pre-screen it" narrative.** The banger/slop classifier is the strongest possible grounding for both the voice/anti-slop wedge *and* the LLM pre-publish read — the platform itself runs an LLM quality judge on every post. This also reframes L3 cost as mirroring production reality, not an arbitrary product choice.
3. **Reply product gets new ammunition:** low-follower replies are LLM-screened for spam and replies are LLM-ranked for quality → "your replies are being judged by Grok; make them worth ranking" is Tier-A grounded and speaks directly to the reply-growth ICP's safety+quality anxiety.
4. **Attack line vs. the scorer market:** "Most 'algorithm scores' are 2023 numbers, invented multipliers, or copywriting checklists. X redacted the real weights — here's what's actually in the release, and here's how *your* account's data fills the gap." Our own-analytics loop is the honest answer to the redaction: where the global coefficients are hidden, *your measured performance* is the best available signal — that argument fuses the two wedges (algorithm legibility + own data) into one story.
5. **Watch SuperX's simulator** — the only methodology that could converge toward ours; its gap (no explanation, no receipts, no personal grounding) is exactly our positioning.

---

## 5. Sources

- **Primary:** `xai-org/x-algorithm` (cloned 2026-07-07; commit 2026-05-15): `README.md`, `home-mixer/scorers/weighted_scorer.rs`, `home-mixer/scorers/ranking_scorer.rs`, `home-mixer/filters/*`, `phoenix/runners.py`, `phoenix/recsys_model.py`, `grox/classifiers/content/{banger_initial_screen,spam,reply_ranking,safety_ptos}.py`, `grox/tasks/task_pub.py`. https://github.com/xai-org/x-algorithm
- Release coverage: TechCrunch (2026-01-20) https://techcrunch.com/2026/01/20/x-open-sources-its-algorithm-while-facing-a-transparency-fine-and-grok-controversies/ ; ppc.land analysis https://ppc.land/xs-algorithm-source-code-drops-what-it-reveals-about-the-platforms-feed-mechanics/
- Competitor methodology claims (search-indexed, several sites block direct fetch): tweetalgo.com; opentweet.io/tools/tweet-algorithm-scorer; tweetpredictor.io; viralpredictor.com/twitter-predictor; posteverywhere.ai/tools/viral-score-predictor + posteverywhere.ai/blog/how-the-x-twitter-algorithm-works (the spliced weight table); superx.so + reviews (futurepedia.io, brandled.app, toolmage.com)
- Grok Enhance (composer): testingcatalog.com/new-x-feature-lets-users-proofread-and-rewrite-posts-with-grok/
- Historical baseline: twitter/the-algorithm-ml (2023 heavy-ranker weights — the source of our current `x-algorithm.ts` figures)
