import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@supabase/supabase-js";
import {
  extractScorerTerms,
  extractReadmeHeads,
  extractTreeFiles,
  diffSnapshots,
  type AlgoSnapshot,
} from "@/lib/analysis/algo-watch";

export const runtime = "nodejs";
export const maxDuration = 60;

const REPO = "xai-org/x-algorithm";
const API = `https://api.github.com/repos/${REPO}`;
const RAW = `https://raw.githubusercontent.com/${REPO}`;
const UA = { "User-Agent": "agentsforx-algo-watch", Accept: "application/vnd.github+json" };

// GET /api/cron/algo-watch — weekly watcher on X's public algorithm repo.
//
// Latest commit unchanged → no-op. New commit → snapshot the structural
// surface our claims KB (x-algorithm.ts) makes claims about (scorer terms,
// README heads, grox classifiers, filters), diff against the previous
// snapshot, persist, and raise a Sentry alert when the structure changed so a
// human re-verifies the KB. Never auto-edits claims — review is the point.
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      console.error("CRON_SECRET is not set; refusing cron request");
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Latest commit on the default branch (public repo; unauthenticated is
    // plenty at a weekly cadence).
    const commitsRes = await fetch(`${API}/commits?per_page=1`, { headers: UA });
    if (!commitsRes.ok) {
      throw new Error(`GitHub commits API ${commitsRes.status}`);
    }
    const [latest] = (await commitsRes.json()) as {
      sha: string;
      commit?: { committer?: { date?: string } };
    }[];
    if (!latest?.sha) throw new Error("GitHub commits API returned no commits");

    const { data: prevRow } = await supabase
      .from("algorithm_source_snapshots")
      .select("commit_sha, scorer_terms, readme_heads, classifier_files, filter_files")
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (prevRow?.commit_sha === latest.sha) {
      return NextResponse.json({ changed: false, commit_sha: latest.sha, note: "no new commit" });
    }

    // 2. New commit — snapshot the structural surface.
    const [treeRes, readmeRes, scorerRes] = await Promise.all([
      fetch(`${API}/git/trees/${latest.sha}?recursive=1`, { headers: UA }),
      fetch(`${RAW}/${latest.sha}/README.md`, { headers: UA }),
      fetch(`${RAW}/${latest.sha}/home-mixer/scorers/weighted_scorer.rs`, { headers: UA }),
    ]);
    if (!treeRes.ok) throw new Error(`GitHub trees API ${treeRes.status}`);

    const tree = ((await treeRes.json()) as { tree?: { path?: string; type?: string }[] }).tree ?? [];
    // Files can move between releases — a fetch miss is itself signal, not an error.
    const readme = readmeRes.ok ? await readmeRes.text() : "";
    const scorer = scorerRes.ok ? await scorerRes.text() : "";

    const snapshot: AlgoSnapshot = {
      commit_sha: latest.sha,
      commit_date: latest.commit?.committer?.date ?? null,
      scorer_terms: extractScorerTerms(scorer),
      readme_heads: extractReadmeHeads(readme),
      classifier_files: extractTreeFiles(tree, "grox/classifiers/content"),
      filter_files: extractTreeFiles(tree, "home-mixer/filters"),
    };

    const prev: AlgoSnapshot | null = prevRow
      ? {
          commit_sha: prevRow.commit_sha,
          commit_date: null,
          scorer_terms: prevRow.scorer_terms ?? [],
          readme_heads: prevRow.readme_heads ?? [],
          classifier_files: prevRow.classifier_files ?? [],
          filter_files: prevRow.filter_files ?? [],
        }
      : null;

    const diff = diffSnapshots(prev, snapshot);
    const reviewRequired = Boolean(prev) && diff.changed;

    const { error: insertError } = await supabase.from("algorithm_source_snapshots").insert({
      commit_sha: snapshot.commit_sha,
      commit_date: snapshot.commit_date,
      scorer_terms: snapshot.scorer_terms,
      readme_heads: snapshot.readme_heads,
      classifier_files: snapshot.classifier_files,
      filter_files: snapshot.filter_files,
      diff_summary: diff.summary,
      review_required: reviewRequired,
    });
    if (insertError) throw new Error(`snapshot insert failed: ${insertError.message}`);

    if (reviewRequired) {
      Sentry.captureMessage(
        `x-algorithm repo changed (${latest.sha.slice(0, 7)}): ${diff.summary} — re-verify ALGORITHM_CLAIMS in x-algorithm.ts`,
        "warning"
      );
    }

    return NextResponse.json({
      changed: true,
      review_required: reviewRequired,
      commit_sha: snapshot.commit_sha,
      commit_date: snapshot.commit_date,
      diff: diff.summary,
    });
  } catch (error) {
    Sentry.captureException(error);
    console.error("algo-watch cron failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "algo-watch failed" },
      { status: 500 }
    );
  }
}
