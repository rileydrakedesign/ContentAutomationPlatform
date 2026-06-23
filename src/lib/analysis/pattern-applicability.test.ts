import { describe, it, expect } from "vitest";
import {
  isGenerationApplicablePattern,
  filterGenerationApplicable,
} from "./pattern-applicability";

describe("isGenerationApplicablePattern — only content-shaping patterns reach generation", () => {
  it("excludes timing patterns always", () => {
    expect(
      isGenerationApplicablePattern({
        pattern_type: "timing",
        pattern_name: "Evening Posts",
        pattern_value: "Posts after 6pm perform best",
      })
    ).toBe(false);
  });

  it("excludes post-type format patterns (single post / thread)", () => {
    expect(
      isGenerationApplicablePattern({
        pattern_type: "format",
        pattern_name: "Single Post",
        pattern_value: "Standalone posts outperform threads",
      })
    ).toBe(false);
    expect(
      isGenerationApplicablePattern({
        pattern_type: "format",
        pattern_name: "Thread Format",
        pattern_value: "Threads of 3 posts long do well",
      })
    ).toBe(false);
  });

  it("excludes visual/media patterns", () => {
    for (const name of ["Add an Image", "Video Clips", "Screenshot Proof", "Use a GIF"]) {
      expect(
        isGenerationApplicablePattern({
          pattern_type: "format",
          pattern_name: name,
          pattern_value: "media boosts reach",
        })
      ).toBe(false);
    }
  });

  it("keeps structural format patterns", () => {
    expect(
      isGenerationApplicablePattern({
        pattern_type: "format",
        pattern_name: "Numbered Lists",
        pattern_value: "Break ideas into numbered points",
      })
    ).toBe(true);
    expect(
      isGenerationApplicablePattern({
        pattern_type: "format",
        pattern_name: "Short Paragraphs",
        pattern_value: "Keep paragraphs to one or two lines",
      })
    ).toBe(true);
  });

  it("keeps hook_style, engagement_trigger, and topic patterns", () => {
    expect(
      isGenerationApplicablePattern({ pattern_type: "hook_style", pattern_name: "Question Hook", pattern_value: "Open with a question" })
    ).toBe(true);
    expect(
      isGenerationApplicablePattern({ pattern_type: "engagement_trigger", pattern_name: "Hot Takes", pattern_value: "Take a contrarian stance" })
    ).toBe(true);
    expect(
      isGenerationApplicablePattern({ pattern_type: "topic", pattern_name: "Build in Public", pattern_value: "Share progress updates" })
    ).toBe(true);
  });

  it("honors the persisted applies_to_generation decision over the heuristic", () => {
    // Heuristic would keep it, but persisted false wins.
    expect(
      isGenerationApplicablePattern({
        pattern_type: "hook_style",
        pattern_name: "Question Hook",
        pattern_value: "Open with a question",
        applies_to_generation: false,
      })
    ).toBe(false);
    // Heuristic would drop it (timing), but persisted true wins.
    expect(
      isGenerationApplicablePattern({
        pattern_type: "timing",
        pattern_name: "Evening Posts",
        pattern_value: "after 6pm",
        applies_to_generation: true,
      })
    ).toBe(true);
  });

  it("filterGenerationApplicable drops the non-applicable ones", () => {
    const patterns = [
      { pattern_type: "hook_style", pattern_name: "Question Hook", pattern_value: "ask" },
      { pattern_type: "timing", pattern_name: "Evening Posts", pattern_value: "6pm" },
      { pattern_type: "format", pattern_name: "Single Post", pattern_value: "standalone" },
      { pattern_type: "format", pattern_name: "Numbered Lists", pattern_value: "lists" },
    ];
    const kept = filterGenerationApplicable(patterns);
    expect(kept.map((p) => p.pattern_name)).toEqual(["Question Hook", "Numbered Lists"]);
  });
});
