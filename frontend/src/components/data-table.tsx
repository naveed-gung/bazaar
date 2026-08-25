import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Admin list table. Takes a column descriptor array (not children) so every
 * admin route gets the same sort/overflow behaviour.
 *
 * SCROLL TRAP: a sticky `<thead>` can never pin inside an `overflow-x: auto`
 * wrapper that is expected to scroll with the page — the wrapper becomes its
 * own scroll container in both axes. This table therefore scrolls its OWN body
 * region (`overflow-auto` + max height) and pins the header row inside that
 * region with `position: sticky; top: 0`, which does work because the wrapper
 * is the scroll container. Do not "fix" this back to viewport-pinning.
 */

export type DataTableColumn<T> = {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
  align?: "left" | "right" | "center";
  className?: string;
};

type SortState = { key: string | null; dir: "asc" | "desc" };

const alignClass = { left: "text-left", right: "text-right", center: "text-center" } as const;

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  caption,
  initialSort,
  maxHeightClass = "max-h-[480px]",
  empty = "Nothing here yet.",
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  caption: string;
  initialSort?: { key: string; dir: "asc" | "desc" };
  maxHeightClass?: string;
  empty?: ReactNode;
}) {
  const [sort, setSort] = useState<SortState>({
    key: initialSort?.key ?? null,
    dir: initialSort?.dir ?? "asc",
  });

  const sortedRows = useMemo(() => {
    if (!sort.key) return rows;
    const column = columns.find((col) => col.key === sort.key);
    if (!column?.sortValue) return rows;
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = column.sortValue!(a);
      const bv = column.sortValue!(b);
      if (av < bv) return -1 * factor;
      if (av > bv) return 1 * factor;
      return 0;
    });
  }, [rows, columns, sort]);

  function toggleSort(column: DataTableColumn<T>) {
    if (!column.sortValue) return;
    setSort((prev) =>
      prev.key === column.key
        ? { key: column.key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key: column.key, dir: "asc" },
    );
  }

  return (
    <div className={cn("overflow-auto border border-border bg-surface", maxHeightClass)}>
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 z-10">
          <tr>
            {columns.map((column) => {
              const sorted = sort.key === column.key;
              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={sorted ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
                  className={cn(
                    "border-b-2 border-border bg-surface px-4 py-3 font-semibold whitespace-nowrap",
                    alignClass[column.align ?? "left"],
                    column.className,
                  )}
                >
                  {column.sortValue ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(column)}
                      className={cn(
                        "inline-flex cursor-pointer items-center gap-1.5 transition-colors hover:text-foreground",
                        sorted && "text-foreground",
                      )}
                    >
                      {column.header}
                      {/* Triangles when sorted; a small square marks the
                          unsorted affordance — never colour alone. */}
                      {sorted ? (
                        sort.dir === "asc" ? (
                          <ChevronUp className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
                        )
                      ) : (
                        <span className="h-1.5 w-1.5 bg-border" aria-hidden="true" />
                      )}
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sortedRows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-muted-foreground">
                {empty}
              </td>
            </tr>
          )}
          {sortedRows.map((row) => (
            <tr
              key={rowKey(row)}
              className="border-b border-border/60 transition-colors last:border-0 hover:bg-surface-2"
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn(
                    "px-4 py-3 align-middle",
                    alignClass[column.align ?? "left"],
                    column.className,
                  )}
                >
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
