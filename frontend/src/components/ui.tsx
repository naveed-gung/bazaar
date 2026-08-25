import type { ReactNode } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/** Rating glyphs. Half steps round down so four-and-a-half never reads as five. */
export function Stars({ rating, className }: { rating: number; className?: string }) {
  return (
    <span className={cn("flex items-center gap-0.5", className)} aria-hidden="true">
      {[0, 1, 2, 3, 4].map((index) => (
        <Star
          key={index}
          className={
            index < Math.floor(rating)
              ? "h-3.5 w-3.5 fill-glow text-glow"
              : "h-3.5 w-3.5 fill-border text-border"
          }
        />
      ))}
    </span>
  );
}

export function Rating({
  rating,
  reviews,
  className,
}: {
  rating: number;
  reviews: number;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2 text-sm", className)}>
      <Stars rating={rating} />
      <span className="tabular font-semibold">{rating.toFixed(1)}</span>
      <span className="text-muted-foreground">
        ({reviews.toLocaleString("en-US")} {reviews === 1 ? "review" : "reviews"})
      </span>
    </div>
  );
}

type PillTone = "neutral" | "signal" | "deal" | "positive" | "danger";

const pillTone: Record<PillTone, string> = {
  neutral: "border-border bg-surface-2 text-muted-foreground",
  signal: "border-signal/30 bg-signal/10 text-signal",
  deal: "border-deal/30 bg-deal/10 text-deal",
  positive: "border-positive/30 bg-positive/10 text-positive",
  danger: "border-destructive/30 bg-destructive/10 text-destructive",
};

export function Pill({
  tone = "neutral",
  className,
  children,
}: {
  tone?: PillTone;
  className?: string;
  children: ReactNode;
}) {
  return <span className={cn("pill", pillTone[tone], className)}>{children}</span>;
}

/** Coloured dot + text used for availability so meaning is never colour-only. */
export function AvailabilityTag({
  availability,
  className,
}: {
  availability: "in_stock" | "low_stock" | "out_of_stock";
  className?: string;
}) {
  const copy = {
    in_stock: { label: "In stock", dot: "bg-positive", text: "text-positive" },
    low_stock: { label: "Only a few left", dot: "bg-deal", text: "text-deal" },
    out_of_stock: { label: "Out of stock", dot: "bg-destructive", text: "text-destructive" },
  }[availability];
  return (
    <span className={cn("flex items-center gap-2 text-xs font-semibold", copy.text, className)}>
      <span className={cn("h-1.5 w-1.5 shrink-0", copy.dot)} aria-hidden="true" />
      {copy.label}
    </span>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  copy,
  actions,
  className,
  id,
  size = "md",
}: {
  eyebrow?: string;
  title: string;
  copy?: string;
  actions?: ReactNode;
  className?: string;
  id?: string;
  /** "lg" keeps the landing page's display scale; "md" suits inner page sections. */
  size?: "md" | "lg";
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between sm:gap-10",
        className,
      )}
    >
      <div className="max-w-2xl">
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2
          {...(id ? { id } : {})}
          className={cn(
            "font-display mt-3 font-semibold tracking-tight",
            size === "lg" ? "text-3xl lg:text-5xl" : "text-2xl lg:text-3xl",
          )}
        >
          {title}
        </h2>
        {copy && (
          <p className="measure mt-4 text-sm leading-relaxed text-muted-foreground">{copy}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  copy,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  copy?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("panel flex flex-col items-center px-6 py-16 text-center", className)}>
      {icon && (
        <span className="grid h-14 w-14 place-items-center border border-border bg-background text-muted-foreground">
          {icon}
        </span>
      )}
      <p className="mt-6 text-lg font-bold tracking-tight">{title}</p>
      {copy && (
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{copy}</p>
      )}
      {action && <div className="mt-8 flex flex-wrap justify-center gap-3">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden="true" />;
}

export function ProductCardSkeleton() {
  return (
    <div className="flex flex-col">
      <Skeleton className="aspect-square w-full" />
      <Skeleton className="mt-5 h-3 w-20" />
      <Skeleton className="mt-3 h-4 w-4/5" />
      <Skeleton className="mt-3 h-5 w-24" />
      <Skeleton className="mt-3 h-3 w-28" />
    </div>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-4 lg:gap-10"
      aria-busy="true"
      aria-live="polite"
    >
      {Array.from({ length: count }).map((_, index) => (
        <ProductCardSkeleton key={index} />
      ))}
    </div>
  );
}
