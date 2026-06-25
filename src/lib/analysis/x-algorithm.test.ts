import { describe, it, expect } from "vitest";
import {
  X_ALGORITHM_WEIGHTS,
  X_ALGORITHM_CAVEAT,
  buildAlgorithmNotes,
  REPLY_DRIVING,
  ENGAGEMENT_BAIT,
} from "./x-algorithm";
import { weightedEngagement } from "@/lib/utils/engagement";
import { runTier0 } from "@/lib/analysis/assistant/tier0";
import { computeAlgorithmFlags } from "@/lib/analysis/prepublish-read";

describe("x-algorithm constants", () => {
  it("orders the documented weights most-positive → most-negative", () => {
    const numeric = X_ALGORITHM_WEIGHTS.map((w) => w.weight).filter(
      (w): w is number => w !== null
    );
    const sorted = [...numeric].sort((a, b) => b - a);
    expect(numeric).toEqual(sorted);
  });

  it("keeps report the most punishing and the author-engaged reply the most rewarding", () => {
    const bySignal = Object.fromEntries(X_ALGORITHM_WEIGHTS.map((w) => [w.signal, w.weight]));
    expect(bySignal.report).toBeLessThan(bySignal.negative_feedback as number);
    expect(bySignal.reply_engaged_by_author).toBeGreaterThan(bySignal.reply as number);
    expect(bySignal.reply).toBeGreaterThan(bySignal.retweet as number);
    expect(bySignal.retweet).toBeGreaterThan(bySignal.like as number);
  });

  it("stays consistent with our engagement currency's ordering (reply > retweet > like)", () => {
    // The product's weightedEngagement is anchored to this same ordering.
    expect(weightedEngagement({ replies: 1 })).toBeGreaterThan(weightedEngagement({ retweets: 1 }));
    expect(weightedEngagement({ retweets: 1 })).toBeGreaterThan(weightedEngagement({ likes: 1 }));

    const bySignal = Object.fromEntries(X_ALGORITHM_WEIGHTS.map((w) => [w.signal, w.weight]));
    expect(bySignal.reply).toBeGreaterThan(bySignal.like as number);
  });

  it("buildAlgorithmNotes returns one note per weight, and a caveat exists", () => {
    expect(buildAlgorithmNotes()).toHaveLength(X_ALGORITHM_WEIGHTS.length);
    expect(X_ALGORITHM_CAVEAT).toMatch(/2023/);
  });
});

// #9: the bait / reply-hook lists were duplicated and had already drifted
// ("tag 3" vs "👇 follow"). They now live here and are imported by both the
// assistant's Tier-0 engine and the pre-publish read. Pin the two deterministic
// layers to the same behavior so they can never drift again.
describe("deterministic layer parity (tier0 ↔ prepublish-read)", () => {
  it("both flag every shared engagement-bait phrase", () => {
    for (const phrase of ENGAGEMENT_BAIT) {
      const text = `hey ${phrase} now`;
      const t0 = runTier0({ text }).findings.some((f) => f.signal === "negative_feedback");
      const pp = computeAlgorithmFlags(text).some((f) => f.signal === "negative_feedback");
      expect(t0, `tier0: ${phrase}`).toBe(true);
      expect(pp, `prepublish: ${phrase}`).toBe(true);
    }
  });

  it("both detect every shared reply-hook phrase", () => {
    for (const phrase of REPLY_DRIVING) {
      const text = `a thought ${phrase}`;
      const t0 = runTier0({ text }).badges.find((b) => b.id === "reply-hook")?.status === "good";
      const pp = computeAlgorithmFlags(text).some((f) => f.signal === "reply" && f.status === "good");
      expect(t0, `tier0: ${phrase}`).toBe(true);
      expect(pp, `prepublish: ${phrase}`).toBe(true);
    }
  });
});
