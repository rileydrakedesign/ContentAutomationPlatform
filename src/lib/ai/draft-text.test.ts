import { describe, it, expect } from "vitest";
import { cleanDraft, splitThread } from "./draft-text";

describe("cleanDraft", () => {
  it("strips code fences", () => {
    expect(cleanDraft("```\nhello\n```")).toBe("hello");
    expect(cleanDraft("```markdown\nhello\n```")).toBe("hello");
  });

  it("strips wrapping quotes", () => {
    expect(cleanDraft('"hello"')).toBe("hello");
    expect(cleanDraft("'hello'")).toBe("hello");
  });

  it("leaves unwrapped text alone, including internal quotes", () => {
    expect(cleanDraft('he said "hi" to me')).toBe('he said "hi" to me');
  });

  it("does not eat a lone quote character", () => {
    expect(cleanDraft('"')).toBe('"');
  });
});

describe("splitThread", () => {
  it("splits on the --- delimiter", () => {
    expect(splitThread("one\n---\ntwo\n---\nthree")).toEqual(["one", "two", "three"]);
  });

  it("falls back to blank lines when there is no delimiter", () => {
    expect(splitThread("one\n\ntwo")).toEqual(["one", "two"]);
  });

  it("returns a single tweet unchanged", () => {
    expect(splitThread("just one tweet")).toEqual(["just one tweet"]);
  });

  it("prefers the delimiter over blank lines", () => {
    expect(splitThread("a\n\nb\n---\nc")).toEqual(["a\n\nb", "c"]);
  });
});
