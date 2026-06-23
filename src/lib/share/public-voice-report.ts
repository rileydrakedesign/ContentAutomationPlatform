/**
 * Public (opt-in) Voice Report — the shareable "demonstrate, don't claim"
 * artifact. Resolves a user by their `share_token` and returns ONLY curated,
 * non-sensitive fields (their own public tweets + derived patterns) for the
 * unauthenticated /share/[token] page. No settings, no analytics internals,
 * no credits — just the proof that the voice is mined from their own top posts.
 */
import { createAdminClient } from "@/lib/supabase/server";
import { getAnalyzablePosts } from "@/lib/analysis/posts-pool";

export interface PublicVoiceReport {
  handle: string | null;
  niche_summary: string | null;
  positioning_statement: string | null;
  content_pillars: string[];
  patterns: Array<{
    pattern_name: string;
    pattern_value: string;
    multiplier: number;
    sample_count: number;
    example: string | null;
  }>;
  top_post: { text: string; engagement_score: number } | null;
}

export async function getPublicVoiceReport(token: string): Promise<PublicVoiceReport | null> {
  if (!token || token.length < 16) return null;
  const supabase = createAdminClient();

  const { data: profile } = await supabase
    .from("user_niche_profile")
    .select("user_id, niche_summary, positioning, content_pillars")
    .eq("share_token", token)
    .maybeSingle();

  if (!profile?.user_id) return null;
  const userId = profile.user_id as string;

  const [{ data: conn }, { data: patterns }, pool] = await Promise.all([
    supabase.from("x_connections").select("x_username").eq("user_id", userId).maybeSingle(),
    supabase
      .from("extracted_patterns")
      .select("pattern_name, pattern_value, multiplier, sample_count, source_post_examples")
      .eq("user_id", userId)
      .eq("is_enabled", true)
      .order("multiplier", { ascending: false })
      .limit(4),
    getAnalyzablePosts(supabase, userId),
  ]);

  const positioning = profile.positioning as { positioning_statement?: string } | null;

  return {
    handle: conn?.x_username ?? null,
    niche_summary: profile.niche_summary ?? null,
    positioning_statement: positioning?.positioning_statement ?? null,
    content_pillars: Array.isArray(profile.content_pillars) ? profile.content_pillars : [],
    patterns: (patterns ?? []).map((p) => {
      const examples = (p.source_post_examples as Array<{ text: string }> | null) ?? [];
      return {
        pattern_name: String(p.pattern_name),
        pattern_value: String(p.pattern_value),
        multiplier: Number(p.multiplier) || 1,
        sample_count: Number(p.sample_count) || 0,
        example: examples[0]?.text ?? null,
      };
    }),
    top_post: pool[0]
      ? { text: pool[0].text, engagement_score: Math.round(pool[0].engagement_score) }
      : null,
  };
}
