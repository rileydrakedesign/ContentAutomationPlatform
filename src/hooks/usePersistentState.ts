"use client";

import { useEffect, useRef, useState, useCallback } from "react";

/**
 * Pure read of a persisted value from sessionStorage (SSR-safe + corruption
 * tolerant). Returns `fallback` when storage is unavailable, the key is absent,
 * or the stored JSON is unparseable. Exposed for unit testing the storage
 * contract without rendering a React tree.
 */
export function readPersistedValue<T>(key: string, fallback: T): T {
  try {
    if (typeof sessionStorage === "undefined") return fallback;
    const raw = sessionStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Pure write; swallows quota/availability errors (state still works in-memory). */
export function writePersistedValue<T>(key: string, value: T): void {
  try {
    if (typeof sessionStorage === "undefined") return;
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // non-fatal
  }
}

/** Pure remove; no-op when storage is unavailable. */
export function removePersistedValue(key: string): void {
  try {
    if (typeof sessionStorage === "undefined") return;
    sessionStorage.removeItem(key);
  } catch {
    // non-fatal
  }
}

/**
 * useState that mirrors to sessionStorage so in-progress work survives
 * client-side navigation and tab reloads (and clears when the tab closes).
 *
 * Hydration-safe: the persisted value is read in an effect AFTER mount, never
 * during SSR render, so the server and first client render always agree on
 * `initial` (mirrors the FirstRunAnalysis "no setState-in-render" pattern).
 * On the first client commit we hydrate from storage if a value exists.
 *
 * Use for inputs and generated text you don't want to lose. Do NOT use it as
 * the source of truth for server-derived lists that can go stale (drafts,
 * search results) — persist the inputs, re-validate those on mount.
 */
export function usePersistentState<T>(
  key: string,
  initial: T
): [T, React.Dispatch<React.SetStateAction<T>>, { clear: () => void; hydrated: boolean }] {
  const [value, setValue] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);
  // Guard so we don't write `initial` back over a stored value before hydration.
  const didHydrate = useRef(false);

  useEffect(() => {
    setValue(readPersistedValue(key, initial));
    didHydrate.current = true;
    setHydrated(true);
    // Only on mount / key change; `initial` captured once by design.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (!didHydrate.current) return;
    writePersistedValue(key, value);
  }, [key, value]);

  const clear = useCallback(() => {
    try {
      sessionStorage.removeItem(key);
    } catch {
      // ignore
    }
    setValue(initial);
    // `initial` is intentionally captured once; callers pass a stable initial.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return [value, setValue, { clear, hydrated }];
}
