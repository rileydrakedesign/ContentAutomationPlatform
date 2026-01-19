import { NextRequest, NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";

const VOICE_MEMOS_BUCKET = "voice-memos";

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

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const fileName = `${timestamp}-${file.name}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(VOICE_MEMOS_BUCKET)
      .upload(fileName, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload file" },
        { status: 500 }
      );
    }

    // Create source record
    const { data: source, error } = await supabase
      .from("sources")
      .insert({
        user_id: user.id,
        type: "VOICE_MEMO",
        audio_path: uploadData.path,
        metadata: {
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
        },
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(source, { status: 201 });
  } catch (error) {
    console.error("Failed to create voice memo:", error);
    return NextResponse.json(
      { error: "Failed to create voice memo" },
      { status: 500 }
    );
  }
}
