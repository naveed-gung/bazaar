import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export type BreadcrumbItem = { label: string; to?: string };

/**
 * Swiss breadcrumb trail — "/" separators, muted links that gain a red
 * underline on hover; the last crumb is the current page in full ink.
 */
export function Breadcrumbs({ items, className }: { items: BreadcrumbItem[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={cn("text-xs", className)}>
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 uppercase tracking-[0.08em]">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-2">
              {item.to && !last ? (
                <Link
                  to={item.to}
                  className="text-muted-foreground decoration-2 underline-offset-4 transition-colors hover:text-accent hover:underline"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={last ? "page" : undefined}
                  className={last ? "font-semibold text-foreground" : "text-muted-foreground"}
                >
                  {item.label}
                </span>
              )}
              {!last && (
                <span aria-hidden="true" className="text-muted-foreground/60">
                  /
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
