"use client"

import { cn } from "@/lib/utils"
import { type Ref, useId } from "react"

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string | undefined
  error?: string | undefined
  hint?: string | undefined
  ref?: Ref<HTMLInputElement>
}

// React 19: `ref` is a normal prop, so no forwardRef wrapper needed.
export function Input({ label, error, hint, className, id, ref, ...props }: InputProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const errorId = `${inputId}-error`
  const hintId = `${inputId}-hint`

  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <label htmlFor={inputId} className="text-sm font-medium tracking-wide text-ink/80">
          {label}
        </label>
      ) : null}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : hint ? hintId : undefined}
        className={cn(
          "h-12 w-full rounded-xl border border-accent-light/40 bg-white px-4 text-ink placeholder:text-ink/30 transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30",
          error && "border-red-400 focus:border-red-400 focus:ring-red-300/40",
          className,
        )}
        {...props}
      />
      {error ? (
        <p id={errorId} className="text-sm text-red-500">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-sm text-ink/50">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
