import { describe, it, expect } from "vitest";
import { runTier0 } from "./tier0";
import { resolveQuote, resolveFindings, buildSegments, applyReplacement, guardedFix } from "./spans";
import { composeScores, scorePenalties, resemblanceToGrade, FINDING_DEDUCTIONS } from "./score";
import { mergeReport, type AssistantScores, type AssistantFindings } from "./merge";
import type { Finding } from "./types";

describe("runTier0 — deterministic findings", () => {
  it("underlines an external link as a reach problem", () => {
    const r = runTier0({ text: "check out https://example.com/post it's great" });
    const link = r.findings.find((f) => f.signal === "external_link");
    expect(link).toBeTruthy();
    expect(link!.class).toBe("reach");
    expect(link!.severity).toBe("problem");
    expect(link!.span?.quote).toContain("example.com");
    // the span must actually point at the link in the text
    const { start, end } = link!.span!;
    expect("check out https://example.com/post it's great".slice(start, end)).toBe(link!.span!.quote);
  });

  it("underlines engagement-bait phrases", () => {
    const r = runTier0({ text: "RT if you agree, and follow for more" });
    const bait = r.findings.filter((f) => f.signal === "negative_feedback");
    expect(bait.length).toBeGreaterThanOrEqual(2); // "rt if" and "follow for"
    expect(bait.every((f) => f.class === "reach")).toBe(true);
  });

  it("adds a good reply-hook badge when a question is present", () => {
    const r = runTier0({ text: "what do you think about this?" });
    const badge = r.badges.find((b) => b.id === "reply-hook");
    expect(badge?.status).toBe("good");
    // no 'add a question' chip when the hook already exists
    expect(r.chips.find((c) => c.id === "chip:reply-hook")).toBeUndefined();
  });

  it("flags a missing reply hook with a caution badge + nudge chip", () => {
    const r = runTier0({ text: "Shipped a thing today." });
    expect(r.badges.find((b) => b.id === "reply-hook")?.status).toBe("caution");
    expect(r.chips.find((c) => c.id === "chip:reply-hook")).toBeTruthy();
  });

  it("quiets the no-reply-hook nag for authenticity-first users", () => {
    const r = runTier0({ text: "Shipped a thing today.", authenticity: 90 });
    expect(r.badges.find((b) => b.id === "reply-hook")).toBeUndefined();
    expect(r.chips.length).toBe(0);
  });

  it("still flags the hard link penalty even for authenticity-first users", () => {
    const r = runTier0({ text: "read https://example.com", authenticity: 95 });
    expect(r.findings.find((f) => f.signal === "external_link")).toBeTruthy();
  });

  it("underlines guardrail avoid-words as voice findings", () => {
    const r = runTier0({ text: "this is a synergy play", avoidWords: ["synergy"] });
    const avoid = r.findings.find((f) => f.signal === "guardrail");
    expect(avoid?.class).toBe("voice");
    expect(avoid?.span?.quote).toBe("synergy");
  });

  it("trims filler words on whole-word boundaries only", () => {
    const r = runTier0({ text: "justice is just really important" });
    const filler = r.findings.filter((f) => f.signal === "filler");
    // "just" and "really" flagged (span may include a trailing space); "justice" not
    const quotes = filler.map((f) => (f.span?.quote || "").trim().toLowerCase());
    expect(quotes).toContain("just");
    expect(quotes).toContain("really");
    expect(quotes).not.toContain("justice");
  });

  it("makes the link and engagement-bait findings removable (one-click fix)", () => {
    const r = runTier0({ text: "great stuff RT if you agree" });
    const bait = r.findings.find((f) => f.signal === "negative_feedback");
    expect(bait?.replacement).toBe("");
    // accepting the bait removal cleanly cuts the phrase (and an adjacent space)
    expect(applyReplacement("great stuff RT if you agree", bait!).text).toBe("great stuff you agree");

    const link = runTier0({ text: "read https://example.com now" }).findings.find(
      (f) => f.signal === "external_link"
    );
    expect(link?.replacement).toBe("");
  });

  it("flags the 3rd+ hashtag as removable reach findings", () => {
    const r = runTier0({ text: "shipping #build #indie #saas #startup" });
    const tags = r.findings.filter((f) => f.signal === "hashtag_spam");
    expect(tags.length).toBe(2); // #saas and #startup (the 3rd and 4th)
    expect(tags.every((f) => f.class === "reach" && f.replacement === "")).toBe(true);
    // 1–2 hashtags are fine — no flag
    expect(runTier0({ text: "shipping #build #indie" }).findings.some((f) => f.signal === "hashtag_spam")).toBe(false);
  });

  it("flags a leading @mention as a reach finding (card, no auto-fix)", () => {
    const r = runTier0({ text: "@someone totally agree with this" });
    const lead = r.findings.find((f) => f.signal === "leading_mention");
    expect(lead?.class).toBe("reach");
    expect(lead?.span?.quote).toBe("@someone");
    expect(lead?.replacement).toBeUndefined();
    // a mid-post mention is fine
    expect(runTier0({ text: "totally agree with @someone" }).findings.some((f) => f.signal === "leading_mention")).toBe(false);
  });

  it("lowers reach for hashtag spam and a leading mention", () => {
    const clean = runTier0({ text: "what's your take on shipping fast?" }).scores.reach;
    const spam = runTier0({ text: "what's your take? #a #b #c #d" }).scores.reach;
    const lead = runTier0({ text: "@bob what's your take on this?" }).scores.reach;
    expect(spam).toBeLessThan(clean);
    expect(lead).toBeLessThan(clean);
  });

  it("drops reach when a link is present and raises it with a reply hook", () => {
    const linkScore = runTier0({ text: "read https://example.com now" }).scores.reach;
    const hookScore = runTier0({ text: "what's your take on this?" }).scores.reach;
    expect(hookScore).toBeGreaterThan(linkScore);
  });

  it("flags markdown that won't render on X as removable correctness findings", () => {
    const r = runTier0({ text: "this is **bold** and a [link](https://x.com) and `code`" });
    const md = r.findings.filter((f) => f.signal === "markdown");
    expect(md.length).toBe(3);
    expect(md.every((f) => f.class === "correctness")).toBe(true);
    const bold = md.find((f) => f.span?.quote === "**bold**");
    expect(bold?.replacement).toBe("bold"); // strips the markers
    const link = md.find((f) => f.span?.quote.startsWith("[link]"));
    expect(link?.replacement).toBe("link https://x.com");
  });

  it("strips a markdown heading prefix while keeping the title", () => {
    const r = runTier0({ text: "## My Big Header" });
    const heading = r.findings.find((f) => f.signal === "markdown");
    expect(heading?.span?.quote).toBe("## ");
    expect(heading?.replacement).toBe("");
    expect(applyReplacement("## My Big Header", heading!).text).toBe("My Big Header");
  });

  it("does not flag plain text as markdown", () => {
    const r = runTier0({ text: "a normal post with no markdown at all" });
    expect(r.findings.some((f) => f.signal === "markdown")).toBe(false);
  });

  it("marks the headline score provisional before a live read", () => {
    const r = runTier0({ text: "hello world" });
    expect(r.scores.postProvisional).toBe(true);
    expect(r.scores.voice).toBeNull();
    expect(r.scores.performance).toBeNull();
  });
});

