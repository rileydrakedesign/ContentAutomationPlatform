import { NextRequest, NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";
import { generateApiKey } from "@/lib/api/auth";
import { ALLOWED_SCOPES } from "@/lib/api/scopes";

export async function GET() {
  const supabase = await createAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: keys, error } = await supabase
    .from("api_keys")
    .select("id, key_prefix, name, scopes, rate_limit, last_used_at, created_at, revoked_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Failed to fetch keys" }, { status: 500 });
  }

  return NextResponse.json(keys);
}

export async function POST(request: NextRequest) {
  const supabase = await createAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { name?: string; scopes?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { name, scopes } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  if (!scopes || !Array.isArray(scopes) || scopes.length === 0) {
    return NextResponse.json({ error: "At least one scope is required" }, { status: 400 });
  }

  const invalidScopes = scopes.filter(
    (s) => !ALLOWED_SCOPES.includes(s as (typeof ALLOWED_SCOPES)[number])
  );
  if (invalidScopes.length > 0) {
    return NextResponse.json(
      { error: `Invalid scopes: ${invalidScopes.join(", ")}` },
      { status: 400 }
    );
  }

  const { raw, prefix, hash } = generateApiKey();

  const { data: key, error } = await supabase
    .from("api_keys")
    .insert({
      user_id: user.id,
      key_prefix: prefix,
      key_hash: hash,
      name: name.trim(),
      scopes,
    })
    .select("id, key_prefix, name, scopes, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to create key" }, { status: 500 });
  }

  return NextResponse.json({
    ...key,
    key: raw,
  }, { status: 201 });
}
