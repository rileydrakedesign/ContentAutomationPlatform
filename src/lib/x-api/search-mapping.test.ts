import { describe, it, expect } from "vitest";
import { isReplyForbiddenError } from "./search-mapping";

describe("isReplyForbiddenError — recognize X's 'can't reply here' rejection", () => {
  it("matches the real X 403 reply-restriction body", () => {
    const msg =
      'Failed to post tweet (403): {"detail":"Reply to this conversation is not allowed because you have not been mentioned or otherwise engaged by the author of the post you are replying to.","type":"about:blank","title":"Forbidden","status":403}';
    expect(isReplyForbiddenError(msg)).toBe(true);
  });

  it("matches our own clean 403 message", () => {
    expect(
      isReplyForbiddenError(
        "Failed to post tweet (403): the author limited who can reply to this post"
      )
    ).toBe(true);
  });

  it("does not match unrelated errors", () => {
    expect(isReplyForbiddenError("Failed to post tweet (403): duplicate content")).toBe(false);
    expect(isReplyForbiddenError("Failed to post tweet (401): unauthorized")).toBe(false);
    expect(isReplyForbiddenError("network timeout")).toBe(false);
  });
});
