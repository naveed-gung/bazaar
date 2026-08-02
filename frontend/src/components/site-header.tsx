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
                className="pb-1 text-muted-foreground transition-colors hover:text-foreground [&.active]:border-b-2 [&.active]:border-signal [&.active]:text-foreground"
              >
                {item.label}
              </Link>
            ))}
            <div className="group relative">
              <button
                type="button"
                className="flex items-center gap-1 pb-1 text-muted-foreground transition-colors group-hover:text-foreground"
              >
                Pages <ChevronDown className="h-3 w-3" />
              </button>
              <div className="invisible absolute left-1/2 top-full z-50 w-48 -translate-x-1/2 pt-3 opacity-0 transition-all group-hover:visible group-hover:opacity-100">
                <div className="overflow-hidden rounded-xl border border-border bg-surface p-2 shadow-lift">
                  {pagesNav.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      className="block rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </nav>

          <div className="flex shrink-0 items-center gap-4 justify-self-end lg:gap-6">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => setSearchOpen((v) => !v)}
              aria-label="Search products"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              <Search className="h-5 w-5" />
            </button>
            <Link
              to={auth.data?.authenticated ? "/account" : "/login"}
              aria-label={
                auth.data?.authenticated ? "Open account" : "Guest shopper — sign in optional"
              }
              title={auth.data?.authenticated ? "Account" : "Shopping as guest"}
              className="hidden items-center gap-2 text-muted-foreground transition-colors hover:text-foreground sm:flex"
            >
              <User className="h-5 w-5" />
              {!auth.data?.authenticated && !auth.isPending && (
                <span className="hidden text-xs font-medium xl:inline">Guest</span>
              )}
            </Link>
            <Link
              to="/wishlist"
              aria-label="Wishlist"
              className="relative text-muted-foreground transition-colors hover:text-foreground"
            >
              <Heart className="h-5 w-5" />
              {wishlist.length > 0 && (
                <span className="absolute -right-2 -top-2 grid h-4 w-4 place-items-center rounded-full bg-glow text-[10px] font-bold text-signal-foreground">
                  {wishlist.length}
                </span>
              )}
            </Link>
            <Link
              to="/cart"
              aria-label="Cart"
              className="relative text-muted-foreground transition-colors hover:text-foreground"
            >
              <ShoppingBag className="h-5 w-5" />
              {cartCount > 0 && (
                <span className="absolute -right-2 -top-2 grid h-4 w-4 place-items-center rounded-full bg-signal text-[10px] font-bold text-signal-foreground">
                  {cartCount}
                </span>
              )}
            </Link>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Open menu"
              className="text-muted-foreground lg:hidden"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {searchOpen && (
          <div className="border-t border-border bg-surface">
            <form
              onSubmit={submitSearch}
              className="mx-auto flex max-w-[1600px] items-center gap-3 px-6 py-5 lg:px-10"
            >
              <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search headphones, cameras, smart home…"
                className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
              />
              <button
                type="submit"
                className="shrink-0 rounded-lg bg-signal px-5 py-2.5 text-sm font-semibold text-signal-foreground"
              >
                Search
              </button>
            </form>
          </div>
        )}

        {menuOpen && (
          <nav className="border-t border-border bg-surface px-6 py-4 lg:hidden">
            {[...mainNav, ...pagesNav].map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMenuOpen(false)}
                className="block border-b border-border/60 py-3.5 text-sm text-muted-foreground last:border-0"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        )}
      </header>
    </>
  );
}
