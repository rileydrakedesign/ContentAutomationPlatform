import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  selected?: boolean;
  glass?: boolean;
  glow?: boolean;
  onClick?: () => void;
}

export function Card({
  children,
  className = "",
  hover = false,
  selected = false,
  glass = false,
  glow = false,
  onClick,
}: CardProps) {
  // GALLEY: flat — 1px hairline rule, ink-1 surface, zero radius, no shadow.
  // Depth is border/background shifts, never elevation. See galley.css (.card).
  const baseClasses = glass
    ? "backdrop-blur-xl rounded-none"
    : "bg-[var(--color-bg-surface)] rounded-none";

  const backgroundClass = glass
    ? "bg-[var(--color-glass-medium)]"
    : "";

  const borderClass = selected
    ? glow
      ? "border border-[var(--color-border-focus)]"
      : "border border-[var(--color-border-strong)]"
    : "border border-[var(--color-border-default)]";

  const shadowClass = "";

  const hoverClass = hover
    ? "hover:border-[var(--color-border-strong)] hover:bg-[var(--color-bg-elevated)] transition-colors duration-100 ease-linear cursor-pointer"
    : "";

  const clickableClass = onClick && !hover ? "cursor-pointer" : "";

  return (
    <div
      className={`${baseClasses} ${backgroundClass} ${borderClass} ${shadowClass} ${hoverClass} ${clickableClass} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}

export function CardHeader({ children, className = "", action }: CardHeaderProps) {
  return (
    <div className={`flex items-center justify-between p-4 pb-0 ${className}`}>
      <div>{children}</div>
      {action && <div>{action}</div>}
    </div>
  );
}

interface CardTitleProps {
  children: ReactNode;
  className?: string;
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
}

export function CardTitle({ children, className = "", as: Tag = "h3" }: CardTitleProps) {
  return (
    <Tag className={`text-heading text-base font-semibold text-[var(--color-text-primary)] ${className}`}>
      {children}
    </Tag>
  );
}

interface CardDescriptionProps {
  children: ReactNode;
  className?: string;
}

export function CardDescription({ children, className = "" }: CardDescriptionProps) {
  return (
    <p className={`text-sm text-[var(--color-text-secondary)] mt-1 ${className}`}>
      {children}
    </p>
  );
}

interface CardContentProps {
  children: ReactNode;
  className?: string;
}

export function CardContent({ children, className = "" }: CardContentProps) {
  return <div className={`p-4 ${className}`}>{children}</div>;
}

interface CardFooterProps {
  children: ReactNode;
  className?: string;
}

export function CardFooter({ children, className = "" }: CardFooterProps) {
  return (
    <div
      className={`p-4 border-t border-dotted border-[var(--color-border-default)] flex items-center gap-2 ${className}`}
    >
      {children}
    </div>
  );
}
