import { describe, it, expect } from "vitest";
import {
  X_ALGORITHM_WEIGHTS,
  X_ALGORITHM_CAVEAT,
  ALGORITHM_CLAIMS,
  buildAlgorithmNotes,
  claimNote,
  isClaimStale,
  REPLY_DRIVING,
  ENGAGEMENT_BAIT,
  type AlgorithmClaimId,
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
    // The caveat must cite the 2026 open-source release AND flag the numbers as 2023-published.
    expect(X_ALGORITHM_CAVEAT).toMatch(/2023/);
    expect(X_ALGORITHM_CAVEAT).toMatch(/2026/);
    expect(X_ALGORITHM_CAVEAT).toMatch(/xai-org\/x-algorithm/);
  });

  it("tags every published-number row as 2023 and every unnumbered row with its real basis", () => {
    for (const w of X_ALGORITHM_WEIGHTS) {
      if (w.weight !== null) expect(w.basis, w.signal).toBe("published_2023");
      else expect(["structural_2026", "measured"], w.signal).toContain(w.basis);
    }
  });
});

// Every user-facing "why" must trace to a provenance-tagged claim. This suite
// keeps the KB honest: no unsourced claims, no silently-expired ones.
describe("algorithm claims KB", () => {
  const ids = Object.keys(ALGORITHM_CLAIMS) as AlgorithmClaimId[];

  it("every claim carries provenance and consistent dates", () => {
    for (const id of ids) {
      const c = ALGORITHM_CLAIMS[id];
      expect(c.statement.length, id).toBeGreaterThan(20);
      expect(c.source.url, id).toMatch(/^https:\/\//);
      expect(["code", "measurement", "announcement"], id).toContain(c.source.kind);
      expect(new Date(c.review_by).getTime(), id).toBeGreaterThan(
        new Date(c.last_verified).getTime()
      );
    }
  });

  it("no active claim is Tier C (folklore never ships)", () => {
    for (const id of ids) {
      const c = ALGORITHM_CLAIMS[id];
      if (c.status === "active") expect(["A", "B"], id).toContain(c.tier);
    }
  });

  it("no shipped claim is past its review-by date (re-verify against the source, bump the dates)", () => {
    for (const id of ids) {
      expect(isClaimStale(id), `${id} is stale — re-verify it`).toBe(false);
    }
  });

  it("claimNote returns the statement (the copy the flags/badges ship)", () => {
    expect(claimNote("link_reach_gap")).toContain("measured");
    expect(claimNote("negative_feedback_costly")).toContain("mute");
    expect(claimNote("grok_quality_read")).toContain("slop");
  });

  it("never ships an unhedged current-weight claim (2026 coefficients are redacted)", () => {
    // Numeric multipliers may only appear alongside "last published" hedging.
    for (const id of ids) {
      const s = ALGORITHM_CLAIMS[id].statement;
      if (/\d+×/.test(s) || /~\d+ likes/.test(s)) {
        expect(s, id).toMatch(/last published/i);
      }
    }
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
