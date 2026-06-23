import { describe, it, expect } from "vitest";
import { voiceConfidence } from "./voice-confidence";

describe("voiceConfidence — honest cold-start framing", () => {
  it("flags thin history below the signal floor", () => {
    expect(voiceConfidence(0).level).toBe("thin");
    expect(voiceConfidence(7).level).toBe("thin");
  });

  it("reports building confidence in the mid band", () => {
    expect(voiceConfidence(8).level).toBe("building");
    expect(voiceConfidence(24).level).toBe("building");
  });

  it("reports good confidence with enough of the user's own posts", () => {
    expect(voiceConfidence(25).level).toBe("good");
    expect(voiceConfidence(200).level).toBe("good");
    expect(voiceConfidence(40).blurb).toContain("40");
  });
});
