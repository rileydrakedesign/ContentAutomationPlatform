import { describe, it, expect } from "vitest";
import { containsUrl, publishCreditCost, CREDIT_COSTS } from "./credits";

describe("containsUrl", () => {
  it("matches explicit http/https URLs", () => {
    expect(containsUrl("check this https://example.com/post")).toBe(true);
    expect(containsUrl("http://foo.io")).toBe(true);
    expect(containsUrl("HTTPS://FOO.COM")).toBe(true);
  });

  it("matches bare domains with linked TLDs", () => {
    expect(containsUrl("go to example.com now")).toBe(true);
    expect(containsUrl("our site is agentsforx.ai")).toBe(true);
    expect(containsUrl("foo.io/path?q=1")).toBe(true);
    expect(containsUrl("x.com")).toBe(true);
    expect(containsUrl("sub.domain.co")).toBe(true);
  });

  it("matches domains wrapped in punctuation", () => {
    expect(containsUrl("(see example.com)")).toBe(true);
    expect(containsUrl("read it: example.com.")).toBe(true);
    expect(containsUrl('"example.com,"')).toBe(true);
  });

  it("does not match mentions, emails, or cashtags", () => {
    expect(containsUrl("@user.name said hi")).toBe(false);
    expect(containsUrl("email me at foo@bar.com")).toBe(false);
    expect(containsUrl("$TSLA is up")).toBe(false);
    expect(containsUrl("$3.50 well spent")).toBe(false);
  });

  it("does not match decimals, abbreviations, or file-ish tokens", () => {
    expect(containsUrl("version 3.5 shipped")).toBe(false);
    expect(containsUrl("e.g. this one")).toBe(false);
    expect(containsUrl("i.e. that one")).toBe(false);
    expect(containsUrl("node.js and next.js are great")).toBe(false);
    expect(containsUrl("app.tsx needs a fix")).toBe(false);
  });

  it("does not match plain text", () => {
    expect(containsUrl("just a normal tweet about things")).toBe(false);
    expect(containsUrl("")).toBe(false);
    expect(containsUrl("Sentence. Another sentence.")).toBe(false);
  });
});

describe("publishCreditCost", () => {
  it("prices a plain tweet at the base rate", () => {
    expect(publishCreditCost(["hello world"])).toBe(CREDIT_COSTS["publish.tweet"]);
  });

  it("prices a URL tweet at the surcharge rate", () => {
    expect(publishCreditCost(["see https://example.com"])).toBe(
      CREDIT_COSTS["publish.tweet_with_url"]
    );
  });

  it("sums per tweet across a thread, mixed rates", () => {
    const cost = publishCreditCost([
      "plain one",
      "with example.com link",
      "plain two",
    ]);
    expect(cost).toBe(
      2 * CREDIT_COSTS["publish.tweet"] + CREDIT_COSTS["publish.tweet_with_url"]
    );
  });

  it("is zero for an empty list", () => {
    expect(publishCreditCost([])).toBe(0);
  });
});
