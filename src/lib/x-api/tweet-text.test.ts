import { describe, it, expect } from "vitest";
import {
  weightedTweetLength,
  tweetLengthInfo,
  firstUrl,
  URL_WEIGHTED_LENGTH,
} from "./tweet-text";

describe("weightedTweetLength — X-accurate counting", () => {
  it("counts plain ASCII as 1 each", () => {
    expect(weightedTweetLength("hello")).toBe(5);
    expect(weightedTweetLength("")).toBe(0);
  });

  it("counts any URL as 23 regardless of real length", () => {
    const shortUrl = "go to https://x.co";
    const longUrl =
      "go to https://example.com/a/very/long/path?with=query&and=more#hash";
    // "go to " is 6 chars; URL adds 23 → 29 both ways.
    expect(weightedTweetLength(shortUrl)).toBe(6 + URL_WEIGHTED_LENGTH);
    expect(weightedTweetLength(longUrl)).toBe(6 + URL_WEIGHTED_LENGTH);
  });

  it("counts CJK characters as weight 2", () => {
    expect(weightedTweetLength("日本語")).toBe(6); // 3 CJK × 2
    expect(weightedTweetLength("a日")).toBe(3); // 1 + 2
  });

  it("flags over-limit correctly", () => {
    const longText = "a".repeat(281);
    const info = tweetLengthInfo(longText);
    expect(info.weighted).toBe(281);
    expect(info.isOverLimit).toBe(true);
    expect(info.remaining).toBe(-1);

    const ok = tweetLengthInfo("a".repeat(280));
    expect(ok.isOverLimit).toBe(false);
    expect(ok.remaining).toBe(0);
  });

  it("reports URL count and respects a custom (premium) limit", () => {
    const info = tweetLengthInfo("see https://a.com and https://b.com", 25000);
    expect(info.urlCount).toBe(2);
    expect(info.isOverLimit).toBe(false);
  });
});

describe("firstUrl", () => {
  it("returns the first URL, normalizing bare/www forms to https", () => {
    expect(firstUrl("check example.com/post now")).toBe("https://example.com/post");
    expect(firstUrl("at www.foo.io")).toBe("https://www.foo.io");
    expect(firstUrl("already https://bar.dev/x")).toBe("https://bar.dev/x");
    expect(firstUrl("no links here")).toBe(null);
  });
});
