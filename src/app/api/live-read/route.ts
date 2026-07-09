import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

export const maxDuration = 60;
import { corsHeaders, handleCors } from "@/lib/cors";
import { requireFeature } from "@/lib/stripe/gate";
import { runLiveRead, runLiveReadStream, warmLiveRead } from "@/lib/analysis/live-read";
import { getDualAuthUser } from "@/lib/api/dual-auth";

export async function OPTIONS() {
  return handleCors();
}

// POST /api/live-read — the writing assistant's L3 pass: the on-demand LLM read
// returning anchored voice-drift findings (verbatim quotes), rewrites, and
// missing high-lift patterns. The live 0-100 voice/performance SCORES come from
// the cheap L2 embedding route (/api/assistant/score); the deterministic
// algorithm flags are computed client-side (Tier 0). This route is rare
// (panel-open / low-score-idle / explicit "why?"), never per-pause.
//
// SUBSCRIPTION-GATED (requireFeature), NOT metered — the writing loop can't have
// a credit meter ticking, and consuming an AI-generation slot here would 429 a
// user mid-sentence and block their real generation (locked decision). Read-first
// cached server-side by draft_hash; the client also caches by text.
export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await getDualAuthUser(request);
    if (!user || !supabase) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const gateError = await requireFeature(user.id, "writingAssistant");
    if (gateError) return gateError;

    let body: {
      text?: string;
      voice_type?: string;
      draft_type?: string;
      has_media?: boolean;
      parent_text?: string;
      warm?: boolean;
      stream?: boolean;
      session_edits?: unknown;
      declined?: unknown;
      core_idea?: unknown;
    };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400, headers: corsHeaders });
    }

    const voiceTypeIn = body.voice_type === "reply" ? "reply" : "post";

    // Warm mode: prime the prompt cache for this user's grounding so the next real
    // read is a fast cache-read. No draft needed; returns immediately.
    if (body.warm) {
      await warmLiveRead(supabase, user.id, voiceTypeIn);
      return NextResponse.json({ warmed: true }, { status: 200, headers: corsHeaders });
    }

    const text = String(body.text || "").trim();
    if (text.length < 5) {
      return NextResponse.json(
        { error: "Draft text must be at least 5 characters" },
        { status: 400, headers: corsHeaders }
      );
    }
    const draftType = body.draft_type === "X_THREAD" ? "X_THREAD" : "X_POST";
    // Reply mode may carry the post being replied to (G6: the extension's
    // in-X reply composer sends it), so the judge reads the reply in context.
    // Capped — it's prompt context, not content we store.
    const parentText =
      voiceTypeIn === "reply" ? String(body.parent_text || "").trim().slice(0, 1000) : "";

    // Session context (the accepted-edit ledger + dismissals from THIS editing
    // session) — echoed into the prompt, so sanitize hard: cap counts, truncate
    // strings, drop malformed entries.
    const sessionEdits = Array.isArray(body.session_edits)
      ? (body.session_edits as unknown[])
          .slice(0, 12)
          .map((e) => {
            const o = (e ?? {}) as { before?: unknown; after?: unknown };
            return {
              before: String(o.before ?? "").slice(0, 280),
              after: String(o.after ?? "").slice(0, 280),
            };
          })
          .filter((e) => e.before && e.after)
      : undefined;
    // The core idea a previous read pinned this session — the north star the
    // model keeps serving instead of re-deriving a direction per read.
    const coreIdea =
      typeof body.core_idea === "string" ? body.core_idea.trim().slice(0, 200) || undefined : undefined;
    const declined = Array.isArray(body.declined)
      ? (body.declined as unknown[])
          .slice(0, 8)
          .map((d) => {
            const o = (d ?? {}) as { quote?: unknown; issue?: unknown };
            return {
              quote: String(o.quote ?? "").slice(0, 280) || undefined,
              issue: String(o.issue ?? "").slice(0, 140),
            };
          })
          .filter((d) => d.issue)
      : undefined;

    // Streaming path: relay each finding as it resolves (SSE), so underlines/cards
    // appear progressively instead of in one batch.
    if (body.stream) {
      const encoder = new TextEncoder();
      // The client aborts a read whenever a newer one supersedes it (e.g. on
      // Accept); that cancels the stream and closes the controller. Guard every
      // write so a post-close enqueue can't throw ("Controller is already closed"),
      // and stop iterating once cancelled.
      let cancelled = false;
      const sse = new ReadableStream({
        async start(controller) {
          const send = (obj: unknown) => {
            if (cancelled) return;
            try {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
            } catch {
              cancelled = true; // controller closed under us — stop writing
            }
          };
          try {
            for await (const ev of runLiveReadStream(supabase, user.id, text, voiceTypeIn, {
              draftType,
              sessionEdits,
              declined,
              coreIdea,
              parentText: parentText || undefined,
            })) {
              if (cancelled) break;
              send(ev);
            }
            send({ type: "done" });
          } catch (e) {
            console.error("Live read stream failed:", e);
            send({ type: "error" });
          } finally {
            try {
              if (!cancelled) controller.close();
            } catch {
              /* already closed */
            }
          }
        },
        cancel() {
          cancelled = true;
        },
      });
      return new Response(sse, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    }

    const result = await runLiveRead(supabase, user.id, text, voiceTypeIn, {
      draftType,
      sessionEdits,
      declined,
      coreIdea,
      parentText: parentText || undefined,
    });

    return NextResponse.json(result, { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error("Live read failed:", error);
    Sentry.captureException(error, { tags: { route: "live-read" } });
    return NextResponse.json({ error: "Live read failed" }, { status: 500, headers: corsHeaders });
  }
}
