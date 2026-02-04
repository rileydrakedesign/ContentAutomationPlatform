import { NextResponse } from "next/server";

// GET /api/health - Check which env vars are configured (no values exposed)
export async function GET() {
  const vars = {
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    DATABASE_URL: !!process.env.DATABASE_URL,
    REDIS_URL: !!process.env.REDIS_URL,
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
