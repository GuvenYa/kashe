import { cn } from "@/app/lib/cn";
import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          "w-full px-4 py-3 bg-card border border-line rounded-lg text-ink placeholder:text-ink-50 font-body text-base transition-colors",
          "focus:outline-none focus:border-brand-ink focus:ring-2 focus:ring-brand-ink-08",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";
