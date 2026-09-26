import type { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Lightweight tooltip for icon-only controls. Radix handles hover, focus,
 * and Escape; `asChild` keeps the trigger element (and its semantics) intact.
 * Set `show` to false when the control already has visible text.
 */
export function Hint({ label, side = "top", show = true, children }: { label: string; side?: "top" | "right" | "bottom" | "left"; show?: boolean; children: ReactNode }) {
  if (!show) return <>{children}</>;
  return (
    <Tooltip delayDuration={250}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  );
}
