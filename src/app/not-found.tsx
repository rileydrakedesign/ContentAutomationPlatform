import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-10 max-w-md w-full">
        <div className="mb-2 text-6xl font-bold text-[var(--color-primary-500)]">
          404
        </div>
        <h2 className="mb-2 text-xl font-semibold text-[var(--color-text-primary)]">
          Page not found
        </h2>
        <p className="mb-6 text-sm text-[var(--color-text-secondary)]">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link href="/">
          <Button variant="primary">Back to dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
