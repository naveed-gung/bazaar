import { Link } from "@tanstack/react-router";
import { RotateCcw, ShieldCheck, Truck } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";
import { useCatalogCategories } from "@/lib/api";

const help = [
  { label: "Contact", to: "/contact" },
  { label: "FAQ", to: "/faq" },
  { label: "Track Order", to: "/track-order" },
  { label: "About Bazaar", to: "/about" },
] as const;

const shop = [
  { label: "All Products", to: "/shop" },
  { label: "New Arrivals", to: "/new-arrivals" },
  { label: "Deals", to: "/deals" },
  { label: "Wishlist", to: "/wishlist" },
] as const;

const columnHeading = "text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground";
const columnList = "mt-2 divide-y divide-border text-sm";

export function SiteFooter() {
  const [subscription, setSubscription] = useState<"idle" | "pending" | "success" | "error">(
    "idle",
  );
  const categories = useCatalogCategories();
  return (
    <footer className="border-t border-border bg-surface">
      <div className="shell py-16 lg:py-20">
        {/* Massive wordmark on a 3px ink rule. */}
        <h2 className="headline text-[clamp(3rem,9vw,8rem)]">
          Bazaar<span className="text-accent">.</span>
        </h2>
        <hr className="rule-strong mt-10" />

        <div className="mt-12 grid gap-12 lg:grid-cols-[1.6fr_1fr_1fr_1fr]">
          <div className="max-w-sm">
            <p className="measure text-sm leading-relaxed text-muted-foreground">
              Considered objects for modern life — a curated catalogue, honest availability and
              server-authoritative commerce.
            </p>
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                setSubscription("pending");
                const form = event.currentTarget;
                const email = new FormData(form).get("email");
                try {
                  await api("/newsletter", { method: "POST", body: JSON.stringify({ email }) });
                  setSubscription("success");
                  form.reset();
                } catch {
                  setSubscription("error");
                }
              }}
              className="mt-7 flex items-center gap-2 border border-border bg-background p-1.5 transition-colors focus-within:border-accent"
            >
              <label className="sr-only" htmlFor="newsletter-email">
                Email address
              </label>
              <input
                id="newsletter-email"
                type="email"
                name="email"
                autoComplete="email"
                required
                placeholder="Your email"
                className="min-w-0 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground"
              />
              <button
                type="submit"
                disabled={subscription === "pending"}
                className="btn btn-primary btn-sm shrink-0"
              >
                {subscription === "pending"
                  ? "Joining…"
                  : subscription === "success"
                    ? "Joined"
                    : "Subscribe"}
              </button>
            </form>
            {subscription === "success" && (
              <p className="mt-2 text-xs text-positive" aria-live="polite">
                You're on the list.
              </p>
            )}
            {subscription === "error" && (
              <p role="alert" className="mt-2 text-xs text-destructive">
                Could not subscribe. Please retry.
              </p>
            )}
          </div>

          <nav aria-label="Shop">
            <h2 className={columnHeading}>Shop</h2>
            <ul className={columnList}>
              {shop.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className="block py-2.5 text-muted-foreground transition-colors hover:text-accent"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Categories">
            <h2 className={columnHeading}>Categories</h2>
            <ul className={columnList}>
              {(categories.data ?? []).slice(0, 5).map((cat) => (
                <li key={cat.slug}>
                  <Link
                    to="/categories/$slug"
                    params={{ slug: cat.slug }}
                    className="block py-2.5 text-muted-foreground transition-colors hover:text-accent"
                  >
                    {cat.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Support">
            <h2 className={columnHeading}>Support</h2>
            <ul className={columnList}>
              {help.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className="block py-2.5 text-muted-foreground transition-colors hover:text-accent"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <hr className="rule mt-14" />

        {/* Bottom bar — hard left aligned. */}
        <div className="pt-8">
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <li className="flex items-center gap-2">
              <Truck className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
              Free shipping over $50
            </li>
            <li className="flex items-center gap-2">
              <RotateCcw className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
              30-day returns
            </li>
            <li className="flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
              Demo payment simulator · no card data collected
            </li>
          </ul>
          <div className="mt-6 flex flex-col gap-1 text-xs text-muted-foreground">
            <p>© 2026 Bazaar. Commerce for the modern digital age.</p>
            <p>React storefront · server-authoritative commerce.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
