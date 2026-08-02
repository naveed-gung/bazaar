import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

export function PageHero({
  eyebrow,
  title,
  copy,
  children,
}: {
  eyebrow: string;
  title: string;
  copy?: string;
  children?: ReactNode;
}) {
  return (
    <section className="border-b border-border bg-surface">
      <div className="mx-auto max-w-[1600px] px-6 py-16 lg:px-10 lg:py-24">
        <nav className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground">
            Home
          </Link>
          <span>/</span>
          <span className="text-foreground">{eyebrow}</span>
        </nav>
        <h1 className="mt-6 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
          {title}
        </h1>
        {copy && (
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground lg:text-lg">
            {copy}
          </p>
        )}
        {children}
      </div>
    </section>
  );
}
