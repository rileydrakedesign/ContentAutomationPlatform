import * as Sentry from "@sentry/nextjs";
import { qstash } from "./client";

/**
 * Enqueue an agentic generation job for async execution via QStash. Mirrors
 * enqueuePublish's reliability posture: inline retry + QStash retries + a
 * failure callback that marks the job `failed` if delivery is exhausted.
 *
 * Returns the QStash messageId, or null if enqueue failed after inline retries.
 * A null result is fatal for this flow (unlike publishing there's no sweep), so
 * the caller should mark the job failed and surface an error.
 */
export async function enqueueLlmJob(params: {
  jobId: string;
  userId: string;
}): Promise<{ messageId: string | null }> {
  const base = (
    process.env.QSTASH_PUBLISH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://app.agentsforx.com"
  ).replace(/\/$/, "");
  const workerUrl = `${base}/api/qstash/llm-job`;
  // The failure callback hits the same worker with ?failure=1 so a dead-lettered
  // message flips the job to `failed` instead of leaving it stuck `queued`.
  const failureUrl =
    `${workerUrl}?failure=1` +
    `&jobId=${encodeURIComponent(params.jobId)}` +
    `&userId=${encodeURIComponent(params.userId)}`;

  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await qstash.publishJSON({
        url: workerUrl,
        body: { jobId: params.jobId, userId: params.userId },
        retries: 2,
        failureCallback: failureUrl,
      });
      return { messageId: res.messageId };
    } catch (e) {
      lastErr = e;
      if (attempt === 0) await new Promise((r) => setTimeout(r, 300));
    }
  }

  console.error("enqueueLlmJob: QStash enqueue failed after retries", lastErr);
  Sentry.captureException(lastErr, {
    tags: { area: "qstash_enqueue_llm" },
    extra: { jobId: params.jobId, userId: params.userId },
  });
  return { messageId: null };
}
