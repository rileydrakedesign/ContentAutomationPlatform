"use client";

import { ReactNode, ButtonHTMLAttributes, forwardRef } from "react";
import { Loader2 } from "lucide-react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success" | "outline";
type ButtonSize = "sm" | "md" | "lg" | "icon";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  iconPosition?: "left" | "right";
  fullWidth?: boolean;
  glow?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: `
    bg-[var(--color-primary-500)] text-white
    hover:bg-[var(--color-primary-600)]
    active:bg-[var(--color-primary-700)]
    border-transparent
  `,
  secondary: `
    bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)]
    hover:bg-[var(--color-bg-hover)]
    active:bg-[var(--color-bg-surface)]
    border-[var(--color-border-default)]
  `,
  ghost: `
    bg-transparent text-[var(--color-text-secondary)]
    hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)]
    active:bg-[var(--color-bg-surface)]
    border-transparent
  `,
  danger: `
    bg-[var(--color-danger-500)] text-white
    hover:bg-[var(--color-danger-600)]
    active:bg-[var(--color-danger-600)]
    border-transparent
  `,
  success: `
    bg-[var(--color-success-500)] text-white
    hover:bg-[var(--color-success-600)]
    active:bg-[var(--color-success-600)]
    border-transparent
  `,
  outline: `
    bg-transparent text-[var(--color-primary-400)]
    hover:bg-[var(--color-primary-500)]/10
    active:bg-[var(--color-primary-500)]/20
    border-[var(--color-primary-500)]
  `,
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2.5",
  icon: "h-10 w-10 p-0",
};

const glowStyles: Record<ButtonVariant, string> = {
  primary: "shadow-[var(--shadow-glow-primary)]",
  secondary: "",
  ghost: "",
  danger: "shadow-[0_0_20px_rgba(239,68,68,0.3)]",
  success: "shadow-[var(--shadow-glow-success)]",
  outline: "",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = "primary",
      size = "md",
      loading = false,
      icon,
      iconPosition = "left",
      fullWidth = false,
      glow = false,
      disabled,
      className = "",
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={`
          inline-flex items-center justify-center
          font-medium rounded-lg border
          transition-all duration-200
          cursor-pointer
          active:scale-[0.98]
          disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${glow ? glowStyles[variant] : ""}
          ${fullWidth ? "w-full" : ""}
          ${className}
        `}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {size !== "icon" && <span>Loading...</span>}
          </>
        ) : (
          <>
            {icon && iconPosition === "left" && (
              <span className="w-4 h-4 flex items-center justify-center">{icon}</span>
            )}
            {size !== "icon" && children}
            {size === "icon" && (
              <span className="w-5 h-5 flex items-center justify-center">{children}</span>
            )}
            {icon && iconPosition === "right" && (
              <span className="w-4 h-4 flex items-center justify-center">{icon}</span>
            )}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";

// Icon-only button shorthand
interface IconButtonProps extends Omit<ButtonProps, "children" | "size"> {
  icon: ReactNode;
  "aria-label": string;
}

export function IconButton({ icon, variant = "ghost", ...props }: IconButtonProps) {
  return (
    <Button variant={variant} size="icon" {...props}>
      {icon}
    </Button>
  );
}
