"use client";

import { InspirationPostsTab } from "@/components/voice/InspirationPostsTab";

export function LibraryPage() {
  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-heading text-2xl font-semibold text-[var(--color-text-primary)]">
          Library
        </h1>
        <p className="text-[var(--color-text-secondary)] text-sm mt-1">
          Your saved inspiration and your own posts/replies (from analytics)
        </p>
      </div>

      <InspirationPostsTab />
    </div>
  );
}
