import { describe, it, expect } from "vitest";
import { parseDraftPoll, pollForPublish } from "./poll";

describe("parseDraftPoll", () => {
  it("returns null for non-poll input", () => {
    expect(parseDraftPoll(null)).toBeNull();
    expect(parseDraftPoll(undefined)).toBeNull();
    expect(parseDraftPoll({})).toBeNull();
    expect(parseDraftPoll({ options: "nope" })).toBeNull();
  });

  it("preserves partial (still-editing) options and defaults the duration", () => {
    const p = parseDraftPoll({ options: ["a", ""] });
    expect(p).toEqual({ options: ["a", ""], durationMinutes: 1440 });
  });

  it("accepts snake_case duration_minutes (from the wire)", () => {
    const p = parseDraftPoll({ options: ["a", "b"], duration_minutes: 60 });
    expect(p?.durationMinutes).toBe(60);
  });

  it("caps options at 4", () => {
    const p = parseDraftPoll({ options: ["a", "b", "c", "d", "e"] });
    expect(p?.options).toHaveLength(4);
  });
});

describe("pollForPublish", () => {
  it("returns null until there are 2 non-empty options", () => {
    expect(pollForPublish({ options: ["only", ""] })).toBeNull();
    expect(pollForPublish({ options: ["", ""] })).toBeNull();
  });

  it("normalizes to X's wire shape, trimming and dropping blanks", () => {
    expect(
      pollForPublish({ options: [" yes ", "no", ""], durationMinutes: 60 })
    ).toEqual({ options: ["yes", "no"], duration_minutes: 60 });
  });

  it("clamps the duration into X's accepted range", () => {
    expect(pollForPublish({ options: ["a", "b"], durationMinutes: 1 })?.duration_minutes).toBe(5);
    expect(
      pollForPublish({ options: ["a", "b"], durationMinutes: 99999 })?.duration_minutes
    ).toBe(10080);
  });

  it("throws when an option exceeds the 25-char cap", () => {
    expect(() =>
      pollForPublish({ options: ["a".repeat(26), "b"], durationMinutes: 60 })
    ).toThrow(/25 characters/);
  });
});
