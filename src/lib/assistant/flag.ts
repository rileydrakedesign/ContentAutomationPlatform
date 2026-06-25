/**
 * Writing-assistant feature flag. Off by default; opt in via the env flag for a
 * deploy, or `localStorage.assistant = "1"` for local testing (Phase 0 spike).
 */
export function isAssistantEnabled(): boolean {
  if (typeof window !== "undefined") {
    try {
      const ls = window.localStorage.getItem("assistant");
      if (ls === "1") return true;
      if (ls === "0") return false;
    } catch {
      // localStorage may be unavailable (SSR/private mode) — fall through.
    }
  }
  return process.env.NEXT_PUBLIC_WRITING_ASSISTANT === "1";
}
