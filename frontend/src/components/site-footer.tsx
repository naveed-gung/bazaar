import { Link } from "@tanstack/react-router";
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

export function SiteFooter() {
  const [subscription, setSubscription] = useState<"idle" | "pending" | "success" | "error">(
    "idle",
  );
  const categories = useCatalogCategories();
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto max-w-[1600px] px-6 py-16 lg:px-10 lg:py-20">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="max-w-sm">
            <Link to="/" className="text-2xl font-extrabold tracking-tight">
              Bazaar<span className="text-signal">.</span>
            </Link>
            <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
              Bazaar is redefining the e-commerce experience for the modern digital age — a platform
              where cutting-edge technology meets intuitive design.
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
              className="mt-7 flex gap-2 rounded-xl border border-border bg-background p-1.5"
            >
              <input
                type="email"
                name="email"
                required
                placeholder="Your email"
                className="min-w-0 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground"
              />
              <button
                type="submit"
                className="shrink-0 rounded-lg bg-signal px-4 py-2.5 text-xs font-semibold text-signal-foreground"
              >
                {subscription === "pending"
                  ? "Joining…"
                  : subscription === "success"
                    ? "Joined"
                    : "Subscribe"}
              </button>
            </form>
            {subscription === "error" && (
              <p role="alert" className="mt-2 text-xs text-destructive">
                Could not subscribe. Please retry.
              </p>
            )}
          </div>

          <div>
            <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Shop
            </h2>
            <ul className="mt-5 space-y-3.5 text-sm">
              {shop.map((item) => (
                <li key={item.to}>
                  <Link to={item.to} className="text-muted-foreground hover:text-foreground">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Categories
            </h2>
            <ul className="mt-5 space-y-3.5 text-sm">
              {(categories.data ?? []).slice(0, 5).map((cat) => (
                <li key={cat.slug}>
                  <Link
                    to="/categories/$slug"
                    params={{ slug: cat.slug }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {cat.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Support
            </h2>
            <ul className="mt-5 space-y-3.5 text-sm">
              {help.map((item) => (
                <li key={item.to}>
                  <Link to={item.to} className="text-muted-foreground hover:text-foreground">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t border-border pt-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Bazaar. Commerce for the modern digital age.</p>
          <p>React storefront · server-authoritative commerce.</p>
        </div>
      </div>
    </footer>
  );
}
