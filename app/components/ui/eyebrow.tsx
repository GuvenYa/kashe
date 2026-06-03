import { cn } from "@/app/lib/cn";
import { HTMLAttributes, forwardRef } from "react";

type EyebrowVariant = "pill" | "inline";

interface EyebrowProps extends HTMLAttributes<HTMLDivElement> {
  variant?: EyebrowVariant;
}

export const Eyebrow = forwardRef<HTMLDivElement, EyebrowProps>(
  ({ className, variant = "inline", children, ...props }, ref) => {
    if (variant === "pill") {
      return (
        <div
          ref={ref}
          className={cn(
            "inline-flex items-center gap-2 px-3 py-1.5 border border-terracotta bg-terracotta-08 rounded-full font-mono text-[10px] uppercase tracking-[0.22em] text-terracotta",
            className
          )}
          {...props}
        >
          <span>✦</span>
          {children}
          <span>✦</span>
        </div>
      );
    }

    return (
      <div
        ref={ref}
        className={cn(
          "flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.22em] text-terracotta",
          className
        )}
        {...props}
      >
        <span className="w-6 h-px bg-terracotta"></span>
        {children}
      </div>
    );
  }
);

Eyebrow.displayName = "Eyebrow";