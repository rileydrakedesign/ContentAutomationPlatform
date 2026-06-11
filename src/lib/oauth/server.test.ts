import { describe, it, expect } from "vitest";
import crypto from "crypto";
import { verifyPkce, resolveScopes } from "./server";
import { ALLOWED_SCOPES } from "@/lib/api/scopes";

function makePkcePair() {
  const verifier = crypto.randomBytes(48).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

describe("verifyPkce (RFC 7636 S256)", () => {
  it("accepts a matching verifier/challenge pair", () => {
    const { verifier, challenge } = makePkcePair();
    expect(verifyPkce(verifier, challenge)).toBe(true);
  });

  it("rejects a wrong verifier", () => {
    const { challenge } = makePkcePair();
    const { verifier: otherVerifier } = makePkcePair();
    expect(verifyPkce(otherVerifier, challenge)).toBe(false);
  });

  it("rejects verifiers outside the RFC length bounds", () => {
    const short = "abc";
    const challenge = crypto.createHash("sha256").update(short).digest("base64url");
    expect(verifyPkce(short, challenge)).toBe(false);

    const long = "a".repeat(129);
    const longChallenge = crypto.createHash("sha256").update(long).digest("base64url");
    expect(verifyPkce(long, longChallenge)).toBe(false);
  });

  it("rejects the plain (non-S256) pattern — verifier == challenge", () => {
    const verifier = crypto.randomBytes(48).toString("base64url");
    expect(verifyPkce(verifier, verifier)).toBe(false);
  });
});

describe("resolveScopes", () => {
  it("keeps valid requested scopes", () => {
    expect(resolveScopes("drafts:read publish:write")).toEqual([
      "drafts:read",
      "publish:write",
    ]);
  });

  it("drops unknown scopes", () => {
    expect(resolveScopes("drafts:read admin:everything")).toEqual(["drafts:read"]);
  });

  it("defaults to the full scope set when nothing valid is requested", () => {
    expect(resolveScopes(undefined)).toEqual([...ALLOWED_SCOPES]);
    expect(resolveScopes("")).toEqual([...ALLOWED_SCOPES]);
    expect(resolveScopes("bogus:scope")).toEqual([...ALLOWED_SCOPES]);
  });

  it("handles + separated scope strings (form encoding)", () => {
    expect(resolveScopes("drafts:read+drafts:write")).toEqual([
      "drafts:read",
      "drafts:write",
    ]);
  });
});
