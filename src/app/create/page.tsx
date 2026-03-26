import { Suspense } from "react";
import { CreatePage } from "@/components/create";

export default function Create() {
  return (
    <Suspense fallback={<div className="text-[var(--color-text-muted)]">Loading...</div>}>
      <CreatePage />
    </Suspense>
  );
}
