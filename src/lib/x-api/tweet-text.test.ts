import { describe, it, expect } from "vitest";
import {
  weightedTweetLength,
  tweetLengthInfo,
  firstUrl,
  findUrls,
  findLinks,
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

describe("findLinks — assistant external-link penalty (vs findUrls)", () => {
  it("does not flag an email address's domain as a link (#6)", () => {
    // findUrls (counter/billing) still sees the bare domain...
    expect(findUrls("ping me at me@google.com please").length).toBe(1);
    // ...but the penalty must not fire on an email host.
    expect(findLinks("ping me at me@google.com please")).toEqual([]);
  });

  it("still flags real links — scheme'd, www, and standalone bare domains", () => {
    expect(findLinks("read https://example.com now").length).toBe(1);
    expect(findLinks("see www.foo.io").length).toBe(1);
    expect(findLinks("I went to google.com today").length).toBe(1);
  });

  it("flags a real link even when an email is also present", () => {
    const links = findLinks("mail me@google.com or visit https://site.dev");
    expect(links.length).toBe(1);
    expect(links[0].raw).toBe("https://site.dev");
  });
});
