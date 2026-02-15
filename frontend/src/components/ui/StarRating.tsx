import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  rating: number;
  maxStars?: number;
  size?: "sm" | "md" | "lg";
  showCount?: boolean;
  count?: number;
  className?: string;
}

const sizeMap = {
  sm: "w-3 h-3",
  md: "w-4 h-4",
  lg: "w-5 h-5",
};

export default function StarRating({
  rating,
  maxStars = 5,
  size = "md",
  showCount = false,
  count,
  className,
}: StarRatingProps) {
  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      {Array.from({ length: maxStars }, (_, i) => (
        <Star
          key={i}
          className={cn(
            sizeMap[size],
            i < Math.floor(rating)
              ? "fill-star text-star"
              : i < rating
                ? "fill-star/50 text-star"
                : "fill-star-muted/20 text-star-muted"
          )}
        />
      ))}
      {showCount && count != null && (
        <span className="ml-1 text-sm text-muted-foreground">
          ({count})
        </span>
      )}
    </div>
  );
}
