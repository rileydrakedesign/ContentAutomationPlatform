import { describe, it, expect } from "vitest";
import { isVoiceCheckSurfaced } from "./publish-gate";

describe("isVoiceCheckSurfaced — the ambient-tuner publish gate", () => {
  const TEXT = "shipping in public is the cheat code";

  it("blocks publish before any voice-check has run", () => {
    expect(
      isVoiceCheckSurfaced({ hasResult: false, checkedText: null, currentText: TEXT })
    ).toBe(false);
  });

  it("allows publish once the score was surfaced for this exact text", () => {
    expect(
      isVoiceCheckSurfaced({ hasResult: true, checkedText: TEXT, currentText: TEXT })
    ).toBe(true);
  });

  it("re-blocks publish after the draft is edited past the checked text", () => {
    expect(
      isVoiceCheckSurfaced({
        hasResult: true,
        checkedText: TEXT,
        currentText: TEXT + " — repeat",
      })
    ).toBe(false);
  });

  it("blocks publish on empty/whitespace text even with a stale result", () => {
    expect(
      isVoiceCheckSurfaced({ hasResult: true, checkedText: "", currentText: "   " })
    ).toBe(false);
  });
});
