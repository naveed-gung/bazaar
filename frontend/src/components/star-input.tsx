import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Accessible star rating input (radiogroup pattern). Arrow keys move the
 * selection; Home/End jump to the ends. The current value is carried by
 * aria-checked on each radio, so screen readers announce it natively. Stars
 * stay lucide glyphs in monochrome ink; focus is the global square red ring.
 */
export function StarInput({
  value,
  onChange,
  label = "Your rating",
  className,
}: {
  value: number;
  onChange: (next: number) => void;
  label?: string;
  className?: string;
}) {
  const [hovered, setHovered] = useState(0);
  const shown = hovered || value;

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      event.preventDefault();
      onChange(Math.min(5, value + 1));
    } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      event.preventDefault();
      onChange(Math.max(1, value - 1));
    } else if (event.key === "Home") {
      event.preventDefault();
      onChange(1);
    } else if (event.key === "End") {
      event.preventDefault();
      onChange(5);
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      onMouseLeave={() => setHovered(0)}
      className={cn("flex items-center gap-1", className)}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} ${star === 1 ? "star" : "stars"}`}
          onClick={() => onChange(star)}
          onMouseEnter={() => setHovered(star)}
          className="cursor-pointer p-0.5 transition-colors focus-visible:outline-2 focus-visible:outline-ring"
        >
          <Star
            className={cn(
              "h-6 w-6 transition-colors",
              star <= shown ? "fill-glow text-glow" : "fill-border text-border",
            )}
            aria-hidden="true"
          />
        </button>
      ))}
    </div>
  );
}