describe("spans — anchoring is miscount-proof", () => {
  it("resolves a quote to its offsets", () => {
    expect(resolveQuote("the quick brown fox", "brown")).toEqual({ start: 10, end: 15 });
  });

  it("returns null when the quote is absent (degrades to a card)", () => {
    expect(resolveQuote("the quick brown fox", "purple")).toBeNull();
  });

  it("uses the hint to disambiguate repeated quotes", () => {
    const text = "go go go";
    expect(resolveQuote(text, "go", 6)?.start).toBe(6);
    expect(resolveQuote(text, "go", 0)?.start).toBe(0);
  });

  it("invalidates a live finding whose anchored quote was edited away (self-fix)", () => {
    const findings: Finding[] = [
      { id: "v1", class: "voice", severity: "warning", title: "drift", why: "x", source: "live", span: { quote: "not in text", start: 5, end: 16 } },
    ];
    // The quote anchored once (it has a span) but no longer exists → the user
    // fixed it themselves; the suggestion must disappear, not linger as a card.
    expect(resolveFindings("a totally different draft", findings)).toHaveLength(0);
  });

  it("keeps a never-anchored live finding as a panel-only card", () => {
    const findings: Finding[] = [
      { id: "v1", class: "voice", severity: "warning", title: "drift", why: "x", source: "live" },
    ];
    const resolved = resolveFindings("any draft", findings);
    expect(resolved).toHaveLength(1);
    expect(resolved[0].span).toBeUndefined();
  });

  it("strips a de-anchored tier0 finding to a card (same-render safety net)", () => {
    const findings: Finding[] = [
      { id: "t1", class: "reach", severity: "warning", title: "bait", why: "x", source: "tier0", span: { quote: "gone now", start: 0, end: 8 } },
    ];
    const resolved = resolveFindings("something else entirely", findings);
    expect(resolved).toHaveLength(1);
    expect(resolved[0].span).toBeUndefined();
  });

  it("re-resolves a stale offset when the quote moved", () => {
    const findings: Finding[] = [
      { id: "v1", class: "voice", severity: "warning", title: "drift", why: "x", source: "live", span: { quote: "fox", start: 0, end: 3 } },
    ];
    // "fox" is actually at offset 16, not 0
    const resolved = resolveFindings("the quick brown fox", findings);
    expect(resolved[0].span).toEqual({ quote: "fox", start: 16, end: 19 });
  });
});

