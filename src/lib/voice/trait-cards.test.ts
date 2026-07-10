import { describe, it, expect } from "vitest";
import { deriveTraitCards, MIN_TRAIT_EXAMPLES } from "./trait-cards";
import { DEFAULT_VOICE_SETTINGS, type UserVoiceSettings } from "@/types/voice";

function settings(overrides: Partial<UserVoiceSettings> = {}): UserVoiceSettings {
  return {
    ...DEFAULT_VOICE_SETTINGS,
    id: "s1",
    user_id: "u1",
    created_at: "2026-07-01T00:00:00Z",
    updated_at: "2026-07-01T00:00:00Z",
    ...overrides,
  } as UserVoiceSettings;
}

const SHORT_PUNCHY = [
  "shipped it. no excuses!",
  "most founders don't need a landing page yet",
  "stop doing cold DMs. honestly it's the worst channel",
  "you're overthinking the stack. ship!",
  "i think pricing pages are underrated",
];

const LONG_FORMAL = [
  "After reviewing the quarterly metrics, we determined that the campaign performance exceeded expectations across every cohort that we measured during the period. The results were consistent. #growth",
  "One observation regarding developer tools adoption: enterprises evaluate procurement processes through committees, which extends the timeline considerably beyond initial projections for most vendors involved. #devtools",
  "It is worth considering that distribution advantages compound over time, whereas product advantages tend to erode as competitors replicate features within a market segment. What do you think about that dynamic?",
  "The documentation quality of an API often predicts the long-term maintenance burden that integration partners will carry. Would you agree with this assessment based on your experience?",
];

describe("deriveTraitCards — the voice is derived, not configured", () => {
  it("returns nothing on a corpus too thin to be honest", () => {
    expect(deriveTraitCards(settings(), SHORT_PUNCHY.slice(0, MIN_TRAIT_EXAMPLES - 1))).toEqual([]);
  });

  it("derives short/casual/opinionated/no-hashtag traits from a punchy corpus", () => {
    const cards = deriveTraitCards(settings(), SHORT_PUNCHY);
    const ids = cards.map((c) => c.id);
    expect(ids).toContain("length-short");
    expect(ids).toContain("emoji-off");
    expect(ids).toContain("casual");
    expect(ids).toContain("takes-sides");
    expect(ids).toContain("no-hashtags");
  });

  it("derives roomy/polished/question traits from a formal corpus", () => {
    const cards = deriveTraitCards(settings(), LONG_FORMAL);
    const ids = cards.map((c) => c.id);
    expect(ids).toContain("length-room");
    expect(ids).toContain("polished");
    expect(ids).toContain("questions");
    expect(ids).not.toContain("no-hashtags"); // corpus uses hashtags
  });

  it("every card carries measurable evidence and both patches", () => {
    for (const card of deriveTraitCards(settings(), SHORT_PUNCHY)) {
      expect(card.evidence.summary.length).toBeGreaterThan(0);
      expect(Object.keys(card.keepPatch).length).toBeGreaterThan(0);
      expect(Object.keys(card.notMePatch).length).toBeGreaterThan(0);
    }
  });

  it("marks a card kept when settings already express the trait (modes and dials with tolerance)", () => {
    const cards = deriveTraitCards(
      settings({ length_mode: "short", tone_formal_casual: 80 }),
      SHORT_PUNCHY
    );
    expect(cards.find((c) => c.id === "length-short")?.kept).toBe(true);
    expect(cards.find((c) => c.id === "casual")?.kept).toBe(true); // 80 within ±15 of 75
    expect(cards.find((c) => c.id === "no-hashtags")?.kept).toBe(false); // no rule yet
  });

  it("keep/not-me patches map onto existing UserVoiceSettings fields only", () => {
    const settingsKeys = new Set(Object.keys(settings()));
    for (const card of deriveTraitCards(settings(), [...SHORT_PUNCHY, ...LONG_FORMAL])) {
      for (const key of [...Object.keys(card.keepPatch), ...Object.keys(card.notMePatch)]) {
        expect(settingsKeys.has(key), `unknown settings key: ${key}`).toBe(true);
      }
    }
  });

  it("hashtag keep-patch appends the custom rule without clobbering existing rules", () => {
    const s = settings({
      guardrails: { avoid_words: [], avoid_topics: [], custom_rules: ["No politics"] },
    });
    const card = deriveTraitCards(s, SHORT_PUNCHY).find((c) => c.id === "no-hashtags")!;
    expect(card.keepPatch.guardrails?.custom_rules).toEqual(["No politics", "Never use hashtags"]);
    expect(card.notMePatch.guardrails?.custom_rules).toEqual(["No politics"]);
  });

  it("caps at 8 cards", () => {
    expect(deriveTraitCards(settings(), SHORT_PUNCHY).length).toBeLessThanOrEqual(8);
  });
});
