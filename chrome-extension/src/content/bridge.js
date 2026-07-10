/**
 * Dashboard bridge — runs on the app's origins (see manifest), NOT on x.com.
 *
 * Tier 2 of the reply handoff (PRD_CORE §4.4): when the extension is
 * installed, the dashboard hands the composed reply to the extension instead
 * of the bare web intent. The extension opens the post and prefills X's
 * NATIVE reply composer, where the writing assistant (assistant-ui.js) mounts
 * reply-aware for final tweaks. The web intent remains the dashboard's
 * fallback when no ack arrives.
 *
 * Page ⇄ extension protocol (window.postMessage, same-origin only):
 *   page → bridge:  { type: "AFX_REPLY_HANDOFF", target_post_id, target_url, text }
 *   bridge → page:  { type: "AFX_REPLY_HANDOFF_ACK", target_post_id, ok, error? }
 *
 * Presence marker: `document.documentElement.dataset.afxExtension = <version>`
 * (set at document_start, so the page can check it synchronously).
 */
(function () {
  "use strict";

  try {
    document.documentElement.dataset.afxExtension = chrome.runtime.getManifest().version;
  } catch (e) {
    return; // extension context gone — stay silent
  }

  window.addEventListener("message", (event) => {
    // Same window, same origin, our message type only.
    if (event.source !== window || event.origin !== window.location.origin) return;
    const data = event.data;
    if (!data || data.type !== "AFX_REPLY_HANDOFF") return;

    const targetPostId = String(data.target_post_id || "");
    const ack = (ok, error) => {
      window.postMessage(
        { type: "AFX_REPLY_HANDOFF_ACK", target_post_id: targetPostId, ok: !!ok, error: error || null },
        window.location.origin
      );
    };

    if (!/^\d+$/.test(targetPostId) || !String(data.text || "").trim()) {
      ack(false, "invalid handoff payload");
      return;
    }

    try {
      chrome.runtime.sendMessage(
        {
          type: "REPLY_HANDOFF",
          payload: {
            target_post_id: targetPostId,
            target_url: String(data.target_url || ""),
            text: String(data.text),
          },
        },
        (res) => {
          if (chrome.runtime.lastError || !res || !res.success) {
            ack(false, (res && res.error) || "extension unavailable");
          } else {
            ack(true);
          }
        }
      );
    } catch (e) {
      ack(false, "extension unavailable");
    }
  });
})();
