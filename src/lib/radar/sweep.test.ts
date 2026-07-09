import { describe, it, expect } from "vitest";
import { maxTweetId } from "./sweep";

// The since_id cursor is the economic core of sweeping: a wrong cursor either
// re-buys posts (cost) or skips new ones (silent product failure). Tweet IDs
// are numeric strings too large for Number — compare by length then lex.
describe("maxTweetId — sweep cursor advance", () => {
  it("first sweep adopts the first id", () => {
    expect(maxTweetId(null, "123")).toBe("123");
  });

  it("longer numeric string wins (magnitude)", () => {
    expect(maxTweetId("999999999", "1000000000")).toBe("1000000000");
  });

  it("same-length ids compare lexicographically", () => {
    expect(maxTweetId("1875000000000000002", "1875000000000000010")).toBe(
      "1875000000000000010"
    );
  });

  it("never regresses the cursor", () => {
    expect(maxTweetId("1875000000000000010", "1875000000000000002")).toBe(
      "1875000000000000010"
    );
  });

  it("handles ids beyond Number.MAX_SAFE_INTEGER precision", () => {
    // These two differ only in the last digit — Number() would round both to
    // the same float; string compare must still order them.
    const a = "9007199254740993";
    const b = "9007199254740992";
    expect(maxTweetId(b, a)).toBe(a);
  });
});
