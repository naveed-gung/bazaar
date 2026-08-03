import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Search, User, Heart, ShoppingBag, ChevronDown, Menu, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuthStatus } from "@/lib/api";

const mainNav = [
  { label: "Home", to: "/" },
  { label: "Shop", to: "/shop" },
  { label: "Categories", to: "/categories" },
  { label: "Deals", to: "/deals" },
  { label: "New Arrivals", to: "/new-arrivals" },
] as const;

/* 40px round hit area for every header icon — roomier than a bare 20px glyph
   while keeping the action cluster narrow enough for a 375px viewport. */
const ICON_CONTROL =
  "grid h-10 w-10 cursor-pointer place-items-center rounded-full text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground";

/* The wishlist icon is hidden below sm to keep the action cluster narrow, so the
   drawer has to carry it. */
const mobileOnlyNav = [{ label: "Wishlist", to: "/wishlist" }] as const;

const pagesNav = [
  { label: "About", to: "/about" },
  { label: "Contact", to: "/contact" },
  { label: "FAQ", to: "/faq" },
  { label: "Track Order", to: "/track-order" },
  { label: "Account", to: "/account" },
  { label: "Compare", to: "/compare" },
] as const;

export function SiteHeader() {
  const { cartCount, wishlist } = useStore();
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const auth = useAuthStatus();

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearchOpen(false);
    navigate({ to: "/shop", search: { q: query || undefined } });
  }

  return (
    <>
      <div className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-6 py-3.5 text-xs text-muted-foreground lg:px-10">
          <div className="flex min-w-0 items-center gap-4">
            <span className="truncate">Free shipping on all orders over $50</span>
            <span className="hidden h-3 w-px bg-border sm:block" />
            <span className="hidden sm:block">Easy returns</span>
          </div>
          <div className="hidden shrink-0 items-center gap-5 md:flex">
            <Link to="/faq" className="hover:text-foreground">
              Help &amp; Support
            </Link>
            <Link to="/track-order" className="hover:text-foreground">
              Track Order
            </Link>
            <span className="h-3 w-px bg-border" />
            <span>USD</span>
            <span className="h-3 w-px bg-border" />
            <span className="flex items-center gap-1">
              EN <ChevronDown className="h-3 w-3" />
            </span>
          </div>
        </div>
      </div>

      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="mx-auto grid max-w-[1600px] grid-cols-[minmax(0,1fr)_auto] items-center gap-6 px-6 py-5 lg:grid-cols-[auto_1fr_auto] lg:px-10">
          <Link to="/" className="text-2xl font-extrabold tracking-tight lg:text-[1.7rem]">
            Bazaar<span className="text-signal">.</span>
          </Link>

          <nav className="hidden items-center justify-center gap-9 text-sm font-medium lg:flex">
            {mainNav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: item.to === "/" }}
                /* Border is always present so activating a link never shifts the row. */
                className="border-b-2 border-transparent pb-1 text-muted-foreground transition-colors hover:text-foreground [&.active]:border-signal [&.active]:text-foreground"
              >
                {item.label}
              </Link>
            ))}
            <div className="group relative">
              <button
                type="button"
                className="flex cursor-pointer items-center gap-1 border-b-2 border-transparent pb-1 text-muted-foreground transition-colors group-hover:text-foreground"
              >
                Pages{" "}
                <ChevronDown className="h-3 w-3 transition-transform group-hover:rotate-180" />
              </button>
              <div className="invisible absolute left-1/2 top-full z-50 w-48 -translate-x-1/2 pt-3 opacity-0 transition-all group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                <div className="overflow-hidden rounded-xl border border-border bg-surface p-2 shadow-lift">
                  {pagesNav.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      className="block rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground [&.active]:bg-surface-2 [&.active]:text-foreground"
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </nav>

          <div className="flex shrink-0 items-center gap-0.5 justify-self-end lg:gap-2">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => setSearchOpen((open) => !open)}
              aria-label="Search products"
              aria-expanded={searchOpen}
              aria-controls="site-search"
              className={ICON_CONTROL}
            >
              <Search className="h-5 w-5" />
            </button>
            <Link
              to={auth.data?.authenticated ? "/account" : "/login"}
              aria-label={
                auth.data?.authenticated ? "Open account" : "Guest shopper — sign in optional"
              }
              title={auth.data?.authenticated ? "Account" : "Shopping as guest"}
              className="hidden h-10 items-center gap-2 rounded-full px-2.5 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground sm:inline-flex"
            >
              <User className="h-5 w-5" />
              {!auth.data?.authenticated && !auth.isPending && (
                <span className="hidden text-xs font-medium xl:inline">Guest</span>
              )}
            </Link>
            <Link
              to="/wishlist"
              aria-label={
                wishlist.length ? `Wishlist, ${wishlist.length} saved` : "Wishlist, empty"
              }
              className={`${ICON_CONTROL} relative hidden sm:grid`}
            >
              <Heart className="h-5 w-5" />
              {wishlist.length > 0 && (
                <span className="tabular absolute right-1 top-1 grid h-4 w-4 place-items-center rounded-full bg-glow text-[10px] font-bold text-signal-foreground">
                  {wishlist.length}
                </span>
              )}
            </Link>
            <Link
              to="/cart"
              aria-label={cartCount ? `Cart, ${cartCount} items` : "Cart, empty"}
              className={`${ICON_CONTROL} relative`}
            >
              <ShoppingBag className="h-5 w-5" />
              {cartCount > 0 && (
                <span className="tabular absolute right-1 top-1 grid h-4 w-4 place-items-center rounded-full bg-signal text-[10px] font-bold text-signal-foreground">
                  {cartCount}
                </span>
              )}
            </Link>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              aria-controls="site-mobile-nav"
              className={`${ICON_CONTROL} lg:hidden`}
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {searchOpen && (
          <div id="site-search" className="border-t border-border bg-surface">
            <form
              onSubmit={submitSearch}
              role="search"
              onKeyDown={(event) => {
                if (event.key === "Escape") setSearchOpen(false);
              }}
              className="mx-auto flex max-w-[1600px] items-center gap-3 px-6 py-5 lg:px-10"
            >
              <Search className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <label className="sr-only" htmlFor="site-search-input">
                Search products
              </label>
              <input
                autoFocus
                id="site-search-input"
                name="q"
                type="search"
                enterKeyHint="search"
                maxLength={100}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search headphones, cameras, smart home…"
                className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
              />
              <button type="submit" className="btn btn-primary btn-sm shrink-0">
                Search
              </button>
            </form>
          </div>
        )}

        {menuOpen && (
          <nav
            id="site-mobile-nav"
            aria-label="Mobile"
            className="border-t border-border bg-surface px-6 py-4 lg:hidden"
          >
            {[...mainNav, ...mobileOnlyNav, ...pagesNav].map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMenuOpen(false)}
                className="flex items-center justify-between border-b border-border/60 py-3.5 text-sm text-muted-foreground last:border-0 [&.active]:font-semibold [&.active]:text-foreground"
              >
                {item.label}
                {item.to === "/wishlist" && wishlist.length > 0 && (
                  <span className="tabular text-xs text-muted-foreground">{wishlist.length}</span>
                )}
              </Link>
            ))}
          </nav>
        )}
      </header>
    </>
  );
}
