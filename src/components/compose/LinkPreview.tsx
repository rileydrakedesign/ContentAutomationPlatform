"use client";

import { useEffect, useState } from "react";
import { Link2, X } from "lucide-react";
import { firstUrl } from "@/lib/x-api/tweet-text";

interface OgData {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  site_name?: string | null;
}

/**
 * Renders an X-style card preview for the first URL in the text. Fetches OG
 * metadata server-side via /api/og (we don't rely on X to expand the link).
 * Note: the URL still counts as 23 characters (see CharCounter).
 */
export function LinkPreview({ text }: { text: string }) {
  const url = firstUrl(text);
  const [og, setOg] = useState<OgData | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // All setState happens inside this async callback (never synchronously in
    // the effect body) — clears when there's no URL, fetches otherwise.
    const handle = setTimeout(
      () => {
        if (!url) {
          if (!cancelled) setOg(null);
          return;
        }
        fetch(`/api/og?url=${encodeURIComponent(url)}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => {
            if (cancelled) return;
            setOg(data && (data.title || data.image) ? (data as OgData) : null);
          })
          .catch(() => {
            if (!cancelled) setOg(null);
          });
      },
      url ? 500 : 0 // debounce typing; clear immediately when emptied
    );
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [url]);

  if (!url || !og || dismissed === url || (!og.title && !og.image)) return null;

  let host = "";
  try {
    host = new URL(og.url).hostname.replace(/^www\./, "");
  } catch {
    host = "";
  }

  return (
    <div className="relative rounded-xl border border-[var(--color-border-default)] overflow-hidden bg-[var(--color-bg-elevated)]">
      <button
        type="button"
        onClick={() => setDismissed(url)}
        className="absolute top-1.5 right-1.5 z-10 p-1 rounded-full bg-black/50 text-white hover:bg-black/70"
        title="Hide preview"
      >
        <X className="w-3.5 h-3.5" />
      </button>
      {og.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={og.image} alt="" className="w-full h-40 object-cover" />
      )}
      <div className="p-3">
        <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)] mb-1">
          <Link2 className="w-3 h-3" />
          {og.site_name || host}
        </div>
        {og.title && (
          <p className="text-sm font-medium text-[var(--color-text-primary)] line-clamp-1">
            {og.title}
          </p>
        )}
        {og.description && (
          <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2 mt-0.5">
            {og.description}
          </p>
        )}
      </div>
    </div>
  );
}
