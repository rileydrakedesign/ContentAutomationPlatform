import { ReactNode } from "react";

// GALLEY: badges are typographic, not pills. Base Badge = bracketed uppercase
// text; StatusBadge = a bordered chip with a square dot; TypeBadge = a "type
// sort" (single glyph in a metal-type square). See docs/design/galley/galley.css.

type BadgeVariant =
  | "default"
  | "primary"
  | "secondary"
  | "success"
  | "warning"
  | "danger"
  | "accent"
  | "outline";

type BadgeSize = "sm" | "md";

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  className?: string;
}

// Variant = text color (no background, no border).
const variantText: Record<BadgeVariant, string> = {
  default: "text-[var(--color-text-secondary)]",
  primary: "text-[var(--color-text-primary)] font-bold",
  secondary: "text-[var(--color-text-secondary)]",
  success: "text-[var(--color-success-500)]",
  warning: "text-[var(--color-warning-500)]",
  danger: "text-[var(--color-accent-400)]",
  accent: "text-[var(--color-accent-400)]",
  outline: "text-[var(--color-text-secondary)]",
};

const dotColors: Record<BadgeVariant, string> = {
  default: "bg-[var(--color-text-muted)]",
  primary: "bg-[var(--color-text-primary)]",
  secondary: "bg-[var(--color-text-secondary)]",
  success: "bg-[var(--color-success-500)]",
  warning: "bg-[var(--color-warning-500)]",
  danger: "bg-[var(--color-accent-500)]",
  accent: "bg-[var(--color-accent-500)]",
  outline: "bg-[var(--color-text-secondary)]",
};

export function Badge({
  children,
  variant = "default",
  size = "sm",
  dot = false,
  className = "",
}: BadgeProps) {
  const text = size === "md" ? "text-sm" : "text-xs";
  return (
    <span
      className={`inline-flex items-center gap-[1ch] ${text} uppercase tracking-[0.08em] leading-6 whitespace-nowrap ${variantText[variant]} ${className}`}
    >
      {dot && <span className={`inline-block w-[7px] h-[7px] ${dotColors[variant]}`} />}
      <span className="text-[var(--color-text-muted)]">[</span>
      {children}
      <span className="text-[var(--color-text-muted)]">]</span>
    </span>
  );
}

// GALLEY: a bordered square chip — 7px square dot + uppercase label.
export function StatusBadge({ status }: { status: string }) {
  const statusDot: Record<string, string> = {
    DRAFT: "bg-[var(--color-warning-500)]",
    POSTED: "bg-[var(--color-success-500)]",
    SCHEDULED: "bg-[var(--color-warning-500)]",
    PENDING: "bg-[var(--color-warning-500)]",
    GENERATED: "bg-[var(--color-text-muted)]",
    APPROVED: "bg-[var(--color-success-500)]",
    REJECTED: "bg-[var(--color-accent-500)]",
    inbox: "bg-[var(--color-warning-500)]",
    triaged: "bg-[var(--color-success-500)]",
    active: "bg-[var(--color-success-500)]",
    paused: "bg-[var(--color-warning-500)]",
    draft: "bg-[var(--color-text-muted)]",
  };

  const labels: Record<string, string> = {
    DRAFT: "Draft",
    POSTED: "Posted",
    SCHEDULED: "Scheduled",
    PENDING: "Pending",
    GENERATED: "Generated",
    APPROVED: "Approved",
    REJECTED: "Rejected",
    inbox: "Inbox",
    triaged: "Triaged",
    active: "Active",
    paused: "Paused",
    draft: "Draft",
  };

  return (
    <span className="inline-flex items-center gap-[1ch] border border-[var(--color-border-default)] px-[1.5ch] text-xs uppercase tracking-[0.1em] leading-6 text-[var(--color-text-secondary)] whitespace-nowrap">
      <span className={`inline-block w-[7px] h-[7px] ${statusDot[status] || "bg-[var(--color-text-muted)]"}`} />
      {labels[status] || status}
    </span>
  );
}

// GALLEY: a "type sort" — a single glyph in a 28px metal-type square.
export function TypeBadge({ type }: { type: string }) {
  const glyphs: Record<string, string> = {
    X_POST: "T",
    X_THREAD: "≡",
    NEWS: "N",
    INSPIRATION: "✦",
    my_post: "◆",
    inspiration: "✦",
  };

  const labels: Record<string, string> = {
    X_POST: "X Post",
    X_THREAD: "X Thread",
    NEWS: "News",
    INSPIRATION: "Inspiration",
    my_post: "My Post",
    inspiration: "Inspiration",
  };

  return (
    <span
      title={labels[type] || type}
      className="inline-flex items-center justify-center w-7 h-7 border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] font-bold text-xs shadow-[inset_0_-2px_0_rgba(0,0,0,0.5)]"
    >
      {glyphs[type] || (labels[type] || type).charAt(0)}
    </span>
  );
}
