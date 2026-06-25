import { describe, it, expect } from "vitest";
import { computeAlgorithmFlags } from "./prepublish-read";

describe("computeAlgorithmFlags", () => {
  const statusFor = (flags: ReturnType<typeof computeAlgorithmFlags>, signal: string) =>
    flags.find((f) => f.signal === signal)?.status;

  it("flags a question as reply-driving (good)", () => {
    const flags = computeAlgorithmFlags("What's the hardest part of shipping solo?");
    expect(statusFor(flags, "reply")).toBe("good");
  });

  it("cautions when there is no reply hook", () => {
    const flags = computeAlgorithmFlags("Shipped a new feature today.");
    expect(statusFor(flags, "reply")).toBe("caution");
  });

  it("penalizes an external link in the post", () => {
    const flags = computeAlgorithmFlags("Read my new post at example.com");
    expect(statusFor(flags, "external_link")).toBe("penalty");
  });

  it("does not add a link penalty when there is no URL", () => {
    const flags = computeAlgorithmFlags("Just thinking out loud about node.js performance");
    expect(flags.find((f) => f.signal === "external_link")).toBeUndefined();
  });

  it("cautions on engagement-bait phrasing", () => {
    const flags = computeAlgorithmFlags("RT if you agree. Follow for more tips.");
    expect(statusFor(flags, "negative_feedback")).toBe("caution");
  });

  it("rewards native media and dwell-worthy threads", () => {
    const withMedia = computeAlgorithmFlags("A short note", { hasMedia: true });
    expect(withMedia.some((f) => f.signal === "video_dwell" && f.status === "good")).toBe(true);

    const thread = computeAlgorithmFlags("A short note", { isThread: true });
    expect(thread.some((f) => f.signal === "video_dwell" && f.status === "good")).toBe(true);
  });
});
