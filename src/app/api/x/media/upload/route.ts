import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

export const maxDuration = 120;
import { createAuthClient } from "@/lib/supabase/server";
import { getValidAccessToken, uploadMediaV2, setMediaAltText } from "@/lib/x-api";
import { DRAFT_MEDIA_BUCKET } from "@/lib/x-api/media";
import { checkRateLimit } from "@/lib/api/rate-limit";

// Server-side X media upload. The X token never leaves the server; the browser
// posts the file here and gets back a media_id to attach to a draft/publish.
//
// POST multipart/form-data: { file: <image|gif|video>, alt_text?: string }
// → { media_id, category, type (mime), alt_text }
//
// Supported: images (jpeg/png/webp), GIF, video (mp4). Limits mirror X's:
// images ≤ 5 MB, GIF ≤ 15 MB, video ≤ 512 MB. Requires the connected X account
// to have granted media.write (reconnect if it predates that scope → 403).

const LIMITS: Record<string, number> = {
  image: 5 * 1024 * 1024,
  gif: 15 * 1024 * 1024,
  video: 512 * 1024 * 1024,
};

function kindForMime(mime: string): "image" | "gif" | "video" | null {
  if (mime === "image/gif") return "gif";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  return null;
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

    // Per-user throttle — uploads buffer large files in memory and hit X.
    const rl = await checkRateLimit(`x-media:${user.id}`, 20);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many uploads — please slow down." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }

    const form = await request.formData();
    const file = form.get("file");
    const altText = String(form.get("alt_text") || "").trim();

    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    const mime = file.type || "application/octet-stream";
    const kind = kindForMime(mime);
    if (!kind) {
      return NextResponse.json(
        { error: `Unsupported media type: ${mime}. Use an image, GIF, or video.` },
        { status: 400 }
      );
    }

    if (file.size > LIMITS[kind]) {
      const mb = Math.round(LIMITS[kind] / (1024 * 1024));
      return NextResponse.json(
        { error: `${kind} too large — X allows up to ${mb} MB.` },
        { status: 400 }
      );
    }

    const { accessToken } = await getValidAccessToken(user.id);
    const bytes = Buffer.from(await file.arrayBuffer());

    let uploaded: { media_id: string; category: string };
    try {
      uploaded = await uploadMediaV2(accessToken, bytes, mime);
    } catch (e) {
      const detail = e instanceof Error ? e.message : "media upload failed";
      // A missing media.write scope surfaces as a 403 from X — tell the user to
      // reconnect rather than showing a raw error.
      if (/403|unauthorized|scope/i.test(detail)) {
        return NextResponse.json(
          {
            error:
              "X didn't allow the upload. Reconnect your X account to grant media permissions, then try again.",
            reconnect_required: true,
          },
          { status: 403 }
        );
      }
      throw e;
    }

    // Alt text is best-effort — a failure here shouldn't block attaching media.
    if (altText) {
      try {
        await setMediaAltText(accessToken, uploaded.media_id, altText);
      } catch (e) {
        console.warn("media upload: failed to set alt text", e);
      }
    }

    // Persist the file durably so media survives draft save and (crucially)
    // scheduling — X media_ids expire, so scheduled publishes re-upload from
    // here. Path is prefixed with the user id to satisfy the bucket's RLS.
    let storagePath: string | null = null;
    let previewUrl: string | null = null;
    try {
      const ext = mime.split("/")[1]?.split("+")[0] || "bin";
      const rand = uploaded.media_id || `${file.size}-${bytes.length}`;
      storagePath = `${user.id}/${rand}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(DRAFT_MEDIA_BUCKET)
        .upload(storagePath, bytes, { contentType: mime, upsert: true });
      if (upErr) {
        console.warn("media upload: failed to persist to storage", upErr);
        storagePath = null;
      } else {
        previewUrl = supabase.storage.from(DRAFT_MEDIA_BUCKET).getPublicUrl(storagePath)
          .data.publicUrl;
      }
    } catch (e) {
      console.warn("media upload: storage persistence error", e);
      storagePath = null;
    }

    return NextResponse.json({
      media_id: uploaded.media_id,
      category: uploaded.category,
      type: mime,
      alt_text: altText || null,
      storage_path: storagePath,
      preview_url: previewUrl,
    });
  } catch (error) {
    console.error("Media upload failed:", error);
    Sentry.captureException(error, { tags: { route: "x/media/upload" } });
    return NextResponse.json({ error: "Media upload failed. Please try again." }, { status: 500 });
  }
}
