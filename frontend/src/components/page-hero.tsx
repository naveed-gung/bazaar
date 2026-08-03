import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

export function PageHero({
  eyebrow,
  title,
  copy,
  actions,
  children,
}: {
  eyebrow: string;
  title: string;
  copy?: string;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="border-b border-border bg-surface">
      <div className="mx-auto max-w-[1600px] px-6 py-16 lg:px-10 lg:py-24">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs">
          <Link to="/" className="text-muted-foreground hover:text-foreground">
            Home
          </Link>
          <ChevronRight className="h-3 w-3 text-muted-foreground/60" aria-hidden="true" />
          <span className="font-medium text-foreground">{eyebrow}</span>
        </nav>
        <div className="mt-6 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between lg:gap-16">
          <div className="max-w-3xl">
            <h1 className="text-[clamp(2.25rem,5vw,3.75rem)] font-extrabold leading-[1.05] tracking-tight">
              {title}
            </h1>
            {copy && (
              <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground lg:text-lg">
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