describe("spans — overlap resolution into render segments", () => {
  it("covers the whole string with contiguous segments", () => {
    const text = "the quick brown fox";
    const findings: Finding[] = [
      { id: "a", class: "clarity", severity: "suggestion", title: "", why: "", source: "tier0", span: { quote: "quick", start: 4, end: 9 } },
    ];
    const segs = buildSegments(text, findings);
    expect(segs.map((s) => s.text).join("")).toBe(text);
    expect(segs.find((s) => s.text === "quick")?.finding?.id).toBe("a");
  });

  it("higher-priority class wins a contested character (correctness > clarity)", () => {
    const text = "abcdef";
    const findings: Finding[] = [
      { id: "clar", class: "clarity", severity: "suggestion", title: "", why: "", source: "tier0", span: { quote: "bcd", start: 1, end: 4 } },
      { id: "corr", class: "correctness", severity: "problem", title: "", why: "", source: "live", span: { quote: "cde", start: 2, end: 5 } },
    ];
    const segs = buildSegments(text, findings);
    // char 'c','d' contested → correctness wins
    const owner = (i: number) => segs.find((s) => i >= s.start && i < s.end)?.finding?.id;
    expect(owner(2)).toBe("corr");
    expect(owner(3)).toBe("corr");
    expect(owner(1)).toBe("clar"); // 'b' only clarity
  });
});

describe("spans — guardedFix (LLM overcorrection guardrail)", () => {
  it("passes a genuine minimal edit", () => {
    expect(guardedFix("it's", "its", true, 100)).toBe("it's");
  });

  it("rejects a fix for an unanchored quote (would replace the whole draft)", () => {
    expect(guardedFix("a rewrite", "paraphrased quote", false, 100)).toBeUndefined();
  });

  it("rejects a no-op fix that restates the quote", () => {
    expect(guardedFix(" same text ", "same text", true, 100)).toBeUndefined();
  });

  it("rejects a fix that balloons far past the quote (not a minimal edit)", () => {
    const quote = "short phrase";
    const fix = "x".repeat(quote.length * 3 + 30);
    expect(guardedFix(fix, quote, true, 300)).toBeUndefined();
  });

  it("rejects a whole-post rewrite disguised as a span fix", () => {
    const draft = "this is basically the entire draft text right here";
    const quote = draft.slice(0, Math.ceil(draft.length * 0.9));
    expect(guardedFix("rewritten", quote, true, draft.length)).toBeUndefined();
  });

  it("drops empty/missing fixes", () => {
    expect(guardedFix(undefined, "q", true, 100)).toBeUndefined();
    expect(guardedFix("   ", "q", true, 100)).toBeUndefined();
  });
});

