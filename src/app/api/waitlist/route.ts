import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

const BASE_COUNT = 47;

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function GET() {
  try {
    const sb = createAdminClient();
    const { count, error } = await sb
      .from("waitlist_signups")
      .select("*", { count: "exact", head: true });

    if (error) throw error;
    return NextResponse.json({ count: BASE_COUNT + (count ?? 0) });
  } catch {
    return NextResponse.json({ count: BASE_COUNT });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as
      | { email?: string; product?: string }
      | null;

    const email = (body?.email || "").trim().toLowerCase();

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: "invalid email" }, { status: 400 });
    }

    const sb = createAdminClient();
    const { error } = await sb
      .from("waitlist_signups")
      .insert({ email });

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "already on the waitlist" }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("waitlist error", err);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
