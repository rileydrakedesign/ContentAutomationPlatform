/**
 * Context freshness — is the tuned context (examples, patterns, niche) older
 * than the user's latest analytics data? Surfaces the "re-tune recommended"
 * state on the dashboard, in get_writing_context, and in whoami so the web
 * app and agents see the same signal.
 *
 * Derived entirely from existing timestamps; nothing new is stamped.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface ContextFreshness {
  analytics_updated_at: string | null;
  examples_refreshed_at: string | null;
  patterns_extracted_at: string | null;
  niche_analyzed_at: string | null;
  /** Pieces of the tuned context that are older than the latest analytics. */
  stale_components: Array<"examples" | "patterns" | "niche">;
  /** True when analytics are newer than any piece of the tuned context. */
  retune_recommended: boolean;
}

export async function getContextFreshness(
  supabase: SupabaseClient,
  userId: string
): Promise<ContextFreshness> {
  const [analyticsRes, capturedRes, settingsRes, patternRes, nicheRes] = await Promise.all([
    supabase
      .from("user_analytics")
      .select("uploaded_at")
      .eq("user_id", userId)
      .order("uploaded_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("captured_posts")
      .select("captured_at")
      .eq("user_id", userId)
      .eq("is_own_post", true)
      .order("captured_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("user_voice_settings")
      .select("last_refresh_at")
      .eq("user_id", userId)
      .eq("voice_type", "post")
      .maybeSingle(),
    supabase
      .from("extracted_patterns")
      .select("created_at")
      .eq("user_id", userId)
      .eq("is_enabled", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("user_niche_profile")
      .select("last_analyzed_at")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  const toTime = (iso: string | null | undefined): number | null => {
    if (!iso) return null;
    const t = new Date(iso).getTime();
    return Number.isFinite(t) ? t : null;
  };

  const analyticsTimes = [
    toTime(analyticsRes.data?.uploaded_at),
    toTime(capturedRes.data?.captured_at),
  ].filter((t): t is number => t !== null);
  const analyticsAt = analyticsTimes.length > 0 ? Math.max(...analyticsTimes) : null;

  const examplesAt = toTime(settingsRes.data?.last_refresh_at);
  const patternsAt = toTime(patternRes.data?.created_at);
  const nicheAt = toTime(nicheRes.data?.last_analyzed_at);

  const staleComponents: ContextFreshness["stale_components"] = [];
  if (analyticsAt !== null) {
    if (examplesAt === null || examplesAt < analyticsAt) staleComponents.push("examples");
    if (patternsAt === null || patternsAt < analyticsAt) staleComponents.push("patterns");
    if (nicheAt === null || nicheAt < analyticsAt) staleComponents.push("niche");
  }

  return {
    analytics_updated_at: analyticsAt !== null ? new Date(analyticsAt).toISOString() : null,
    examples_refreshed_at: examplesAt !== null ? new Date(examplesAt).toISOString() : null,
    patterns_extracted_at: patternsAt !== null ? new Date(patternsAt).toISOString() : null,
    niche_analyzed_at: nicheAt !== null ? new Date(nicheAt).toISOString() : null,
    stale_components: staleComponents,
    retune_recommended: staleComponents.length > 0,
  };
}