describe("spans — applyReplacement (Accept)", () => {
  it("replaces a span", () => {
    const f: Finding = { id: "x", class: "clarity", severity: "suggestion", title: "", why: "", source: "tier0", span: { quote: "really ", start: 5, end: 12 }, replacement: "" };
    expect(applyReplacement("this really matters", f).text).toBe("this matters");
  });

  it("replaces the whole text when there is no span (whole-post rewrite)", () => {
    const f: Finding = { id: "x", class: "voice", severity: "warning", title: "", why: "", source: "live", replacement: "a cleaner version" };
    expect(applyReplacement("the old draft", f).text).toBe("a cleaner version");
  });
});

describe("score composition", () => {
  it("uses reach alone (provisional) before a live read", () => {
    const s = composeScores({ reach: 80, voice: null, resemblance: null });
    expect(s.post).toBe(80);
    expect(s.postProvisional).toBe(true);
    expect(s.performance).toBeNull();
  });

  it("blends voice + algorithm + performance once live (voice and algorithm co-equal)", () => {
    const s = composeScores({ reach: 60, voice: 90, resemblance: 80 });
    // 0.40*90 + 0.40*60 + 0.20*80 = 36 + 24 + 16 = 76
    expect(s.post).toBe(76);
    expect(s.postProvisional).toBe(false);
    expect(s.performance).toBe("B");
  });

  it("weights the algorithm as heavily as voice", () => {
    // Same gap, mirrored between voice and reach → identical post score.
    const voiceStrong = composeScores({ reach: 50, voice: 90, resemblance: 70 });
    const algoStrong = composeScores({ reach: 90, voice: 50, resemblance: 70 });
    expect(voiceStrong.post).toBe(algoStrong.post);
  });

  it("maps resemblance to letter grades", () => {
    expect(resemblanceToGrade(90)).toBe("A");
    expect(resemblanceToGrade(72)).toBe("B");
    expect(resemblanceToGrade(58)).toBe("C");
    expect(resemblanceToGrade(20)).toBe("F");
  });
});

