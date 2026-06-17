import { NextRequest, NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@supabase/supabase-js";
import { executeScheduledPost } from "@/lib/publish/execute";

export const runtime = "nodejs";
export const maxDuration = 300;

// The safety-net sweep: recover stuck `publishing` rows and publish any
// `scheduled` post past its due time that QStash never delivered. Shared by the
// Vercel cron (GET + CRON_SECRET) and the QStash schedule (POST + signature).
// Both triggers are CAS-safe against each other and the per-post QStash
// delivery — at most one actor publishes a given post.
async function runSweep() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Recover posts stuck in 'publishing' (process died mid-publish): mark
  // failed so they surface in the queue UI. Never auto-republish — tweets
  // may have partially posted.
  const stuckCutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: stuckPosts } = await supabase
    .from("scheduled_posts")
    .update({
      status: "failed",
      error:
        "Publishing did not complete (process interrupted). Some tweets may already be on X — check before retrying.",
      updated_at: new Date().toISOString(),
    })
    .eq("status", "publishing")
    .lt("updated_at", stuckCutoff)
    .select("id");
  const recovered = stuckPosts?.length ?? 0;

  // Find all posts due for publishing
  const { data: duePosts, error: queryError } = await supabase
    .from("scheduled_posts")
    .select("id, user_id, content_type, payload, scheduled_for, draft_id")
    .eq("status", "scheduled")
    .lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for", { ascending: true });

  if (queryError) throw queryError;
  if (!duePosts || duePosts.length === 0) {
    return { published: 0, failed: 0, recovered, total: 0 };
  }

  let published = 0;
  let failed = 0;

  for (const post of duePosts) {
    const result = await executeScheduledPost(supabase, post);
    if (result.success) {
      published++;
    } else {
      failed++;
    }
  }

  return { published, failed, recovered, total: duePosts.length };
}

// GET — Vercel cron trigger (Authorization: Bearer ${CRON_SECRET}).
export async function GET(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      console.error("CRON_SECRET is not set; refusing cron request");
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }
    if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(await runSweep());
  } catch (error) {
    console.error("Cron publish-scheduled error:", error);
    Sentry.captureException(error, { tags: { cron: "publish-scheduled" } });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST — QStash schedule trigger (signature-verified). Lets a QStash cron drive
// the sweep on a sub-daily cadence without needing a Vercel Pro cron.
export async function POST(request: NextRequest) {
  try {
    const receiver = new Receiver({
      currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
      nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
    });

    const rawBody = await request.text();
    const signature = request.headers.get("upstash-signature");
    if (!signature) {
      return NextResponse.json({ error: "Missing signature" }, { status: 401 });
    }
    try {
      await receiver.verify({ signature, body: rawBody });
    } catch {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    return NextResponse.json(await runSweep());
  } catch (error) {
    console.error("Cron publish-scheduled (QStash) error:", error);
    Sentry.captureException(error, { tags: { cron: "publish-scheduled" } });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
