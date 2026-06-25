/**
 * LLM token metering.
 *
 * Records per-call token usage for two purposes:
 *  1. Live provider-budget headroom — Redis per-minute counters the admin
 *     dashboard reads to see how close we are to the org RPM/TPM ceiling.
 *  2. Durable audit — best-effort rows in the `llm_usage` table for cost
 *     analysis and per-user attribution.
 *
 * Everything here is best-effort and never throws into the request path: metering
 * failing must not fail a generation.
 */

import * as Sentry from "@sentry/nextjs";
import { getRedisClient } from "@/lib/redis";
import { createAdminClient } from "@/lib/supabase/server";
import type { AIProvider } from "./index";

export interface TokenUsage {
  input: number;
  output: number;
}

export interface UsageRecord extends TokenUsage {
  provider: AIProvider;
  model: string;
  route?: string;
  userId?: string;
}

/** Current UTC minute bucket key suffix, e.g. "202606252045". */
function minuteBucket(now: number): string {
  return new Date(now).toISOString().slice(0, 16).replace(/[-T:]/g, "");
}

/**
 * Increment the live per-minute RPM/TPM counters for a provider. These power the
 * headroom view and let us alert before the provider itself starts 429ing. Keys
 * expire after a few minutes so the set stays small.
 */
async function bumpLiveCounters(rec: UsageRecord, now: number): Promise<void> {
  const r = getRedisClient();
  if (!r) return;
  const bucket = minuteBucket(now);
  const base = `llm:meter:${rec.provider}:${bucket}`;
  const tokens = rec.input + rec.output;
  try {
    const p = r.pipeline();
    p.incr(`${base}:rpm`);
    p.incrby(`${base}:tpm`, tokens);
    p.expire(`${base}:rpm`, 300);
    p.expire(`${base}:tpm`, 300);
    await p.exec();
  } catch (err) {
    Sentry.addBreadcrumb({ category: "llm_meter", level: "warning", message: "live_counter_failed", data: { error: String(err) } });
  }
}

/** Append a durable usage row. Best-effort; swallows errors. */
async function persistRow(rec: UsageRecord): Promise<void> {
  try {
    const supabase = await createAdminClient();
    await supabase.from("llm_usage").insert({
      user_id: rec.userId ?? null,
      provider: rec.provider,
      model: rec.model,
      route: rec.route ?? null,
      input_tokens: rec.input,
      output_tokens: rec.output,
    });
  } catch (err) {
    Sentry.addBreadcrumb({ category: "llm_meter", level: "warning", message: "usage_row_failed", data: { error: String(err) } });
  }
}

/** Record a completed LLM call's token usage. Never throws. */
export async function recordUsage(rec: UsageRecord): Promise<void> {
  const now = Date.now();
  await Promise.allSettled([bumpLiveCounters(rec, now), persistRow(rec)]);
}

/** Read the current minute's live counters for a provider (admin dashboard). */
export async function readLiveCounters(
  provider: AIProvider
): Promise<{ rpm: number; tpm: number } | null> {
  const r = getRedisClient();
  if (!r) return null;
  const base = `llm:meter:${provider}:${minuteBucket(Date.now())}`;
  const [rpm, tpm] = await Promise.all([r.get<number>(`${base}:rpm`), r.get<number>(`${base}:tpm`)]);
  return { rpm: Number(rpm ?? 0), tpm: Number(tpm ?? 0) };
}