describe("mergeReport", () => {
  const base = () => runTier0({ text: "read https://example.com about just shipping" });

  it("returns deterministic-only with resolved spans when scores + findings are null", () => {
    const merged = mergeReport("read https://example.com about just shipping", base(), null, null);
    expect(merged.scores.voice).toBeNull();
    expect(merged.findings.every((f) => !f.span || f.span.end > f.span.start)).toBe(true);
  });

  it("takes the displayed scores from L2 and the findings/chips from L3", () => {
    const text = "read https://example.com about just shipping";
    const scores: AssistantScores = { voice_score: 88, resemblance_score: 76 };
    const findings: AssistantFindings = {
      voice_findings: [
        { id: "v1", class: "voice", severity: "warning", title: "Too formal", why: "you write punchier", source: "live", span: { quote: "shipping", start: text.indexOf("shipping"), end: text.indexOf("shipping") + 8 } },
      ],
      missing_pattern_chips: [
        { id: "p1", kind: "missing_pattern", label: "Open with a number", detail: "2.3×", multiplier: 2.3 },
      ],
      summary: "Solid, but lose the link.",
    };
    const merged = mergeReport(text, base(), scores, findings);
    // The open live voice finding holds its deduction out of the Voice sub-score.
    expect(merged.scores.voice).toBe(88 - FINDING_DEDUCTIONS.voiceLive);
    expect(merged.scores.performance).toBe("B");
    expect(merged.findings.find((f) => f.id === "v1")?.span).toBeTruthy();
    expect(merged.chips.find((c) => c.kind === "missing_pattern")).toBeTruthy();
  });

  it("shows L2 scores even when no L3 findings have run", () => {
    const text = "read https://example.com about just shipping";
    const merged = mergeReport(text, base(), { voice_score: 64, resemblance_score: 58 }, null);
    expect(merged.scores.voice).toBe(64);
    expect(merged.scores.performance).toBe("C");
    expect(merged.scores.postProvisional).toBe(false);
  });

  it("drops a live finding whose span overlaps a tier0 finding (deterministic wins)", () => {
    const text = "read https://example.com about just shipping";
    const url = "https://example.com";
    const findings: AssistantFindings = {
      voice_findings: [
        // Duplicates the tier0 external-link finding on the same characters.
        { id: "v-dup", class: "voice", severity: "warning", title: "link tone", why: "x", source: "live", span: { quote: url, start: text.indexOf(url), end: text.indexOf(url) + url.length } },
        // Non-overlapping live finding survives arbitration.
        { id: "v-ok", class: "voice", severity: "warning", title: "drift", why: "x", source: "live", span: { quote: "shipping", start: text.indexOf("shipping"), end: text.indexOf("shipping") + 8 } },
      ],
      missing_pattern_chips: [],
      summary: "",
    };
    const merged = mergeReport(text, base(), null, findings);
    expect(merged.findings.find((f) => f.id === "v-dup")).toBeUndefined();
    expect(merged.findings.find((f) => f.id === "v-ok")).toBeTruthy();
    // The tier0 link finding itself is still there.
    expect(merged.findings.find((f) => f.signal === "external_link")).toBeTruthy();
  });

  it("keeps a span-less live finding through arbitration (cards don't contest spans)", () => {
    const text = "read https://example.com about just shipping";
    const findings: AssistantFindings = {
      voice_findings: [
        { id: "v-card", class: "voice", severity: "warning", title: "overall tone", why: "x", source: "live" },
      ],
      missing_pattern_chips: [],
      summary: "",
    };
    const merged = mergeReport(text, base(), null, findings);
    expect(merged.findings.find((f) => f.id === "v-card")).toBeTruthy();
  });

  it("merges live reach (algorithm) findings and deducts them from the Algorithm sub-score", () => {
    const text = "Shipped a new feature today. It works pretty well I think.";
    const t0 = runTier0({ text });
    const findings: AssistantFindings = {
      voice_findings: [],
      reach_findings: [
        { id: "algo:0", class: "reach", severity: "warning", title: "Weak hook", why: "first line gives no reason to stop", source: "live", signal: "algorithm_fit", span: { quote: "Shipped a new feature today.", start: 0, end: 28 } },
      ],
      missing_pattern_chips: [],
      summary: "",
    };
    const withAlgo = mergeReport(text, t0, null, findings);
    const without = mergeReport(text, t0, null, null);
    expect(withAlgo.findings.find((f) => f.id === "algo:0")).toBeTruthy();
    expect(withAlgo.scores.reach).toBe(without.scores.reach - FINDING_DEDUCTIONS.reachLive);
  });
});

