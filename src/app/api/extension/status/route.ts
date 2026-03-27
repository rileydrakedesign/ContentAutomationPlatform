import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createAuthClient } from "@/lib/supabase/server";
import { corsHeaders, handleCors } from "@/lib/cors";
import { getUserSubscription, checkAiGenerationLimit } from "@/lib/stripe/subscription";
import { PLANS } from "@/types/subscription";

export async function OPTIONS() {
  return handleCors();
}

async function getAuthenticatedUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return { user: null, supabase: null };
    return { user, supabase };
  }

  const supabase = await createAuthClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { user: null, supabase: null };
  return { user, supabase };
}

/**
 * GET /api/extension/status
 * Returns the user's plan, usage limits, and setup completeness for the Chrome extension.
 */
export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request);
    if (!user || !supabase) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    // Fetch subscription, usage, and setup status in parallel
    const [sub, usage, voiceResult, xConnectionResult] = await Promise.all([
      getUserSubscription(user.id),
      checkAiGenerationLimit(user.id),
      supabase
        .from("user_voice_settings")
        .select("id")
        .eq("user_id", user.id)
        .limit(1),
      supabase
        .from("x_connections")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1),
    ]);

    const plan = PLANS[sub.plan_id as keyof typeof PLANS] || PLANS.free;
    const isActive = sub.status === "active" || sub.status === "trialing";
    const effectivePlan = isActive ? plan : PLANS.free;

    // Determine setup completeness
    const onboardingCompleted = user.user_metadata?.onboarding_completed === true;
    const voiceConfigured = (voiceResult.data?.length ?? 0) > 0;
    const xConnected = (xConnectionResult.data?.length ?? 0) > 0;

    return NextResponse.json({
      plan: {
        id: effectivePlan.id,
        name: effectivePlan.name,
        price: effectivePlan.price,
      },
      usage: {
        used: usage.limit === Infinity ? 0 : usage.limit - usage.remaining,
        limit: usage.limit === Infinity ? null : usage.limit,
        remaining: usage.remaining === Infinity ? null : usage.remaining,
        unlimited: usage.limit === Infinity,
      },
      setup: {
        onboarding_completed: onboardingCompleted,
        voice_configured: voiceConfigured,
        x_connected: xConnected,
      },
      upgrade_url: "/pricing",
    }, { headers: corsHeaders });
  } catch (error) {
    console.error("Extension status error:", error);
    return NextResponse.json(
      { error: "Failed to fetch status" },
      { status: 500, headers: corsHeaders }
    );
  }
}
