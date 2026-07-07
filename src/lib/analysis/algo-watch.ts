/**
 * algo-watch — pure helpers for tracking X's public algorithm repo.
 *
 * The public source of truth for the ranking system's *structure* is
 * github.com/xai-org/x-algorithm (weights stay redacted server-side). The
 * algo-watch cron snapshots the structural surface we make claims about and
 * diffs it against the previous snapshot, so a new release turns into a
 * reviewed diff instead of silent drift in our claims KB (x-algorithm.ts).
 *
 * Everything here is pure (string/JSON in, data out) so it's unit-testable
 * offline; the cron route owns fetching and persistence.
 */

/** The structural surface we snapshot per commit. */
export interface AlgoSnapshot {
  commit_sha: string;
  commit_date: string | null;
  /** Predicted-engagement terms summed by home-mixer/scorers/weighted_scorer.rs. */
  scorer_terms: string[];
  /** P(action) heads listed in the README's scoring section. */
  readme_heads: string[];
  /** Grok content classifiers (grox/classifiers/content/*.py). */
  classifier_files: string[];
  /** Pre-scoring filters (home-mixer/filters/*.rs). */
  filter_files: string[];
}

/**
 * Extract the engagement terms the weighted scorer sums, from the Rust source.
 * Matches `Self::apply(s.<term>, ...)` — the shape of every term in
 * compute_weighted_score(). Dedupes and sorts for stable diffs.
 */
export function extractScorerTerms(rustSource: string): string[] {
  const terms = new Set<string>();
  const re = /Self::apply\(\s*s\.([a-z0-9_]+)\s*,/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(rustSource)) !== null) terms.add(m[1]);
  return [...terms].sort();
}

/** Extract the P(action) head names from the README scoring section. */
export function extractReadmeHeads(markdown: string): string[] {
  const heads = new Set<string>();
  const re = /P\(([a-z0-9_]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown)) !== null) heads.add(m[1]);
  return [...heads].sort();
}

/**
 * Pick file basenames under a directory prefix out of a GitHub git-tree
 * listing (`GET /git/trees/{sha}?recursive=1` → { tree: [{ path, type }] }).
 */
export function extractTreeFiles(
  tree: { path?: string; type?: string }[],
  prefix: string
): string[] {
  return tree
    .filter((e) => e.type === "blob" && e.path?.startsWith(prefix))
    .map((e) => e.path!.slice(prefix.length).replace(/^\//, ""))
    .filter((name) => name && !name.includes("/"))
    .sort();
}

export interface SnapshotDiff {
  changed: boolean;
  summary: string;
  details: {
    field: keyof Omit<AlgoSnapshot, "commit_sha" | "commit_date">;
    added: string[];
    removed: string[];
  }[];
}

/**
 * Diff two snapshots' structural lists. `changed` is true when any list
 * differs — that's the "a human should re-verify the claims KB" signal.
 */
export function diffSnapshots(prev: AlgoSnapshot | null, next: AlgoSnapshot): SnapshotDiff {
  const fields = ["scorer_terms", "readme_heads", "classifier_files", "filter_files"] as const;
  const details: SnapshotDiff["details"] = [];

  for (const field of fields) {
    const before = new Set(prev?.[field] ?? []);
    const after = new Set(next[field]);
    const added = [...after].filter((x) => !before.has(x));
    const removed = [...before].filter((x) => !after.has(x));
    if (added.length || removed.length) details.push({ field, added, removed });
  }

  const changed = details.length > 0;
  const summary = changed
    ? details
        .map(
          (d) =>
            `${d.field}: ${[
              d.added.length ? `+${d.added.join(", +")}` : "",
              d.removed.length ? `-${d.removed.join(", -")}` : "",
            ]
              .filter(Boolean)
              .join(" ")}`
        )
        .join(" · ")
    : prev
      ? "no structural changes"
      : "first snapshot";

  return { changed, summary, details };
}
