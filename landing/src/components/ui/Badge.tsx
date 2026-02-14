import { ReactNode } from "react";

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

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] border-[var(--color-border-default)]",
  primary: "bg-[var(--color-primary-500)]/10 text-[var(--color-primary-400)] border-[var(--color-primary-500)]/20",
  secondary: "bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)] border-[var(--color-border-strong)]",
  success: "bg-[var(--color-success-500)]/10 text-[var(--color-success-400)] border-[var(--color-success-500)]/20",
  warning: "bg-[var(--color-warning-500)]/10 text-[var(--color-warning-400)] border-[var(--color-warning-500)]/20",
  danger: "bg-[var(--color-danger-500)]/10 text-[var(--color-danger-400)] border-[var(--color-danger-500)]/20",
  accent: "bg-[var(--color-accent-500)]/10 text-[var(--color-accent-400)] border-[var(--color-accent-500)]/20",
  outline: "bg-transparent text-[var(--color-text-secondary)] border-[var(--color-border-default)]",
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: "px-1.5 py-0.5 text-xs",
  md: "px-2.5 py-1 text-sm",
};

const dotColors: Record<BadgeVariant, string> = {
  default: "bg-[var(--color-text-muted)]",
  primary: "bg-[var(--color-primary-400)]",
  secondary: "bg-[var(--color-text-secondary)]",
  success: "bg-[var(--color-success-400)]",
  warning: "bg-[var(--color-warning-400)]",
  danger: "bg-[var(--color-danger-400)]",
  accent: "bg-[var(--color-accent-400)]",
  outline: "bg-[var(--color-text-secondary)]",
};

export function Badge({
  children,
  variant = "default",
  size = "sm",
  dot = false,
  className = "",
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]}`} />
      )}
      {children}
    </span>
  );
}
