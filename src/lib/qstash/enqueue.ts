import * as Sentry from "@sentry/nextjs";
import { qstash } from "./client";

/**
 * Enqueue a scheduled post for delivery via QStash.
 *
 * QSTASH_PUBLISH_URL is the public base origin of the app (e.g.
 * https://app.agentsforx.com); the publish/failure paths are appended here.
 *
 * Reliability layers, outermost first:
 *  1. inline retry (this fn) — survives a transient blip when WE call QStash.
 *  2. QStash retries (retries: 3) — survives our endpoint being briefly down.
 *  3. failureCallback — fires when QStash exhausts retries, so a dead-lettered
 *     message marks the post `failed` instead of silently vanishing.
 *  4. the publish-scheduled sweep — catches anything still `scheduled` past its
 *     due time (e.g. this fn returned null because QStash was unreachable).
 *
 * Returns the QStash messageId, or null if enqueue failed after the inline
 * retries. A null result is NOT fatal: the row stays `scheduled` and the sweep
 * will publish it — callers should surface deliveryConfirmed:false, not error.
 */
export async function enqueuePublish(params: {
  scheduledPostId: string;
  userId: string;
  notBefore: number; // epoch seconds
}): Promise<{ messageId: string | null }> {
  // QSTASH_PUBLISH_URL is optional and falls back to the canonical app origin
  // (the same source the QStash setup script and CORS use). Without a fallback,
  // an empty/missing value produced a RELATIVE callback URL, which QStash
  // rejects — silently killing exact-time per-post delivery.
  const base = (
    process.env.QSTASH_PUBLISH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://app.agentsforx.com"
  ).replace(/\/$/, "");
  const publishUrl = `${base}/api/qstash/publish`;
  // The post id rides in the callback URL so the failure route can identify the
  // post without depending on QStash's failure-body shape.
  const failureUrl =
    `${base}/api/qstash/failure` +
    `?scheduledPostId=${encodeURIComponent(params.scheduledPostId)}` +
    `&userId=${encodeURIComponent(params.userId)}`;

  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await qstash.publishJSON({
        url: publishUrl,
        body: { scheduledPostId: params.scheduledPostId, userId: params.userId },
        notBefore: params.notBefore,
        retries: 3,
        failureCallback: failureUrl,
      });
      return { messageId: res.messageId };
    } catch (e) {
      lastErr = e;
      if (attempt === 0) await new Promise((r) => setTimeout(r, 300));
    }
  }

  console.error("enqueuePublish: QStash enqueue failed after retries", lastErr);
  Sentry.captureException(lastErr, {
    tags: { area: "qstash_enqueue" },
    extra: { scheduledPostId: params.scheduledPostId, userId: params.userId },
  });
  return { messageId: null };
}
