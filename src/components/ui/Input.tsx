"use client";

import { InputHTMLAttributes, TextareaHTMLAttributes, forwardRef, ReactNode } from "react";

// GALLEY: inputs are typewriter fill-in lines (bottom rule only, transparent,
// rubric caret). Textarea is the boxed variant. See docs/design/galley/galley.css.

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: ReactNode;
  iconPosition?: "left" | "right";
}

const labelClass =
  "block text-xs uppercase tracking-[0.12em] text-[var(--color-text-muted)] mb-1";

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      hint,
      icon,
      iconPosition = "left",
      className = "",
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className={labelClass}>
            {label}
          </label>
        )}
        <div className="relative">
          {icon && iconPosition === "left" && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={`
              w-full py-0.5 text-sm leading-6
              bg-transparent border-0 border-b rounded-none
              text-[var(--color-text-primary)]
              placeholder:text-[var(--color-text-muted)]
              caret-[var(--color-accent-500)]
              transition-colors duration-100 ease-linear
              focus:outline-none
              disabled:opacity-50 disabled:cursor-not-allowed
              ${icon && iconPosition === "left" ? "pl-[2.5ch]" : ""}
              ${icon && iconPosition === "right" ? "pr-[2.5ch]" : ""}
              ${error
                ? "border-b-[var(--color-accent-500)]"
                : "border-b-[var(--color-border-default)] focus:border-b-[var(--color-text-primary)]"
              }
              ${className}
            `}
            {...props}
          />
          {icon && iconPosition === "right" && (
            <div className="absolute right-0 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">
              {icon}
            </div>
          )}
        </div>
        {error && (
          <p className="mt-1 text-xs text-[var(--color-accent-400)]">{error}</p>
        )}
        {hint && !error && (
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">{hint}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, className = "", id, rows = 4, ...props }, ref) => {
    const textareaId = id || label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={textareaId} className={labelClass}>
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          className={`
            w-full px-[1.5ch] py-3 text-sm leading-6
            bg-[var(--color-bg-surface)]
            border rounded-none
            text-[var(--color-text-primary)]
            placeholder:text-[var(--color-text-muted)]
            caret-[var(--color-accent-500)]
            transition-colors duration-100 ease-linear
            resize-y
            focus:outline-none
            disabled:opacity-50 disabled:cursor-not-allowed
            ${error
              ? "border-[var(--color-accent-500)]"
              : "border-[var(--color-border-default)] focus:border-[var(--color-border-strong)]"
            }
            ${className}
          `}
          {...props}
        />
        {error && (
          <p className="mt-1 text-xs text-[var(--color-accent-400)]">{error}</p>
        )}
        {hint && !error && (
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">{hint}</p>
        )}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";
