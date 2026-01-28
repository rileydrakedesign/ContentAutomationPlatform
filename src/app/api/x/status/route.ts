import { NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";

// GET /api/x/status - Get X connection status
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

    const { data: connection } = await supabase
      .from("x_connections")
      .select("x_username, x_user_id, last_sync_at, created_at")
      .eq("user_id", user.id)
      .single();

    if (!connection) {
      return NextResponse.json({ connected: false });
    }

    return NextResponse.json({
      connected: true,
      username: connection.x_username,
      userId: connection.x_user_id,
      lastSyncAt: connection.last_sync_at,
      connectedAt: connection.created_at,
    });
  } catch (error) {
    console.error("Failed to get X status:", error);
    return NextResponse.json(
      { error: "Failed to get status" },
      { status: 500 }
    );
  }
}

// DELETE /api/x/status - Disconnect X account
export async function DELETE() {
  try {
    const supabase = await createAuthClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { error } = await supabase
      .from("x_connections")
      .delete()
      .eq("user_id", user.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to disconnect X:", error);
    return NextResponse.json(
      { error: "Failed to disconnect" },
      { status: 500 }
    );
  }
}
