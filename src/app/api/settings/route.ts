import { NextRequest, NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";
import { UpdateSettingsRequest } from "@/types/captured";

// GET /api/settings - Get user settings
export async function GET() {
  try {
    const supabase = await createAuthClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get or create settings
    let { data: settings, error } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (error && error.code === "PGRST116") {
      // Create default settings if none exist
      const { data: newSettings, error: insertError } = await supabase
        .from("user_settings")
        .insert({
          user_id: user.id,
          x_handles: [],
        })
        .select()
        .single();

      if (insertError) throw insertError;
      settings = newSettings;
    } else if (error) {
      throw error;
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error("Failed to fetch settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

// PATCH /api/settings - Update user settings
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createAuthClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: UpdateSettingsRequest = await request.json();

    // Clean up handles - remove @ prefix and whitespace
    const cleanedHandles = body.x_handles
      ? body.x_handles.map((h) => h.replace("@", "").trim()).filter(Boolean)
      : undefined;

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (cleanedHandles !== undefined) {
      updateData.x_handles = cleanedHandles;
    }

    // Upsert settings (create if doesn't exist)
    const { data, error } = await supabase
      .from("user_settings")
      .upsert(
        {
          user_id: user.id,
          ...updateData,
        },
        { onConflict: "user_id" }
      )
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to update settings:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
