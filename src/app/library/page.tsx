import { Suspense } from "react";
import { LibraryPage } from "@/components/library";

export default function Library() {
  return (
    <Suspense fallback={<div className="text-[var(--color-text-muted)]">Loading library...</div>}>
      <LibraryPage />
    </Suspense>
  );
}
