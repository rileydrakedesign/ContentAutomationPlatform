/**
 * Attached-media model shared across the composer, drafts, and publish paths.
 *
 * A media_id from X is ephemeral (unused media expires within ~24h), so we also
 * persist the file in the `draft-media` bucket (`storage_path` + public
 * `preview_url`). For scheduled posts we re-upload from storage at publish time
 * to get a fresh media_id; for immediate posts the just-uploaded media_id is
 * still valid and used directly.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { uploadMediaV2, setMediaAltText } from "./client";

export interface AttachedMedia {
  /** X media_id from the most recent upload (may be stale for old scheduled posts). */
  media_id: string;
  /** MIME type, e.g. "image/png", "video/mp4". */
  type: string;
  /** Accessibility alt text (also re-applied on re-upload). */
  alt_text: string | null;
  /** Path inside the `draft-media` bucket (durable source for re-upload). */
  storage_path: string | null;
  /** Public URL for previewing the media in the UI. */
  preview_url: string | null;
}

export const DRAFT_MEDIA_BUCKET = "draft-media";

/** Narrow an unknown (from draft/payload JSON) into AttachedMedia[]. */
export function parseAttachedMedia(raw: unknown): AttachedMedia[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m): m is Record<string, unknown> => !!m && typeof m === "object")
    .map((m) => ({
      media_id: String(m.media_id ?? ""),
      type: String(m.type ?? "application/octet-stream"),
      alt_text: m.alt_text != null ? String(m.alt_text) : null,
      storage_path: m.storage_path != null ? String(m.storage_path) : null,
      preview_url: m.preview_url != null ? String(m.preview_url) : null,
    }))
    .filter((m) => m.media_id || m.storage_path);
}

/**
 * Resolve a fresh list of X media_ids ready to attach to a tweet. When
 * `forceReupload` is set (scheduled publish — the stored media_id may be
 * expired), each item is re-uploaded from its durable storage copy and alt text
 * re-applied. Returns the media_ids in order; items without a usable source are
 * skipped (logged by the caller).
 */
export async function resolveMediaIdsForPublish(
  supabase: SupabaseClient,
  accessToken: string,
  media: AttachedMedia[],
  opts: { forceReupload: boolean }
): Promise<string[]> {
  const ids: string[] = [];
  for (const m of media) {
    if (!opts.forceReupload && m.media_id) {
      // Re-apply alt text in case the user edited it after the initial upload
      // (best-effort — never block publish on an alt-text failure).
      if (m.alt_text) {
        try {
          await setMediaAltText(accessToken, m.media_id, m.alt_text);
        } catch {
          // ignore
        }
      }
      ids.push(m.media_id);
      continue;
    }
    if (!m.storage_path) {
      // No durable copy to re-upload from — fall back to the (possibly stale)
      // media_id rather than dropping it silently.
      if (m.media_id) ids.push(m.media_id);
      continue;
    }
    const { data, error } = await supabase.storage
      .from(DRAFT_MEDIA_BUCKET)
      .download(m.storage_path);
    if (error || !data) {
      if (m.media_id) ids.push(m.media_id);
      continue;
    }
    const bytes = Buffer.from(await data.arrayBuffer());
    const uploaded = await uploadMediaV2(accessToken, bytes, m.type);
    if (m.alt_text) {
      try {
        await setMediaAltText(accessToken, uploaded.media_id, m.alt_text);
      } catch {
        // best-effort
      }
    }
    ids.push(uploaded.media_id);
  }
  return ids.slice(0, 4);
}
