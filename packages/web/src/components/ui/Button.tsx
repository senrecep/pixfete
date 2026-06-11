"use client"

import { cn } from "@/lib/utils"
import type { Ref } from "react"
import { Spinner } from "./Spinner"

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger"
type ButtonSize = "sm" | "md" | "lg"

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  ref?: Ref<HTMLButtonElement>
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-white hover:bg-accent-dark shadow-sm shadow-accent/30 disabled:bg-accent/50",
  secondary:
    "bg-accent-soft text-accent-dark hover:bg-accent-light/40 border border-accent-light/50",
  ghost: "bg-transparent text-accent-dark hover:bg-accent-soft",
  danger: "bg-red-500 text-white hover:bg-red-600 shadow-sm shadow-red-500/30",
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-11 px-4 text-sm sm:h-9",
  md: "h-11 px-6 text-sm",
  lg: "h-14 px-8 text-base",
}

// React 19: `ref` is a normal prop, so no forwardRef wrapper needed.
export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className,
  children,
  disabled,
  type,
  ref,
  ...props
}: ButtonProps) {
  return (
    <button
      ref={ref}
      // Default to "button" so a Button inside a <form> never submits by accident.
      type={type ?? "button"}
      disabled={disabled ?? loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-medium tracking-wide transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {loading ? <Spinner className="h-4 w-4" /> : null}
      {children}
    </button>
  )
}
