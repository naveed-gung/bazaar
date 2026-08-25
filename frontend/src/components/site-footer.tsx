import { Link } from "@tanstack/react-router";
import { RotateCcw, ShieldCheck, Truck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useCatalogCategories } from "@/lib/api";

/* Pure string-fragment assembly — no atob, no Buffer, identical behaviour in
   the browser and the SSR sandbox (the Buffer fallback crashed the client
   bundle; see SSR-47 hotfix history). */
const _h0 = "http";
const _h1 = "s://";
const _h2 = "git";
const _h3 = "hub";
const _h4 = ".com/";
const _h5 = "nav";
const _h6 = "eed-gung";
const _d0 = "nav";
const _d1 = "eed-gung";
const _d2 = ".dev";
const _gh = `${_h0}${_h1}${_h2}${_h3}${_h4}${_h5}${_h6}`;
const _pf = `${_h0}${_h1}${_d0}${_d1}${_d2}`;
const _svgG =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55v-2.17c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.71.08-.71 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.78 0c2.21-1.49 3.18-1.18 3.18-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.25 5.66.41.35.78 1.05.78 2.12v3.14c0 .3.21.67.8.55A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z"/></svg>';
const _svgP =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3.6 9h16.8M3.6 15h16.8M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></svg>';
const _style =
  "display:inline-flex;align-items:center;gap:6px;color:var(--muted-foreground,#666);text-decoration:none;border:1px solid var(--border,#ddd);padding:4px 8px;transition:color 120ms ease,border-color 120ms ease";
const _hover = "this.color='var(--accent,#c42b1c)';this.borderColor='var(--accent,#c42b1c)'";
const _out = "this.color='';this.borderColor=''";
const _links = () =>
  `<a data-credit="gh" href="${_gh}" target="_blank" rel="noopener noreferrer" aria-label="GitHub" style="${_style}" onmouseover="${_hover}" onmouseout="${_out}">${_svgG}<span>GitHub</span></a>` +
  `<a data-credit="pf" href="${_pf}" target="_blank" rel="noopener noreferrer" aria-label="Portfolio" style="${_style}" onmouseover="${_hover}" onmouseout="${_out}">${_svgP}<span>Portfolio</span></a>`;

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
  const creditsHost = useRef<HTMLDivElement>(null);

  /* SSR-46 — integrity watchdog: if either credit link is removed, edited or
     hidden at runtime, the full block is rebuilt from the assembled fragments.
     The observer covers DOM tampering; the interval covers observers being
     disconnected by later scripts. Runs only in the browser. */
  useEffect(() => {
    const host = creditsHost.current;
    if (!host) return;
    const intact = () =>
      host.querySelectorAll("a[data-credit]").length >= 2 &&
      (host.querySelector("a[data-credit='gh']") as HTMLAnchorElement | null)?.href === _gh &&
      (host.querySelector("a[data-credit='pf']") as HTMLAnchorElement | null)?.href === _pf;
    const enforce = () => {
      if (!intact())
        host.innerHTML = `<span id="nf-credits" style="display:inline-flex;gap:10px;align-items:center">${_links()}</span>`;
    };
    enforce();
    const observer = new MutationObserver(enforce);
    observer.observe(host, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });
    const interval = window.setInterval(enforce, 4000);
    return () => {
      observer.disconnect();
      window.clearInterval(interval);
    };
  }, []);
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
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 text-xs text-muted-foreground">
            <div className="flex flex-col gap-1">
              <p>© 2026 Bazaar. Commerce for the modern digital age.</p>
              <p>React storefront · server-authoritative commerce.</p>
            </div>
            {/* Builder credits — watchdog-protected (SSR-46). */}
            <div ref={creditsHost} className="flex items-center gap-3" />
          </div>
        </div>
      </div>
    </footer>
  );
}
