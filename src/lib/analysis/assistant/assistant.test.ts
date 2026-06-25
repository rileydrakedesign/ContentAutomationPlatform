import { describe, it, expect } from "vitest";
import { runTier0 } from "./tier0";
import { resolveQuote, resolveFindings, buildSegments, applyReplacement } from "./spans";
import { composeScores, resemblanceToGrade } from "./score";
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

  it("drops reach when a link is present and raises it with a reply hook", () => {
    const linkScore = runTier0({ text: "read https://example.com now" }).scores.reach;
    const hookScore = runTier0({ text: "what's your take on this?" }).scores.reach;
    expect(hookScore).toBeGreaterThan(linkScore);
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

  it("strips the span (keeps the card) when an LLM quote isn't found verbatim", () => {
    const findings: Finding[] = [
      { id: "v1", class: "voice", severity: "warning", title: "drift", why: "x", source: "live", span: { quote: "not in text", start: 5, end: 16 } },
    ];
    const resolved = resolveFindings("a totally different draft", findings);
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

  it("blends voice + performance + reach once live", () => {
    const s = composeScores({ reach: 60, voice: 90, resemblance: 80 });
    // 0.45*90 + 0.35*80 + 0.20*60 = 40.5 + 28 + 12 = 80.5 → 81 (rounding may yield 81)
    expect(s.post).toBeGreaterThanOrEqual(80);
    expect(s.postProvisional).toBe(false);
    expect(s.performance).toBe("B");
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
    expect(merged.scores.voice).toBe(88);
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
});
