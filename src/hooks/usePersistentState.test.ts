import { describe, it, expect, beforeEach, vi } from "vitest";
import { readPersistedValue, writePersistedValue } from "./usePersistentState";

describe("usePersistentState storage helpers", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
    });
  });

  it("returns the fallback when nothing is stored", () => {
    expect(readPersistedValue("missing", "fallback")).toBe("fallback");
    expect(readPersistedValue("missing2", { a: 1 })).toEqual({ a: 1 });
  });

  it("round-trips a written value", () => {
    writePersistedValue("k", { topic: "build in public", count: 2 });
    expect(readPersistedValue("k", null)).toEqual({ topic: "build in public", count: 2 });
  });

  it("falls back to initial on corrupt JSON", () => {
    sessionStorage.setItem("bad", "{not json");
    expect(readPersistedValue("bad", "safe")).toBe("safe");
  });

  it("is SSR-safe when sessionStorage is undefined", () => {
    vi.stubGlobal("sessionStorage", undefined);
    expect(readPersistedValue("x", "init")).toBe("init");
    // write must not throw
    expect(() => writePersistedValue("x", "v")).not.toThrow();
  });
});
