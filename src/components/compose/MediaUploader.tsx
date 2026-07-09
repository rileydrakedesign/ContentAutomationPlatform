"use client";

import { useRef, useState } from "react";
import { ImagePlus, X, AlertCircle } from "lucide-react";
import type { AttachedMedia } from "@/lib/x-api/media";

/**
 * Image/GIF/video uploader with previews and alt text. Uploads each file to the
 * server (which forwards to X and persists a durable copy), then hands the
 * resulting AttachedMedia back to the parent to store on the draft. Up to 4
 * images, or a single GIF/video (X's rules).
 */
export function MediaUploader({
  media,
  onChange,
}: {
  media: AttachedMedia[];
  onChange: (media: AttachedMedia[]) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasVideoOrGif = media.some((m) => m.type === "image/gif" || m.type.startsWith("video/"));
  const atMax = media.length >= 4 || hasVideoOrGif;

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      const next = [...media];
      for (const file of Array.from(files)) {
        if (next.length >= 4) break;
        const isGifOrVideo = file.type === "image/gif" || file.type.startsWith("video/");
        if (isGifOrVideo && next.length > 0) {
          setError("A GIF or video must be the only attachment.");
          break;
        }
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/x/media/upload", { method: "POST", body: form });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error || "Upload failed");
          break;
        }
        next.push({
          media_id: data.media_id,
          type: data.type,
          alt_text: data.alt_text ?? null,
          storage_path: data.storage_path ?? null,
          preview_url: data.preview_url ?? null,
        });
        if (isGifOrVideo) break;
      }
      onChange(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function removeAt(i: number) {
    onChange(media.filter((_, idx) => idx !== i));
  }

  function setAlt(i: number, alt: string) {
    onChange(media.map((m, idx) => (idx === i ? { ...m, alt_text: alt } : m)));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading || atMax}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] disabled:opacity-50 transition-colors"
          title={atMax ? "Attachment limit reached" : "Attach image, GIF, or video"}
        >
          {uploading ? (
            <span aria-hidden className="inline-block animate-[blink_1s_steps(1)_infinite]">▌</span>
          ) : (
            <ImagePlus className="w-3.5 h-3.5" />
          )}
          {uploading ? "Uploading…" : "Add media"}
        </button>
        <span className="text-[11px] text-[var(--color-text-muted)]">
          Up to 4 images, or 1 GIF/video
        </span>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {error && (
        <div className="flex items-center gap-1.5 text-xs text-[var(--color-danger-400)]">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {error}
        </div>
      )}

      {media.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {media.map((m, i) => (
            <div
              key={`${m.media_id}-${i}`}
              className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] overflow-hidden"
            >
              <div className="relative">
                {m.type.startsWith("video/") ? (
                  m.preview_url ? (
                    <video src={m.preview_url} className="w-full h-32 object-cover" controls={false} muted />
                  ) : (
                    <div className="w-full h-32 flex items-center justify-center text-xs text-[var(--color-text-muted)]">
                      video attached
                    </div>
                  )
                ) : m.preview_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.preview_url} alt={m.alt_text || "attached media"} className="w-full h-32 object-cover" />
                ) : (
                  <div className="w-full h-32 flex items-center justify-center text-xs text-[var(--color-text-muted)]">
                    media attached
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/60 text-[var(--color-text-primary)] hover:bg-black/80"
                  title="Remove"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="p-2">
                <input
                  value={m.alt_text || ""}
                  onChange={(e) => setAlt(i, e.target.value)}
                  placeholder="Alt text (accessibility)…"
                  className="w-full text-[11px] bg-transparent border-b border-[var(--color-border-subtle)] py-1 text-[var(--color-text-secondary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent-500)]"
                />
              </div>
            </div>
          ))}
        </div>
      )}
      {media.some((m) => !m.alt_text) && media.length > 0 && (
        <p className="text-[11px] text-[var(--color-text-muted)]">
          Add alt text so your media is accessible. Saved when you save the draft.
        </p>
      )}
    </div>
  );
}
