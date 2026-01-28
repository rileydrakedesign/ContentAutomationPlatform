import { Suspense } from "react";
import { LibraryPage } from "@/components/library";

export default function Library() {
  return (
    <Suspense fallback={<div className="text-slate-500">Loading library...</div>}>
      <LibraryPage />
    </Suspense>
  );
}
