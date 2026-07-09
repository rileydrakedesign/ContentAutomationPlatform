import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

export const maxDuration = 10;
import { corsHeaders, handleCors } from "@/lib/cors";
import { requireFeature } from "@/lib/stripe/gate";
import { getDualAuthUser } from "@/lib/api/dual-auth";

export async function OPTIONS() {
  return handleCors();
}

// POST /api/assistant/telemetry — log a writing-assistant suggestion event
// (accept / dismiss / retain). Powers value-based tuning of the live-read trigger
// (which suggestion types actually get accepted AND kept). Fire-and-forget from
// the client; subscription-gated, never metered. Best-effort: a write failure
// (e.g. table not migrated yet) returns 200 so the client never surfaces it.
const ACTIONS = new Set(["accept", "dismiss", "retain"]);
const CLASSES = new Set(["correctness", "clarity", "voice", "reach"]);

// Per-user signal suppression ("suppression of correct-but-annoying rules"): a
// signal the user keeps dismissing and never accepts stops being shown. Read by
// the client once per editor mount.
const SUPPRESS_MIN_DISMISSES = 3;
const SUPPRESS_LOOKBACK_ROWS = 500;

// GET /api/assistant/telemetry — aggregate the user's recent suggestion events
// into the set of suppressed signals. This closes the accept/dismiss feedback
// loop: the write side (POST below) has always logged; this is the read side.
export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getDualAuthUser(request);
    if (!user || !supabase) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const gateError = await requireFeature(user.id, "writingAssistant");
    if (gateError) return gateError;

    const { data, error } = await supabase
      .from("assistant_suggestion_events")
      .select("action, signal")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(SUPPRESS_LOOKBACK_ROWS);
    if (error) {
      // Best-effort like the write side — no suppression beats a broken editor.
      console.error("assistant/telemetry read:", error.message);
      return NextResponse.json({ suppressed_signals: [] }, { status: 200, headers: corsHeaders });
    }

    const stats = new Map<string, { accepts: number; dismisses: number }>();
    for (const row of data ?? []) {
      const signal = typeof row.signal === "string" && row.signal ? row.signal : null;
      if (!signal) continue;
      const s = stats.get(signal) ?? { accepts: 0, dismisses: 0 };
      // A retain implies an accept that stuck — strongest positive signal.
      if (row.action === "accept" || row.action === "retain") s.accepts += 1;
      else if (row.action === "dismiss") s.dismisses += 1;
      stats.set(signal, s);
    }
    const suppressed_signals = [...stats.entries()]
      .filter(([, s]) => s.dismisses >= SUPPRESS_MIN_DISMISSES && s.accepts === 0)
      .map(([signal]) => signal);

    return NextResponse.json({ suppressed_signals }, { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error("Assistant telemetry read failed:", error);
    Sentry.captureException(error, { tags: { route: "assistant-telemetry" } });
    return NextResponse.json({ suppressed_signals: [] }, { status: 200, headers: corsHeaders });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await getDualAuthUser(request);
    if (!user || !supabase) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const gateError = await requireFeature(user.id, "writingAssistant");
    if (gateError) return gateError;

    let body: {
      action?: string;
      finding_class?: string;
      source?: string;
      signal?: string;
      voice_score?: number;
    };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400, headers: corsHeaders });
    }

    const action = String(body.action || "");
    if (!ACTIONS.has(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400, headers: corsHeaders });
    }
    const finding_class = CLASSES.has(String(body.finding_class)) ? String(body.finding_class) : null;
    const source = body.source === "tier0" || body.source === "live" ? body.source : null;
    const signal = typeof body.signal === "string" ? body.signal.slice(0, 64) : null;
    const voice_score = Number.isFinite(Number(body.voice_score))
      ? Math.max(0, Math.min(100, Math.round(Number(body.voice_score))))
      : null;

    // Best-effort insert — never fail the request on a write/RLS/missing-table error.
    const { error } = await supabase.from("assistant_suggestion_events").insert({
      user_id: user.id,
      action,
      finding_class,
      source,
      signal,
      voice_score,
    });
    if (error) console.error("assistant/telemetry insert:", error.message);

    return NextResponse.json({ ok: true }, { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error("Assistant telemetry failed:", error);
    Sentry.captureException(error, { tags: { route: "assistant-telemetry" } });
    // Telemetry must never be load-bearing — report success regardless.
    return NextResponse.json({ ok: true }, { status: 200, headers: corsHeaders });
  }
}
