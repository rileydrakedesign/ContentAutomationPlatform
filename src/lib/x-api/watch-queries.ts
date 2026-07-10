/**
 * Topic-watch query compiler (PRD_CORE §3.1, gap G2): the niche model's topic
 * clusters become ready-to-run search queries, so discovery "never starts from
 * a blank query box." v0.5 runs these as one-click on-demand searches on the
 * user's token; Phase 1 turns the same compiled queries into pooled sweep
 * units — the compiler is shared either way.
 *
 * Pure and deterministic: cluster keywords → OR-group with quoting for
 * multi-word phrases + the standard hygiene filters (original posts only,
 * user's language).
 */

export interface TopicClusterLike {
  /** Cluster display name (`name` in the niche model, `label` elsewhere). */
  label?: string | null;
  name?: string | null;
  keywords?: string[] | null;
}

export interface CompiledWatchQuery {
  /** Human label, from the cluster: "indie SaaS marketing". */
  label: string;
  /** X search query: ("kw1" OR "kw2" OR kw3) lang:en -is:retweet -is:reply */
  query: string;
}

const MAX_WATCHES = 6;
const MAX_KEYWORDS_PER_QUERY = 3;
const HYGIENE = "-is:retweet -is:reply";

function term(keyword: string): string {
  const k = keyword.trim();
  // Quote multi-word phrases so they match as phrases, not loose ANDs.
  return /\s/.test(k) ? `"${k.replace(/"/g, "")}"` : k;
}

export function compileWatchQueries(
  clusters: TopicClusterLike[],
  opts: { lang?: string } = {}
): CompiledWatchQuery[] {
  const lang = (opts.lang || "en").trim();
  const out: CompiledWatchQuery[] = [];
  const seen = new Set<string>();

  for (const cluster of clusters || []) {
    if (out.length >= MAX_WATCHES) break;
    const label = (cluster.label || cluster.name || "").trim();
    const keywords = (cluster.keywords || [])
      .map((k) => (k || "").trim())
      .filter((k) => k.length >= 2)
      .slice(0, MAX_KEYWORDS_PER_QUERY);
    if (!label || keywords.length === 0) continue;
    if (seen.has(label.toLowerCase())) continue;
    seen.add(label.toLowerCase());

    const group =
      keywords.length === 1 ? term(keywords[0]) : `(${keywords.map(term).join(" OR ")})`;
    out.push({ label, query: `${group} lang:${lang} ${HYGIENE}` });
  }

  return out;
}
