import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as
      | { email?: string; product?: string }
      | null;

    const email = (body?.email || "").trim().toLowerCase();
    const product = (body?.product || "agent-for-x").trim();

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: "invalid email" }, { status: 400 });
    }

    // Dev-friendly: append to a local file so the landing page works without any backend setup.
    // This is intended for local preview only.
    const line = JSON.stringify({ email, product, createdAt: new Date().toISOString() });
    const out = path.resolve(process.cwd(), "waitlist_signups.dev.jsonl");
    fs.appendFileSync(out, line + "\n", "utf8");

    return NextResponse.json({ ok: true, stored: "file" });
  } catch (err) {
    console.error("waitlist error", err);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
