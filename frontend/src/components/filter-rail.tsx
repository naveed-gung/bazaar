import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type FilterGroup = {
  id: string;
  label: string;
  options: { value: string; label: string; count?: number }[];
};

/**
 * Presentational filter sidebar for the shop route. On mobile the consumer
 * renders it inside a `Drawer`; on desktop it sits beside the grid. Swiss
 * ruled sections with numbered legends and square checkboxes.
 */
export function FilterRail({
  title = "Filters",
  groups,
  selected,
  onToggle,
  onClear,
  className,
}: {
  title?: string;
  groups: FilterGroup[];
  selected: Record<string, string[]>;
  onToggle: (groupId: string, value: string) => void;
  onClear?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("panel p-5", className)}>
      <div className="flex items-center justify-between gap-3">
        <span className="eyebrow">{title}</span>
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="btn btn-ghost btn-sm text-muted-foreground hover:text-foreground"
          >
            Clear all
          </button>
        )}
      </div>
      <hr className="rule-strong mt-4" />
      <div className="mt-5 space-y-5">
        {groups.map((group, groupIndex) => (
          <fieldset
            key={group.id}
            className="border-b border-border pb-5 last:border-b-0 last:pb-0"
          >
            <legend className="flex items-baseline gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              <span className="tabular">{String(groupIndex + 1).padStart(2, "0")}</span>
              {group.label}
            </legend>
            <ul className="mt-3 space-y-2.5">
              {group.options.map((option) => {
                const checked = (selected[group.id] ?? []).includes(option.value);
                return (
                  <li key={option.value}>
                    <label className="flex cursor-pointer items-center gap-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => onToggle(group.id, option.value)}
                        className="peer sr-only"
                      />
                      <span
                        aria-hidden="true"
                        className={cn(
                          "grid h-[18px] w-[18px] shrink-0 place-items-center border transition-colors",
                          checked
                            ? "border-signal bg-signal text-signal-foreground"
                            : "border-border bg-background peer-focus-visible:outline-2 peer-focus-visible:outline-ring",
                        )}
                      >
                        {checked && <Check className="h-3 w-3" strokeWidth={3} />}
                      </span>
                      <span className="flex-1">{option.label}</span>
                      {option.count !== undefined && (
                        <span className="tabular ml-auto text-xs text-muted-foreground">
                          {option.count}
                        </span>
                      )}
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        ))}
      </div>
    </div>
  );
}
