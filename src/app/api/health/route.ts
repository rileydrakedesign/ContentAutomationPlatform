import { NextRequest, NextResponse } from "next/server";

// GET /api/health - public liveness check. The env-var configuration report
// (booleans only, no values) requires the CRON_SECRET bearer token.
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authorized =
    !!cronSecret &&
    request.headers.get("authorization") === `Bearer ${cronSecret}`;

  if (!authorized) {
    return NextResponse.json({ status: "ok" });
  }

  const vars = {
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
    CLAUDE_API_KEY: !!process.env.CLAUDE_API_KEY,
    GROK_API_KEY: !!process.env.GROK_API_KEY,
    X_API_KEY: !!process.env.X_API_KEY,
    X_API_SECRET: !!process.env.X_API_SECRET,
    X_CLIENT_ID: !!process.env.X_CLIENT_ID,
    X_CLIENT_SECRET: !!process.env.X_CLIENT_SECRET,
    CRON_SECRET: !!process.env.CRON_SECRET,
  };

  return NextResponse.json({ status: "ok", env: vars });
}
