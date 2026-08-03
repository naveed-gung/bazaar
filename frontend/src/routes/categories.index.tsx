import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { Reveal } from "@/components/motion";
import { Skeleton } from "@/components/ui";
import { useCatalogCategories } from "@/lib/api";

export const Route = createFileRoute("/categories/")({
  head: () => ({
    meta: [
      { title: "Shop by Category — Bazaar" },
      {
        name: "description",
        content: "Explore Bazaar's growing collection of modern electronics by category.",
      },
      { property: "og:title", content: "Shop by Category — Bazaar" },
      {
        property: "og:description",
        content: "Curated categories of modern technology at Bazaar.",
      },
    ],
  }),
  component: Categories,
});

function Categories() {
  const catalog = useCatalogCategories();
  const categories = catalog.data ?? [];
  return (
    <>
      <PageHero
        eyebrow="Categories"
        title="Shop by Category"
        copy="Focused collections built around how people actually use technology day to day."
      />
      <section className="mx-auto grid max-w-[1600px] gap-8 px-6 py-16 sm:grid-cols-2 lg:grid-cols-3 lg:px-10 lg:py-24">
        {catalog.isPending &&
          Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="panel overflow-hidden">
              <Skeleton className="aspect-4/3 w-full rounded-none" />
              <div className="px-8 py-7">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="mt-3 h-3 w-44" />
              </div>
            </div>
          ))}
        {catalog.error && (
          <p role="alert" className="text-sm text-destructive">
            {catalog.error.message}
          </p>
        )}
        {categories.map((cat, i) => (
          <Reveal key={cat.slug} delay={i * 80}>
            <Link
              to="/categories/$slug"
              params={{ slug: cat.slug }}
              className="group block overflow-hidden rounded-3xl border border-border bg-surface transition-colors hover:border-signal"
            >
              <div className="aspect-4/3 overflow-hidden">
                <img
                  src={cat.imageUrl}
                  alt={cat.name}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
              </div>
              <div className="flex items-center justify-between gap-4 px-8 py-7">
                <div className="min-w-0">
                  <h2 className="truncate text-xl font-bold">{cat.name}</h2>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Browse the current collection
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 shrink-0 text-glow transition-transform group-hover:translate-x-1" />
              </div>
            </Link>
          </Reveal>
        ))}
      </section>
    </>
  );
}
