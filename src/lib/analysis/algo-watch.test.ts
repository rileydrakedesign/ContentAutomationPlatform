import { describe, it, expect } from "vitest";
import {
  extractScorerTerms,
  extractReadmeHeads,
  extractTreeFiles,
  diffSnapshots,
  type AlgoSnapshot,
} from "./algo-watch";

// Fixtures are verbatim excerpts from xai-org/x-algorithm (commit 2026-05-15),
// so these tests pin the extractors to the real shape of the source we watch.
const SCORER_FIXTURE = `
        let combined_score = Self::apply(s.favorite_score, p::FAVORITE_WEIGHT)
            + Self::apply(s.reply_score, p::REPLY_WEIGHT)
            + Self::apply(s.retweet_score, p::RETWEET_WEIGHT)
            + Self::apply(s.photo_expand_score, p::PHOTO_EXPAND_WEIGHT)
            + Self::apply(s.click_score, p::CLICK_WEIGHT)
            + Self::apply(s.profile_click_score, p::PROFILE_CLICK_WEIGHT)
            + Self::apply(s.vqv_score, vqv_weight)
            + Self::apply(s.share_score, p::SHARE_WEIGHT)
            + Self::apply(s.dwell_score, p::DWELL_WEIGHT)
            + Self::apply(s.quote_score, p::QUOTE_WEIGHT)
            + Self::apply(s.dwell_time, p::CONT_DWELL_TIME_WEIGHT)
            + Self::apply(s.follow_author_score, p::FOLLOW_AUTHOR_WEIGHT)
            + Self::apply(s.not_interested_score, p::NOT_INTERESTED_WEIGHT)
            + Self::apply(s.block_author_score, p::BLOCK_AUTHOR_WEIGHT)
            + Self::apply(s.report_score, p::REPORT_WEIGHT);
`;

const README_FIXTURE = `
Predictions:
├── P(favorite)
├── P(reply)
├── P(repost)
├── P(dwell)
├── P(block_author)
└── P(report)
`;

const TREE_FIXTURE = [
  { path: "grox/classifiers/content/spam.py", type: "blob" },
  { path: "grox/classifiers/content/banger_initial_screen.py", type: "blob" },
  { path: "grox/classifiers/content/nested/ignore_me.py", type: "blob" },
  { path: "grox/classifiers/content", type: "tree" },
  { path: "home-mixer/filters/age_filter.rs", type: "blob" },
  { path: "home-mixer/filters/muted_keyword_filter.rs", type: "blob" },
  { path: "home-mixer/scorers/weighted_scorer.rs", type: "blob" },
];

function snapshot(overrides: Partial<AlgoSnapshot> = {}): AlgoSnapshot {
  return {
    commit_sha: "abc123",
    commit_date: null,
    scorer_terms: ["favorite_score", "reply_score"],
    readme_heads: ["favorite", "reply"],
    classifier_files: ["spam.py"],
    filter_files: ["age_filter.rs"],
    ...overrides,
  };
}

describe("algo-watch extractors", () => {
  it("pulls every summed term out of the weighted scorer, deduped and sorted", () => {
    const terms = extractScorerTerms(SCORER_FIXTURE);
    expect(terms).toContain("favorite_score");
    expect(terms).toContain("dwell_time");
    expect(terms).toContain("report_score");
    expect(terms).toHaveLength(15);
    expect(terms).toEqual([...terms].sort());
  });

  it("pulls the P(action) heads from the README", () => {
    expect(extractReadmeHeads(README_FIXTURE)).toEqual([
      "block_author",
      "dwell",
      "favorite",
      "reply",
      "report",
      "repost",
    ]);
  });

  it("lists direct blob children of a tree prefix only", () => {
    expect(extractTreeFiles(TREE_FIXTURE, "grox/classifiers/content")).toEqual([
      "banger_initial_screen.py",
      "spam.py",
    ]);
    expect(extractTreeFiles(TREE_FIXTURE, "home-mixer/filters")).toEqual([
      "age_filter.rs",
      "muted_keyword_filter.rs",
    ]);
  });
});

describe("algo-watch diff", () => {
  it("first snapshot is not a review trigger", () => {
    const d = diffSnapshots(null, snapshot());
    expect(d.changed).toBe(true); // vs nothing, everything is "added"
    expect(d.summary).not.toBe("first snapshot"); // fields present → detailed summary
  });

  it("identical snapshots → unchanged", () => {
    const d = diffSnapshots(snapshot(), snapshot({ commit_sha: "def456" }));
    expect(d.changed).toBe(false);
    expect(d.summary).toBe("no structural changes");
  });

  it("reports added and removed entries per field", () => {
    const d = diffSnapshots(
      snapshot(),
      snapshot({ scorer_terms: ["favorite_score", "bookmark_score"] })
    );
    expect(d.changed).toBe(true);
    const scorer = d.details.find((x) => x.field === "scorer_terms")!;
    expect(scorer.added).toEqual(["bookmark_score"]);
    expect(scorer.removed).toEqual(["reply_score"]);
    expect(d.summary).toContain("+bookmark_score");
    expect(d.summary).toContain("-reply_score");
  });
});
