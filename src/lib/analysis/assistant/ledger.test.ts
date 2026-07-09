import { describe, it, expect } from "vitest";
import { anchorLedger, contradictsSettled, type AcceptedEdit } from "./ledger";
import type { Finding } from "./types";

// The user accepted a voice fix: "gonna crush it fam" → "planning to ship it".
const EDIT: AcceptedEdit = {
  before: "gonna crush it fam",
  after: "planning to ship it",
  class: "voice",
  signal: "voice_drift",
};
const TEXT = "Tomorrow I am planning to ship it. What would you build first?";

function liveFinding(overrides: Partial<Finding>): Finding {
  return {
    id: "voice:0",
    class: "voice",
    severity: "warning",
    title: "Drifts from your voice",
    why: "test",
    source: "live",
    ...overrides,
  };
}

function spanOf(text: string, quote: string) {
  const start = text.indexOf(quote);
  return { quote, start, end: start + quote.length };
}

describe("anchorLedger — settled decisions bind while their text survives", () => {
  it("anchors an entry whose replacement is still in the draft", () => {
    const anchored = anchorLedger(TEXT, [EDIT]);
    expect(anchored).toHaveLength(1);
    expect(TEXT.slice(anchored[0].start, anchored[0].end)).toBe(EDIT.after);
  });

  it("expires an entry once the user rewrites that section (post evolved)", () => {
    const rewritten = "Tomorrow I will launch the beta. What would you build first?";
    expect(anchorLedger(rewritten, [EDIT])).toHaveLength(0);
  });

  it("never anchors a deletion (empty after)", () => {
    expect(anchorLedger(TEXT, [{ ...EDIT, after: "" }])).toHaveLength(0);
  });
});

describe("contradictsSettled — the anti-churn filter", () => {
  const settled = anchorLedger(TEXT, [EDIT]);

  it("hides a same-class live finding that re-flags the accepted span", () => {
    const f = liveFinding({ span: spanOf(TEXT, "planning to ship it") });
    expect(contradictsSettled(f, settled)).toBe(true);
  });

  it("hides a same-class finding that partially overlaps the accepted span", () => {
    const f = liveFinding({ span: spanOf(TEXT, "ship it. What") });
    expect(contradictsSettled(f, settled)).toBe(true);
  });

  it("allows a different-class finding on the same span (a fact is a fact)", () => {
    const f = liveFinding({
      id: "correctness:0",
      class: "correctness",
      severity: "problem",
      span: spanOf(TEXT, "planning to ship it"),
    });
    expect(contradictsSettled(f, settled)).toBe(false);
  });

  it("never filters Tier-0 findings (deterministic facts recompute themselves)", () => {
    const f = liveFinding({ source: "tier0", span: spanOf(TEXT, "planning to ship it") });
    expect(contradictsSettled(f, settled)).toBe(false);
  });

  it("hides a fix that reverts the accepted edit, wherever it claims to apply", () => {
    const f = liveFinding({
      class: "reach",
      span: spanOf(TEXT, "Tomorrow"),
      replacement: "Gonna  crush it FAM",
    });
    expect(contradictsSettled(f, settled)).toBe(true);
  });

  it("hides a fix that substantially contains the pre-accept text", () => {
    const f = liveFinding({
      class: "reach",
      span: spanOf(TEXT, "Tomorrow"),
      replacement: "honestly gonna crush it fam, trust me",
    });
    expect(contradictsSettled(f, settled)).toBe(true);
  });

  it("allows an unrelated live finding elsewhere in the draft", () => {
    const f = liveFinding({ span: spanOf(TEXT, "What would you build first?") });
    expect(contradictsSettled(f, settled)).toBe(false);
  });

  it("does not treat short incidental containment as a revert", () => {
    const short = anchorLedger("I will do it now", [
      { before: "just", after: "now", class: "clarity" },
    ]);
    const f = liveFinding({
      class: "voice",
      span: spanOf("I will do it now", "I will"),
      replacement: "It's just that I will",
    });
    expect(contradictsSettled(f, short)).toBe(false);
  });
});