describe("findings-coupled scoring — the accept/dismiss invariant", () => {
  const l2: AssistantScores = { voice_score: 80, resemblance_score: 70 };

  /** Post score for `text` with the given live findings still open. */
  function postScore(text: string, live: AssistantFindings | null, hidden?: (f: Finding) => boolean): number {
    return mergeReport(text, runTier0({ text }), l2, live, hidden).scores.post;
  }

  it("accepting a tier0 reach fix (link removal) raises the post score", () => {
    const text = "read https://example.com now. what do you think?";
    const link = runTier0({ text }).findings.find((f) => f.signal === "external_link")!;
    const { text: fixed } = applyReplacement(text, link);
    expect(postScore(fixed, null)).toBeGreaterThan(postScore(text, null));
  });

  it("accepting a clarity (filler) fix raises the post score", () => {
    const text = "this really matters a lot to me, what do you think?";
    const filler = runTier0({ text }).findings.find((f) => f.signal === "filler")!;
    const { text: fixed } = applyReplacement(text, filler);
    expect(postScore(fixed, null)).toBeGreaterThan(postScore(text, null));
  });

  it("accepting a correctness (markdown) fix raises the post score", () => {
    const text = "here is **the big idea** for today, what do you think?";
    const md = runTier0({ text }).findings.find((f) => f.signal === "markdown")!;
    const { text: fixed } = applyReplacement(text, md);
    expect(postScore(fixed, null)).toBeGreaterThan(postScore(text, null));
  });

  it("accepting a live voice fix raises the post score (deduction released)", () => {
    const text = "We are pleased to announce our new offering today.";
    const drift: Finding = {
      id: "voice:0", class: "voice", severity: "warning", title: "Too corporate", why: "you never write like a press release", source: "live", signal: "voice_drift",
      span: { quote: "We are pleased to announce", start: 0, end: 26 }, replacement: "Just shipped",
    };
    const live: AssistantFindings = { voice_findings: [drift], missing_pattern_chips: [], summary: "" };
    const before = postScore(text, live);
    // Accept: apply the replacement and drop the finding (useAssistant's rebase).
    const { text: fixed } = applyReplacement(text, drift);
    const after = postScore(fixed, { ...live, voice_findings: [] });
    expect(after).toBeGreaterThan(before);
  });

  it("dismissing a finding also releases its deduction (isHidden)", () => {
    const text = "We are pleased to announce our new offering today.";
    const drift: Finding = {
      id: "voice:0", class: "voice", severity: "warning", title: "Too corporate", why: "x", source: "live", signal: "voice_drift",
      span: { quote: "We are pleased to announce", start: 0, end: 26 },
    };
    const live: AssistantFindings = { voice_findings: [drift], missing_pattern_chips: [], summary: "" };
    const open = postScore(text, live);
    const dismissed = postScore(text, live, (f) => f.id === "voice:0");
    expect(dismissed).toBeGreaterThan(open);
  });

  it("clarity deductions are capped so filler can never dominate the headline", () => {
    const clarity = Array.from({ length: 10 }, (_, i) => ({
      id: `filler:${i}`, class: "clarity" as const, severity: "suggestion" as const,
      title: "", why: "", source: "tier0" as const, signal: "filler",
    }));
    expect(scorePenalties(clarity).craft).toBe(FINDING_DEDUCTIONS.clarityCap);
  });

  it("deductions clamp at the floor — a pile of findings can't go below 0", () => {
    const s = composeScores({
      reach: 5, voice: 3, resemblance: 10,
      penalties: { voice: 50, algorithm: 50, craft: 50 },
    });
    expect(s.post).toBe(0);
    expect(s.voice).toBe(0);
    expect(s.reach).toBe(0);
  });
});

describe("runTier0 — wall of text (dwell formatting)", () => {
  it("cautions on a long unbroken block and prices it into the reach score", () => {
    const block = "word ".repeat(50).trim() + " what do you think?"; // >200 chars, no newline
    const broken = block.slice(0, 120) + "\n" + block.slice(120);
    const r1 = runTier0({ text: block });
    const r2 = runTier0({ text: broken });
    expect(r1.badges.find((b) => b.id === "wall-of-text")).toBeTruthy();
    expect(r1.chips.find((c) => c.id === "chip:line-breaks")).toBeTruthy();
    expect(r2.badges.find((b) => b.id === "wall-of-text")).toBeUndefined();
    expect(r2.scores.reach).toBeGreaterThan(r1.scores.reach);
  });

  it("does not flag threads (each tweet is short by design)", () => {
    const block = "word ".repeat(50).trim();
    expect(runTier0({ text: block, isThread: true }).badges.find((b) => b.id === "wall-of-text")).toBeUndefined();
  });
});
