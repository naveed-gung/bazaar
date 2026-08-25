import type { ReactNode } from "react";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/breadcrumbs";

/**
 * Swiss page header (SF-12): breadcrumb trail over a 3px ink rule, numbered
 * eyebrow, expanded-black uppercase title, optional lede copy and right-aligned
 * actions on one baseline — hard left throughout. The `.shell` container and
 * the hairline bottom border are fixed; everything else flows.
 */
export function PageHero({
  eyebrow,
  title,
  copy,
  actions,
  crumbs,
  children,
}: {
  eyebrow: string;
  title: string;
  copy?: string;
  actions?: ReactNode;
  /** Defaults to Home › {eyebrow}. */
  crumbs?: BreadcrumbItem[];
  children?: ReactNode;
}) {
  const trail = crumbs ?? [{ label: "Home", to: "/" }, { label: eyebrow }];
  return (
    <section className="border-b border-border bg-surface">
      <div className="shell py-12 lg:py-16">
        <Breadcrumbs items={trail} />
        <hr className="rule-strong mt-6" />
        <div className="mt-8 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between lg:gap-16">
          <div className="max-w-3xl">
            <span className="eyebrow">{eyebrow}</span>
            {/* `.headline` supplies the expanded-black setting; the clamp keeps
                inner pages off landing-page display scale. */}
            <h1 className="headline mt-5 text-[clamp(2.25rem,5vw,4rem)]">{title}</h1>
            {copy && (
              <p className="measure mt-6 text-base leading-relaxed text-muted-foreground lg:text-lg">
                {copy}
              </p>
            )}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>}
        </div>
        {children}
      </div>
    </section>
  );
}
