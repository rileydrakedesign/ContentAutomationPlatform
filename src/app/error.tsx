"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-10 max-w-md w-full">
        <div className="mb-4 text-5xl">!</div>
        <h2 className="mb-2 text-xl font-semibold text-[var(--color-text-primary)]">
          Something went wrong
        </h2>
        <p className="mb-6 text-sm text-[var(--color-text-secondary)]">
          An unexpected error occurred. Please try again or contact support if
          the problem persists.
        </p>
        <Button variant="primary" onClick={reset}>
          Try again
        </Button>
      </div>
    </div>
  );
}
