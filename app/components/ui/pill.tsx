import { cn } from "@/app/lib/cn";
import { HTMLAttributes, forwardRef } from "react";

type PillVariant = "default" | "active" | "featured";

interface PillProps extends HTMLAttributes<HTMLDivElement> {
  variant?: PillVariant;
}

const variantClasses: Record<PillVariant, string> = {
  default: "bg-transparent border border-line text-ink-72",
  active: "bg-ink text-paper border border-ink",
  featured: "bg-brand-ink text-paper border border-brand-ink",
};

export const Pill = forwardRef<HTMLDivElement, PillProps>(
  ({ className, variant = "default", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono text-xs uppercase tracking-[0.14em] whitespace-nowrap transition-colors",
          variantClasses[variant],
          className
        )}
        {...props}
      />
    );
  }
);

Pill.displayName = "Pill";