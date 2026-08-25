import { useMemo } from "react";
import { cn } from "@/lib/utils";

export type VariantOption = { name: string; values: string[] };
export type VariantChoice = {
  id: string;
  optionValues: Record<string, string>;
  availability: number;
  price: number;
};

/**
 * Option matrix for a product. Unavailable combinations are DISABLED, never
 * hidden; the resulting price/stock of the matched variant is announced via
 * the polite live region at the bottom. Swiss: square option cells, selected
 * = solid ink fill.
 */
export function VariantPicker({
  options,
  variants,
  value,
  onChange,
  formatPrice,
  className,
}: {
  options: VariantOption[];
  variants: VariantChoice[];
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  formatPrice: (amount: number) => string;
  className?: string;
}) {
  /** A candidate value is disabled when no in-stock variant offers it given
      the currently-selected values of the OTHER options. */
  const disabled = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const option of options) map.set(option.name, new Set());
    for (const variant of variants) {
      if (variant.availability <= 0) continue;
      for (const option of options) {
        const available = map.get(option.name);
        if (!available) continue;
        const othersMatch = options.every(
          (other) =>
            other.name === option.name ||
            !value[other.name] ||
            variant.optionValues[other.name] === value[other.name],
        );
        const own = variant.optionValues[option.name];
        if (othersMatch && own) available.add(own);
      }
    }
    return map;
  }, [options, variants, value]);

  const matched = useMemo(
    () =>
      variants.find((variant) =>
        options.every((option) => {
          const chosen = value[option.name];
          return !chosen || variant.optionValues[option.name] === chosen;
        }),
      ) ?? null,
    [variants, options, value],
  );

  return (
    <div className={cn("space-y-5", className)}>
      {options.map((option) => (
        <fieldset key={option.name}>
          <legend className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            {option.name}
            {value[option.name] && (
              <span className="ml-2 text-foreground normal-case">{value[option.name]}</span>
            )}
          </legend>
          <div role="radiogroup" aria-label={option.name} className="mt-3 flex flex-wrap gap-2">
            {option.values.map((candidate) => {
              const isSelected = value[option.name] === candidate;
              const isDisabled = !(disabled.get(option.name) ?? new Set()).has(candidate);
              return (
                <button
                  key={candidate}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  disabled={isDisabled}
                  onClick={() => onChange({ ...value, [option.name]: candidate })}
                  className={cn(
                    "min-h-11 min-w-11 cursor-pointer border px-4 text-sm font-medium transition-colors",
                    isSelected
                      ? "border-signal bg-signal text-signal-foreground"
                      : "border-border bg-surface text-foreground hover:border-foreground hover:bg-surface-2",
                    isDisabled &&
                      "cursor-not-allowed line-through opacity-40 hover:border-border hover:bg-surface",
                  )}
                >
                  {candidate}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}
      <p aria-live="polite" className="price tabular text-sm text-muted-foreground">
        {matched
          ? matched.availability > 0
            ? `${formatPrice(matched.price)} · ${matched.availability} in stock`
            : `${formatPrice(matched.price)} · out of stock`
          : "Choose an option"}
      </p>
    </div>
  );
}
