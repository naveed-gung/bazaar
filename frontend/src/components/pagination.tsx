import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * URL-driven pagination — page state lives in the route's search params, never
 * in component state, so paginated results are shareable. `hrefFor` builds the
 * shareable URL; navigation stays client-side via the router. Swiss cells:
 * square numbers, active page solid ink fill, rectangular arrow buttons.
 */
export function Pagination({
  page,
  totalPages,
  hrefFor,
  className,
}: {
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
  className?: string;
}) {
  const navigate = useNavigate();
  if (totalPages <= 1) return null;

  const pages = new Set<number>([1, totalPages, page - 1, page, page + 1]);
  const ordered = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);

  const items: (number | "gap")[] = [];
  for (const [index, current] of ordered.entries()) {
    const previous = index > 0 ? ordered[index - 1] : undefined;
    if (previous !== undefined && current - previous > 1) items.push("gap");
    items.push(current);
  }

  function go(event: { preventDefault: () => void }, target: number) {
    event.preventDefault();
    void navigate({ href: hrefFor(target) });
  }

  const linkClass =
    "inline-flex h-11 min-w-11 cursor-pointer items-center justify-center border px-3 text-sm font-medium tabular transition-colors";

  return (
    <nav
      aria-label="Pagination"
      className={cn("flex flex-wrap items-center justify-start gap-2", className)}
    >
      {page > 1 ? (
        <a
          href={hrefFor(page - 1)}
          onClick={(event) => go(event, page - 1)}
          aria-label="Previous page"
          className={cn(linkClass, "border-border bg-surface hover:bg-surface-2")}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        </a>
      ) : (
        <span aria-disabled="true" className={cn(linkClass, "border-border opacity-40")}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        </span>
      )}
      {items.map((item, index) =>
        item === "gap" ? (
          <span key={`gap-${index}`} className="px-1 text-muted-foreground" aria-hidden="true">
            …
          </span>
        ) : item === page ? (
          <span
            key={item}
            aria-current="page"
            className={cn(linkClass, "border-signal bg-signal text-signal-foreground")}
          >
            {item}
          </span>
        ) : (
          <Link
            key={item}
            to={hrefFor(item)}
            onClick={(event) => go(event, item)}
            className={cn(linkClass, "border-border bg-surface hover:bg-surface-2")}
          >
            {item}
          </Link>
        ),
      )}
      {page < totalPages ? (
        <a
          href={hrefFor(page + 1)}
          onClick={(event) => go(event, page + 1)}
          aria-label="Next page"
          className={cn(linkClass, "border-border bg-surface hover:bg-surface-2")}
        >
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </a>
      ) : (
        <span aria-disabled="true" className={cn(linkClass, "border-border opacity-40")}>
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </span>
      )}
    </nav>
  );
}
