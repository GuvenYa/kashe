import { cn } from "@/app/lib/cn";
import { ButtonHTMLAttributes, forwardRef } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-ink text-white hover:bg-brand-ink-deep active:bg-brand-ink-deep",
  secondary:
    "bg-card border border-line text-ink hover:border-brand-ink hover:text-brand-ink",
  ghost: "bg-transparent text-brand-ink hover:bg-brand-ink-08",
  destructive: "bg-danger text-white hover:opacity-90",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-4 py-2 text-sm",
  md: "px-5 py-2.5 text-sm",
  lg: "px-7 py-3.5 text-base",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-lg font-display font-semibold transition-all duration-200 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-brand-ink focus-visible:outline-offset-2",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
