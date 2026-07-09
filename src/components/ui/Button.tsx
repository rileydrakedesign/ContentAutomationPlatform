"use client";

import { ReactNode, ButtonHTMLAttributes, forwardRef } from "react";

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

// GALLEY: letterpress block buttons — paper on ink, uppercase, zero radius,
// depth from rules not shadows. See docs/design/galley/galley.css (.btn).
const variantStyles: Record<ButtonVariant, string> = {
  primary: `
    bg-[var(--color-primary-500)] text-[var(--color-text-inverse)]
    hover:bg-[var(--color-primary-400)]
    border-transparent
  `,
  secondary: `
    bg-transparent text-[var(--color-text-primary)]
    hover:bg-[var(--color-bg-hover)]
    border-[var(--color-border-strong)]
  `,
  ghost: `
    bg-transparent text-[var(--color-text-secondary)]
    hover:text-[var(--color-text-primary)] hover:underline underline-offset-4
    border-transparent
  `,
  danger: `
    bg-transparent text-[var(--color-accent-400)] border-[var(--color-accent-600)]
    hover:bg-[var(--color-accent-500)] hover:text-[var(--color-text-inverse)] hover:border-[var(--color-accent-500)]
  `,
  success: `
    bg-transparent text-[var(--color-success-500)] border-[var(--color-success-600)]
    hover:bg-[var(--color-success-500)] hover:text-[var(--color-text-inverse)] hover:border-[var(--color-success-500)]
  `,
  outline: `
    bg-transparent text-[var(--color-text-primary)]
    hover:bg-[var(--color-bg-hover)]
    border-[var(--color-border-strong)]
  `,
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-[1.5ch] py-[5px] text-[11px] gap-[1ch]",
  md: "px-[2ch] py-[7px] text-xs gap-[1ch]",
  lg: "px-[3ch] py-[10px] text-sm gap-[1.5ch]",
  icon: "h-8 w-8 p-0",
};

// Glows are dead in GALLEY — the `glow` prop renders identical to primary.
const glowStyles: Record<ButtonVariant, string> = {
  primary: "",
  secondary: "",
  ghost: "",
  danger: "",
  success: "",
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
          inline-flex items-center justify-center whitespace-nowrap leading-6
          font-bold uppercase tracking-[0.08em] rounded-none border
          transition-colors duration-100 ease-linear
          cursor-pointer
          active:translate-y-px
          focus-visible:outline-1 focus-visible:outline-[var(--color-border-focus)] focus-visible:outline-offset-2
          disabled:opacity-50 disabled:cursor-not-allowed disabled:active:translate-y-0
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
            {size !== "icon" && children}
            <span
              aria-hidden
              className="inline-block w-[1ch] animate-[blink_1s_steps(1)_infinite]"
            >
              ▌
            </span>
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

// GALLEY: a "type sort" — 32×32 bordered square, transparent, hover fills.
export function IconButton({ icon, variant = "secondary", ...props }: IconButtonProps) {
  return (
    <Button variant={variant} size="icon" {...props}>
      {icon}
    </Button>
  );
}
