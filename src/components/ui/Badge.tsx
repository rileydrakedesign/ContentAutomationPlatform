import { ReactNode } from "react";

type BadgeVariant =
  | "default"
  | "primary"
  | "secondary"
  | "success"
  | "warning"
  | "danger"
  | "purple"
  | "outline";

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-slate-800 text-slate-300 border-slate-700",
  primary: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  secondary: "bg-slate-700 text-slate-300 border-slate-600",
  success: "bg-teal-500/10 text-teal-400 border-teal-500/20",
  warning: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  danger: "bg-red-500/10 text-red-400 border-red-500/20",
  purple: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  outline: "bg-transparent text-slate-400 border-slate-700",
};

export function Badge({ children, variant = "default", className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs rounded border ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

// Predefined status badges
export function StatusBadge({ status }: { status: string }) {
  const statusVariants: Record<string, BadgeVariant> = {
    PENDING: "warning",
    GENERATED: "primary",
    APPROVED: "success",
    REJECTED: "danger",
    inbox: "warning",
    triaged: "success",
  };

  const labels: Record<string, string> = {
    PENDING: "Pending",
    GENERATED: "Generated",
    APPROVED: "Approved",
    REJECTED: "Rejected",
    inbox: "Inbox",
    triaged: "Triaged",
  };

  return (
    <Badge variant={statusVariants[status] || "default"}>
      {labels[status] || status}
    </Badge>
  );
}

// Type badges for content
export function TypeBadge({ type }: { type: string }) {
  const typeVariants: Record<string, BadgeVariant> = {
    X_POST: "default",
    X_THREAD: "default",
    REEL_SCRIPT: "default",
    VOICE_MEMO: "purple",
    NEWS: "success",
    INSPIRATION: "purple",
    my_post: "primary",
    inspiration: "purple",
  };

  const labels: Record<string, string> = {
    X_POST: "X Post",
    X_THREAD: "X Thread",
    REEL_SCRIPT: "Reel Script",
    VOICE_MEMO: "Voice Memo",
    NEWS: "News",
    INSPIRATION: "Inspiration",
    my_post: "My Post",
    inspiration: "Inspiration",
  };

  return (
    <Badge variant={typeVariants[type] || "default"}>
      {labels[type] || type}
    </Badge>
  );
}
