import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createAuthClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createAuthClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limit = Number(request.nextUrl.searchParams.get("limit") || 100);

    const { data, error } = await supabase
      .from("drafts")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "DRAFT")
      .order("created_at", { ascending: false })
      .limit(Math.min(500, Math.max(1, limit)));

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to fetch drafts:", error);
    Sentry.captureException(error, { tags: { route: "drafts" } });
    return NextResponse.json(
      { error: "Failed to fetch drafts" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createAuthClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { type, content, topic, appliedPatterns, metadata } = body as {
      type: string;
      content: Record<string, unknown>;
      topic?: string;
      appliedPatterns?: string[];
      metadata?: Record<string, unknown>;
    };

    if (!type || !content) {
      return NextResponse.json({ error: "Missing type or content" }, { status: 400 });
    }

    const { data: draft, error } = await supabase
      .from("drafts")
      .insert({
        user_id: user.id,
        type,
        status: "DRAFT",
        content,
        topic: topic || null,
        applied_patterns: appliedPatterns || [],
        metadata: metadata || {},
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(draft, { status: 201 });
  } catch (error) {
    console.error("Failed to create draft:", error);
    Sentry.captureException(error, { tags: { route: "drafts" } });
    return NextResponse.json(
      { error: "Failed to create draft" },
      { status: 500 }
    );
  }
}
