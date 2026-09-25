import type { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Lightweight tooltip for icon-only controls. Radix handles hover, focus,
 * and Escape; `asChild` keeps the trigger element (and its semantics) intact.
 */
export function Hint({ label, side = "top", children }: { label: string; side?: "top" | "right" | "bottom" | "left"; children: ReactNode }) {
  return (
    <Tooltip delayDuration={250}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  );
}
