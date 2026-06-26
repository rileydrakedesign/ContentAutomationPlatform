/**
 * Writing-assistant feature flag. ON by default — the real-time writing
 * assistant is now the product's primary mode. Disable hatches remain for QA:
 *   - `localStorage.assistant = "0"` disables it locally,
 *   - `NEXT_PUBLIC_WRITING_ASSISTANT = "0"` force-disables it for a deploy.
 * (`= "1"` on either still explicitly enables, so old overrides keep working.)
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
  if (process.env.NEXT_PUBLIC_WRITING_ASSISTANT === "0") return false;
  return true;
}
