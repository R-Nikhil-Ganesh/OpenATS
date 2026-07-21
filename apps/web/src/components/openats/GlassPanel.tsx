import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Tint = "neutral" | "gold" | "clay" | "terracotta" | "mint";

interface GlassPanelProps extends HTMLAttributes<HTMLDivElement> {
  tint?: Tint;
  interactive?: boolean;
  sheen?: boolean;
  as?: "div" | "section" | "article" | "header" | "aside";
}

const TINT_CLASS: Record<Tint, string> = {
  neutral: "glass",
  gold: "glass glass-gold",
  clay: "glass glass-clay",
  terracotta: "glass glass-terracotta",
  mint: "glass glass-mint",
};

export const GlassPanel = forwardRef<HTMLDivElement, GlassPanelProps>(
  ({ className, tint = "neutral", interactive, sheen = true, children, ...rest }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          TINT_CLASS[tint],
          sheen && "glass-sheen",
          interactive && "glass-hover cursor-pointer",
          "relative",
          className,
        )}
        {...rest}
      >
        {children}
      </div>
    );
  },
);
GlassPanel.displayName = "GlassPanel";