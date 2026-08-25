import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Dashboard metric card on the flat ruled panel — oversized tabular value
 * under an uppercase micro-label, separated by the panel's 3px ink top rule.
 * Delta is never colour-only: an arrow icon always accompanies the number.
 */
export function StatCard({
  label,
  value,
  delta,
  deltaLabel,
  hint,
  action,
  className,
}: {
  label: string;
  value: string;
  /** Signed percentage or absolute change; sign drives the arrow. */
  delta?: number;
  deltaLabel?: string;
  hint?: string;
  action?: ReactNode;
  className?: string;
}) {
  const rising = delta !== undefined && delta >= 0;
  return (
    <div className={cn("panel", className)}>
      <div className="flex h-full flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[11px] font-bold tracking-[0.14em] text-muted-foreground uppercase">
            {label}
          </p>
          {action}
        </div>
        <p className="price font-display mt-3 text-4xl leading-none tracking-tight lg:text-5xl">
          {value}
        </p>
        <div className="mt-3 flex items-center gap-2 text-xs">
          {delta !== undefined && (
            <span
              className={cn(
                "inline-flex items-center gap-1 font-semibold",
                rising ? "text-positive" : "text-destructive",
              )}
            >
              {rising ? (
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <ArrowDownRight className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {rising ? "+" : ""}
              {delta}
              {deltaLabel ? `% ${deltaLabel}` : "%"}
            </span>
          )}
          {hint && <span className="text-muted-foreground">{hint}</span>}
        </div>
      </div>
    </div>
  );
}
