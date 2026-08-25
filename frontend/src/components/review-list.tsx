import { useState } from "react";
import { ThumbsUp } from "lucide-react";
import { Rating } from "@/components/ui";
import { cn } from "@/lib/utils";

export type ReviewItem = {
  id: string;
  author: string;
  rating: number;
  date: string;
  title?: string;
  body: string;
  verified?: boolean;
  helpfulCount?: number | undefined;
  votedHelpful?: boolean | undefined;
};

/** Author initials for the square identity block — up to two letters. */
function initialsOf(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]!.toUpperCase())
      .join("") || "?"
  );
}

/**
 * Swiss review list — ruled rows, no card clutter. Each entry opens with a
 * square initials block beside the byline. Helpful voting is opt-in via
 * `onVote`; when absent the list renders exactly as before, so existing
 * consumers are untouched (SF-03).
 */
export function ReviewList({
  reviews,
  className,
  onVote,
}: {
  reviews: ReviewItem[];
  className?: string;
  onVote?: ((reviewId: string, helpful: boolean) => void) | undefined;
}) {
  if (reviews.length === 0) return null;
  return (
    <ul className={cn("space-y-8", className)}>
      {reviews.map((review) => (
        <li key={review.id} className="border-b border-border pb-8 last:border-b-0 last:pb-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Rating rating={review.rating} reviews={0} />
            <time className="tabular text-xs text-muted-foreground">{review.date}</time>
          </div>
          {review.title && (
            <p className="font-display mt-3 text-base font-semibold uppercase tracking-tight">
              {review.title}
            </p>
          )}
          <p className="measure mt-2 text-sm leading-relaxed text-muted-foreground">
            {review.body}
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-2.5 text-xs text-muted-foreground">
              <span
                aria-hidden="true"
                className="grid h-8 w-8 shrink-0 place-items-center border border-border bg-surface-2 text-[11px] font-bold text-foreground"
              >
                {initialsOf(review.author)}
              </span>
              <span>{review.author}</span>
              {review.verified && (
                <span className="pill border-positive/40 text-positive">Verified purchase</span>
              )}
            </p>
            {onVote && (
              <button
                type="button"
                onClick={() => onVote(review.id, !review.votedHelpful)}
                aria-pressed={Boolean(review.votedHelpful)}
                className={cn(
                  "inline-flex min-h-9 cursor-pointer items-center gap-1.5 border px-3 text-xs font-semibold transition-colors",
                  review.votedHelpful
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border text-muted-foreground hover:border-foreground hover:text-foreground",
                )}
              >
                <ThumbsUp
                  className={cn("h-3.5 w-3.5", review.votedHelpful && "fill-accent/30")}
                  aria-hidden="true"
                />
                Helpful
                <span className="tabular">({review.helpfulCount ?? 0})</span>
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Rating distribution bars from the API's `meta.summary` (SF-03). Flat ink/
    red rectangles — the pill meter is gone. */
export function ReviewSummary({
  summary,
  className,
}: {
  summary: {
    rating: number;
    reviewCount: number;
    distribution: Record<"1" | "2" | "3" | "4" | "5", number>;
  };
  className?: string;
}) {
  const rows = (["5", "4", "3", "2", "1"] as const).map((star) => ({
    star,
    count: summary.distribution[star] ?? 0,
  }));
  const max = Math.max(1, ...rows.map((row) => row.count));
  return (
    <div className={cn("panel p-6", className)}>
      <p className="price tabular text-5xl font-bold leading-none">
        {summary.rating.toFixed(1)}
        <span className="text-lg text-muted-foreground"> / 5</span>
      </p>
      <p className="tabular mt-2 text-sm text-muted-foreground">
        {summary.reviewCount} {summary.reviewCount === 1 ? "review" : "reviews"}
      </p>
      <dl className="mt-5 space-y-2">
        {rows.map(({ star, count }) => (
          <div key={star} className="flex items-center gap-3 text-xs">
            <dt className="tabular w-8 shrink-0 text-muted-foreground">{star}★</dt>
            <dd className="flex flex-1 items-center gap-3">
              <span
                role="meter"
                aria-valuenow={count}
                aria-valuemin={0}
                aria-valuemax={summary.reviewCount}
                aria-label={`${star}-star reviews`}
                className="h-1.5 flex-1 overflow-hidden bg-surface-2"
              >
                <span
                  className="block h-full bg-accent"
                  style={{ width: `${Math.round((count / max) * 100)}%` }}
                />
              </span>
              <span className="tabular w-8 shrink-0 text-right text-muted-foreground">{count}</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
