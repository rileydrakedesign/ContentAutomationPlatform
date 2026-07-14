"use client";

import { useState } from "react";
import { targetUrl, type RadarTarget } from "./types";

/**
 * The handoff (C1, PRD_CORE §4.4): replies NEVER publish via the X API — the
 * composed reply is handed to X's own composer and the user posts it from
 * their own session (the human keeps the pen; publish-time 403s can't happen
 * because X's composer enforces its own rules). A handoff record is persisted
 * first — the attribution key for the Results pillar — and also powers
 * already-replied dedup, so a handed-off target stops resurfacing.
 *
 * Tiers: extension assist (prefills X's NATIVE reply composer, where the
 * assistant mounts reply-aware) → web intent (prefilled composer in a new
 * tab) → copy + open post (covers the mobile intent-prefill bug).
 */
export function useHandoff({ onHandedOff }: { onHandedOff: (target: RadarTarget) => void }) {
  const [posting, setPosting] = useState(false);
  const [handoffError, setHandoffError] = useState<string | null>(null);

  async function recordHandoff(t: RadarTarget, text: string) {
    // Best-effort: a failed record must not block the user's reply.
    try {
      await fetch("/api/reply/handoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_post_id: t.postId,
          composed_text: text,
          target_url: targetUrl(t),
          target_text: t.text,
        }),
      });
    } catch {
      // swallow — the handoff itself still proceeds
    }
  }

  // Best tier: extension assist. bridge.js (the extension's dashboard content
  // script) marks its presence on <html data-afx-extension> and relays the
  // handoff to the extension, which opens the post and prefills X's native
  // reply composer. Resolves false (→ intent fallback) if the extension isn't
  // there or doesn't ack in time.
  function handoffViaExtension(t: RadarTarget, text: string): Promise<boolean> {
    if (typeof document === "undefined" || !document.documentElement.dataset.afxExtension) {
      return Promise.resolve(false);
    }
    return new Promise((resolve) => {
      const done = (ok: boolean) => {
        window.removeEventListener("message", onMessage);
        clearTimeout(timer);
        resolve(ok);
      };
      const onMessage = (e: MessageEvent) => {
        if (e.source !== window || e.origin !== window.location.origin) return;
        const d = e.data as { type?: string; target_post_id?: string; ok?: boolean } | null;
        if (d?.type === "AFX_REPLY_HANDOFF_ACK" && d.target_post_id === t.postId) done(!!d.ok);
      };
      const timer = setTimeout(() => done(false), 1500);
      window.addEventListener("message", onMessage);
      window.postMessage(
        {
          type: "AFX_REPLY_HANDOFF",
          target_post_id: t.postId,
          target_url: targetUrl(t),
          text,
        },
        window.location.origin
      );
    });
  }

  /** Default tier: X Web Intent — opens X's composer on the post, prefilled. */
  async function replyOnX(t: RadarTarget, text: string) {
    if (!text.trim()) return;
    setPosting(true);
    setHandoffError(null);
    try {
      await recordHandoff(t, text);
      const viaExtension = await handoffViaExtension(t, text);
      if (!viaExtension) {
        const intentUrl = `https://x.com/intent/post?in_reply_to=${encodeURIComponent(
          t.postId
        )}&text=${encodeURIComponent(text)}`;
        window.open(intentUrl, "_blank", "noopener,noreferrer");
      }
      onHandedOff(t);
    } finally {
      setPosting(false);
    }
  }

  /** Fallback tier: copy the composed reply + open the post. */
  async function copyAndOpen(t: RadarTarget, text: string) {
    if (!text.trim()) return;
    setHandoffError(null);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      setHandoffError("Couldn't copy to clipboard — copy the text manually, then reply on X.");
      return;
    }
    await recordHandoff(t, text);
    window.open(targetUrl(t), "_blank", "noopener,noreferrer");
    onHandedOff(t);
  }

  return { posting, handoffError, setHandoffError, replyOnX, copyAndOpen };
}
