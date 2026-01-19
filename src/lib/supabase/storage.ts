import { createClient } from "./client";

const VOICE_MEMOS_BUCKET = "voice-memos";

export async function uploadVoiceMemo(
  file: File,
  fileName: string
): Promise<string> {
  const supabase = createClient();

  const { data, error } = await supabase.storage
    .from(VOICE_MEMOS_BUCKET)
    .upload(fileName, file, {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    throw new Error(`Failed to upload voice memo: ${error.message}`);
  }

  return data.path;
}

export async function getVoiceMemoUrl(path: string): Promise<string> {
  const supabase = createClient();

  const { data } = supabase.storage
    .from(VOICE_MEMOS_BUCKET)
    .getPublicUrl(path);

  return data.publicUrl;
}

export async function deleteVoiceMemo(path: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase.storage
    .from(VOICE_MEMOS_BUCKET)
    .remove([path]);

  if (error) {
    throw new Error(`Failed to delete voice memo: ${error.message}`);
  }
}
