import Link from "next/link";
import { Lock, Zap, ArrowRight } from "lucide-react";

interface UpgradePromptProps {
  feature: string;
  variant?: "inline" | "overlay" | "badge";
  className?: string;
}

export function UpgradePrompt({
  feature,
  variant = "inline",
  className = "",
}: UpgradePromptProps) {
  if (variant === "badge") {
    return (
      <Link
        href="/pricing"
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-primary-500)]/10 text-[var(--color-primary-400)] border border-[var(--color-primary-500)]/20 hover:bg-[var(--color-primary-500)]/20 transition ${className}`}
      >
        <Lock className="w-3 h-3" />
        Pro
      </Link>
    );
  }

  if (variant === "overlay") {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-4 py-10 px-6 text-center ${className}`}
      >
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[var(--color-primary-500)]/15 to-[var(--color-accent-500)]/15 border border-[var(--color-primary-500)]/20 flex items-center justify-center">
          <Zap className="w-7 h-7 text-[var(--color-primary-400)]" />
        </div>
        <div>
          <p className="text-base font-semibold text-[var(--color-text-primary)]">
            Unlock {feature}
          </p>
          <p className="mt-1.5 text-sm text-[var(--color-text-muted)] max-w-xs mx-auto">
            Upgrade to Pro for unlimited AI generations, {feature.toLowerCase()}, and more
          </p>
        </div>
        <Link
          href="/pricing"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-gradient-to-r from-[var(--color-primary-500)] to-[var(--color-primary-600)] hover:from-[var(--color-primary-400)] hover:to-[var(--color-primary-500)] text-white transition-all shadow-sm"
        >
          View Plans
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
        <p className="text-[11px] text-[var(--color-text-muted)]">
          Starting at $19/mo
        </p>
      </div>
    );
  }

  // inline variant (default)
  return (
    <div
      className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg bg-gradient-to-r from-[var(--color-primary-500)]/5 to-[var(--color-accent-500)]/5 border border-[var(--color-primary-500)]/20 ${className}`}
    >
      <div className="w-6 h-6 rounded-md bg-[var(--color-primary-500)]/10 flex items-center justify-center shrink-0">
        <Lock className="w-3 h-3 text-[var(--color-primary-400)]" />
      </div>
      <span className="text-xs text-[var(--color-text-secondary)] flex-1">
        <span className="font-medium text-[var(--color-text-primary)]">{feature}</span> requires a Pro plan
      </span>
      <Link
        href="/pricing"
        className="text-xs font-semibold text-[var(--color-primary-400)] hover:text-[var(--color-primary-300)] transition shrink-0"
      >
        Upgrade
      </Link>
    </div>
  );
}
