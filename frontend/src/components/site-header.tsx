import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ChevronDown,
  LayoutDashboard,
  Menu,
  Search,
  ShoppingBag,
  User,
  Heart,
  X,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuthStatus, useCatalogCategories, useSuggestions } from "@/lib/api";

const mainNav = [
  { label: "Shop", to: "/shop" },
  { label: "Deals", to: "/deals" },
  { label: "New Arrivals", to: "/new-arrivals" },
] as const;

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

/** Any admin-console permission unlocks the nav entry (mirrors the shared
    ADMIN_PERMISSIONS contract minus the read-only baseline). */
const ADMIN_NAV_PERMISSIONS = ["catalog:write", "orders:read", "users:manage"];

/* 40px SQUARE hit area for every header icon — roomier than a bare 20px glyph
   while keeping the action cluster narrow enough for a 375px viewport. */
const ICON_CONTROL =
  "grid h-10 w-10 cursor-pointer place-items-center text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground";

/* Uppercase micro-type for top-level navigation; the 2px red underline is
   always present so activating a link never shifts the row. */
const NAV_ITEM =
  "cursor-pointer items-center gap-1 border-b-2 border-transparent pb-1 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground [&.active]:border-accent [&.active]:text-foreground";

export function SiteHeader() {
  const { cartCount, wishlist } = useStore();
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const auth = useAuthStatus();
  const megaTriggerRef = useRef<HTMLButtonElement>(null);
  const megaRef = useRef<HTMLDivElement>(null);
  /* ⌘K reaches the persistent desktop field through this ref (SSR-13). */
  const desktopSearchRef = useRef<HTMLInputElement>(null);

  const permissions = auth.data?.principal?.permissions ?? [];
  const canAdmin = permissions.some((permission) => ADMIN_NAV_PERMISSIONS.includes(permission));

  /* SSR-18 — guests must never see Account: the entry is filtered out of the
     Pages dropdown and the mobile nav unless auth status confirms a session.
     While status is still pending it stays hidden too, so it can never flash
     for a guest before the check lands. */
  const showAccountEntry = auth.data?.authenticated === true;
  const pagesItems = pagesNav.filter((item) => item.to !== "/account" || showAccountEntry);

  // ⌘K / Ctrl+K focuses the command field from anywhere — the desktop input
  // directly, the mobile reveal bar below md.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (window.matchMedia("(min-width: 768px)").matches) {
          desktopSearchRef.current?.focus();
        } else {
          setMobileSearchOpen(true);
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Mega-menu: close on outside press; Escape closes and restores the trigger.
  useEffect(() => {
    if (!megaOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (
        !megaRef.current?.contains(event.target as Node) &&
        !megaTriggerRef.current?.contains(event.target as Node)
      ) {
        setMegaOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMegaOpen(false);
        megaTriggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [megaOpen]);

  return (
    <>
      {/* Utility bar — editorial micro-labels. */}
      <div className="border-b border-border/70 bg-background">
        <div className="shell flex items-center justify-between gap-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          <div className="flex min-w-0 items-center gap-4">
            <span className="truncate">Complimentary shipping over $50</span>
            <span className="hidden h-3 w-px bg-border sm:block" />
            <span className="hidden sm:block">30-day returns</span>
          </div>
          <div className="hidden shrink-0 items-center gap-5 md:flex">
            <Link to="/faq" className="transition-colors hover:text-accent">
              Help & Support
            </Link>
            <Link to="/track-order" className="transition-colors hover:text-accent">
              Track Order
            </Link>
          </div>
        </div>
      </div>

      <header className="sticky top-0 z-40 border-b border-border bg-background">
        {/* Wordmark · nav · command field · actions. Below md the nav and the
            persistent field drop out; the icon button reveals a full-width
            flat search bar instead. */}
        <div className="shell grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-4 sm:gap-6 md:grid-cols-[auto_minmax(0,1fr)_auto] lg:grid-cols-[auto_auto_minmax(0,1fr)_auto]">
          {/* Boxed wordmark — ink block, paper figure, sharp corners. */}
          <Link
            to="/"
            aria-label="Bazaar home"
            className="font-display justify-self-start bg-foreground px-2.5 py-1 text-xl font-bold uppercase leading-none tracking-tight text-background lg:text-2xl"
          >
            Bazaar<span className="text-accent">.</span>
          </Link>

          <nav className="hidden items-center gap-7 lg:flex">
            {mainNav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: false }}
                /* Border is always present so activating a link never shifts the row. */
                className={`flex ${NAV_ITEM}`}
              >
                {item.label}
              </Link>
            ))}

            {/* Categories mega-menu — keyboard operable, Escape closes. */}
            <div className="relative">
              <button
                ref={megaTriggerRef}
                type="button"
                aria-expanded={megaOpen}
                aria-controls="mega-categories"
                onClick={() => setMegaOpen((open) => !open)}
                className={`flex ${NAV_ITEM}`}
              >
                Categories{" "}
                <ChevronDown
                  className={`h-3 w-3 transition-transform ${megaOpen ? "rotate-180" : ""}`}
                  aria-hidden="true"
                />
              </button>
              {megaOpen && (
                <div
                  id="mega-categories"
                  ref={megaRef}
                  className="panel absolute left-1/2 top-full z-50 mt-3 w-[min(92vw,560px)] -translate-x-1/2"
                  style={{ animation: "overlay-in 160ms var(--ease-enter) both" }}
                >
                  <div className="p-2">
                    <CategoryGrid onNavigate={() => setMegaOpen(false)} />
                  </div>
                </div>
              )}
            </div>

            <div className="group relative">
              <button type="button" className={`group flex ${NAV_ITEM}`}>
                Pages{" "}
                <ChevronDown className="h-3 w-3 transition-transform group-hover:rotate-180" />
              </button>
              <div className="invisible absolute left-1/2 top-full z-50 w-48 -translate-x-1/2 pt-3 opacity-0 transition-all group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                <div className="panel p-2">
                  {pagesItems.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      className="block px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground [&.active]:bg-surface-2 [&.active]:text-foreground"
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </nav>

          {/* Persistent Swiss command field (SSR-13) — always visible on md+. */}
          <div className="hidden w-full max-w-xl justify-self-center md:block lg:max-w-2xl">
            <SearchField id="site-search" variant="desktop" inputRef={desktopSearchRef} />
          </div>

          <div className="flex shrink-0 items-center gap-0.5 justify-self-end lg:gap-1.5">
            <ThemeToggle />
            {canAdmin && (
              <Link
                to="/admin"
                aria-label="Admin console"
                className={`${ICON_CONTROL} hidden text-accent sm:grid`}
              >
                <LayoutDashboard className="h-5 w-5" />
              </Link>
            )}
            <Link
              to={auth.data?.authenticated ? "/account" : "/login"}
              aria-label={
                auth.data?.authenticated ? "Open account" : "Guest shopper — sign in optional"
              }
              title={auth.data?.authenticated ? "Account" : "Shopping as guest"}
              className="hidden h-10 items-center gap-2 px-2.5 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground sm:inline-flex"
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
                <span className="tabular absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center bg-accent px-0.5 text-[10px] font-bold text-accent-foreground">
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
                <span className="tabular absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center bg-accent px-0.5 text-[10px] font-bold text-accent-foreground">
                  {cartCount}
                </span>
              )}
            </Link>
            <button
              type="button"
              onClick={() => setMobileSearchOpen((open) => !open)}
              aria-label={mobileSearchOpen ? "Close search" : "Search products"}
              aria-expanded={mobileSearchOpen}
              aria-controls="site-search-mobile-bar"
              className={`${ICON_CONTROL} md:hidden`}
            >
              {mobileSearchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
            </button>
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

        {/* Mobile search reveal — full-width flat bar, ruled top and bottom. */}
        {mobileSearchOpen && (
          <div id="site-search-mobile-bar" className="border-y border-border bg-surface md:hidden">
            <div className="shell py-3">
              <SearchField
                id="site-search-mobile"
                variant="mobile"
                onRequestClose={() => setMobileSearchOpen(false)}
              />
            </div>
          </div>
        )}

        {menuOpen && (
          <nav
            id="site-mobile-nav"
            aria-label="Mobile"
            className="border-t border-border bg-surface px-6 py-4 lg:hidden"
          >
            {[...mainNav, ...mobileOnlyNav, ...pagesItems].map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMenuOpen(false)}
                className="flex items-center justify-between border-b border-border py-3.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground last:border-0 [&.active]:text-foreground"
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

type FlatSuggestion =
  | {
      kind: "product";
      slug: string;
      name: string;
      brand: string;
      priceMinor: number;
      imageUrl: string;
    }
  | { kind: "category"; slug: string; name: string }
  | { kind: "brand"; name: string };

const GROUP_LABELS = { product: "Products", category: "Categories", brand: "Brands" } as const;

/* Swiss command-field chrome: 44px tall, 1px ink rule, transparent paper fill,
   sharp corners, left glyph, right-aligned ⌘K chip. Focus draws the global 2px
   signal-red ring (:focus-visible token). */
const FIELD_SHELL = "relative flex h-11 items-center border border-rule bg-transparent";

type SearchFieldProps = {
  /** Unique id prefix — the desktop and mobile instances coexist in the DOM. */
  id: string;
  /** Mobile unmounts its bar on close; desktop persists and only hides suggestions. */
  variant: "desktop" | "mobile";
  /** Lets ⌘K reach the persistent desktop input from the header scope. */
  inputRef?: React.RefObject<HTMLInputElement | null>;
  /** Mobile-only: asks the header to unmount the reveal bar. */
  onRequestClose?: () => void;
};

/**
 * SF-13 combobox over GET /catalog/suggest, rebuilt as the always-visible Swiss
 * command field (SSR-13). Every interactive behaviour is preserved byte-for-byte:
 * 250 ms debounce (the endpoint is rate limited), grouped products/categories/
 * brands, full listbox semantics — ArrowUp/Down move an active option announced
 * via aria-activedescendant, Enter selects or falls through to a full /shop
 * search, the form still submits without JS-driven suggestions, Escape closes
 * and restores prior focus, outside press closes.
 */
function SearchField({ id, variant, inputRef, onRequestClose }: SearchFieldProps) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [highlight, setHighlight] = useState(-1);
  const [open, setOpen] = useState(false);
  const localInputRef = useRef<HTMLInputElement>(null);
  const input = inputRef ?? localInputRef;
  const rootRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<Element | null>(null);
  const navigate = useNavigate();

  // 250 ms debounce keeps the rate-limited endpoint off the keystroke path.
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query), 250);
    return () => window.clearTimeout(timer);
  }, [query]);
  const suggestions = useSuggestions(debounced);

  const flat: FlatSuggestion[] = useMemo(() => {
    const rows = suggestions.data ?? [];
    return rows.map((row) =>
      row.type === "product"
        ? {
            kind: "product",
            slug: row.slug,
            name: row.name,
            brand: row.brand,
            priceMinor: row.priceMinor,
            imageUrl: row.imageUrl,
          }
        : row.type === "category"
          ? { kind: "category", slug: row.slug, name: row.name }
          : { kind: "brand", name: row.name },
    );
  }, [suggestions.data]);

  // Grouped rendering order matches the flat keyboard order.
  const grouped = useMemo(() => {
    const groups: { kind: FlatSuggestion["kind"]; items: FlatSuggestion[] }[] = [];
    for (const kind of ["product", "category", "brand"] as const) {
      const items = flat.filter((entry) => entry.kind === kind);
      if (items.length) groups.push({ kind, items });
    }
    return groups;
  }, [flat]);

  useEffect(() => {
    setHighlight(-1);
  }, [debounced]);

  // The mobile bar autofocuses on reveal; whoever opened it is the opener.
  useEffect(() => {
    if (variant !== "mobile") return;
    openerRef.current = document.activeElement;
    input.current?.focus();
  }, [variant, input]);

  // Outside press closes suggestions — and the mobile bar along with them.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        if (variant === "mobile") onRequestClose?.();
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open, variant, onRequestClose]);

  const listboxVisible = open && (debounced.trim().length >= 2 || suggestions.isFetching);

  function handleFocus() {
    if (!openerRef.current) openerRef.current = document.activeElement;
    setOpen(true);
  }

  /** Close suggestions; restore focus to whoever opened the field (SF-13). */
  function closeSuggestions(restoreFocus: boolean) {
    setOpen(false);
    setHighlight(-1);
    const opener = openerRef.current as HTMLElement | null;
    openerRef.current = null;
    if (restoreFocus) {
      input.current?.blur();
      opener?.focus?.();
    }
    if (variant === "mobile") onRequestClose?.();
  }

  function runFullSearch() {
    closeSuggestions(true);
    void navigate({ to: "/shop", search: { q: query.trim() || undefined } });
  }

  function select(entry: FlatSuggestion) {
    closeSuggestions(true);
    if (entry.kind === "product")
      void navigate({ to: "/product/$slug", params: { slug: entry.slug } });
    else if (entry.kind === "category")
      void navigate({ to: "/categories/$slug", params: { slug: entry.slug } });
    else void navigate({ to: "/shop", search: { brand: entry.name } });
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeSuggestions(true);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight((current) => Math.min(flat.length - 1, current + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((current) => Math.max(-1, current - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const chosen = highlight >= 0 ? flat[highlight] : undefined;
      if (chosen) select(chosen);
      else runFullSearch();
    }
  }

  let optionIndex = -1;

  return (
    <div ref={rootRef} className="relative">
      <form role="search" onSubmit={(event) => event.preventDefault()}>
        <div className={FIELD_SHELL}>
          <Search className="ml-3 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <label className="sr-only" htmlFor={`${id}-input`}>
            Search products
          </label>
          <input
            ref={input}
            id={`${id}-input`}
            type="search"
            enterKeyHint="search"
            maxLength={100}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={handleFocus}
            onKeyDown={onKeyDown}
            role="combobox"
            aria-expanded={listboxVisible}
            aria-controls={`${id}-listbox`}
            aria-activedescendant={highlight >= 0 ? `${id}-option-${highlight}` : undefined}
            aria-autocomplete="list"
            placeholder="SEARCH THE CATALOGUE"
            className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-xs placeholder:font-semibold placeholder:tracking-[0.14em] placeholder:text-muted-foreground placeholder:uppercase"
          />
          <kbd className="tabular mr-3 hidden shrink-0 border border-border bg-background px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground sm:block">
            ⌘K
          </kbd>
        </div>
      </form>

      {listboxVisible && (
        <ul
          id={`${id}-listbox`}
          role="listbox"
          aria-label="Search suggestions"
          className="panel absolute inset-x-0 top-full z-50 mt-2 max-h-[60vh] overflow-y-auto"
          style={{ animation: "overlay-in 160ms var(--ease-enter) both" }}
        >
          <li className="p-1.5" role="presentation">
            {suggestions.isPending ? (
              <p className="px-3 py-2.5 text-sm text-muted-foreground" role="status">
                Searching…
              </p>
            ) : flat.length === 0 ? (
              <p className="px-3 py-2.5 text-sm text-muted-foreground" role="status">
                No matches for “{debounced.trim()}” — press Enter to search the full catalogue.
              </p>
            ) : (
              /* Flat panel, hairline-divided rows — no rounding, no shadows. */
              <ul className="divide-y divide-border">
                {grouped.map((group) => (
                  <li key={group.kind} role="presentation">
                    <p className="px-3 pt-2.5 pb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                      {GROUP_LABELS[group.kind]}
                    </p>
                    <ul className="divide-y divide-border">
                      {group.items.map((entry) => {
                        optionIndex += 1;
                        const index = optionIndex;
                        const active = index === highlight;
                        return (
                          <li
                            key={
                              entry.kind === "product"
                                ? `product-${entry.slug}`
                                : entry.kind === "category"
                                  ? `category-${entry.slug}`
                                  : `brand-${entry.name}`
                            }
                            id={`${id}-option-${index}`}
                            role="option"
                            aria-selected={active}
                            onMouseEnter={() => setHighlight(index)}
                            onClick={() => select(entry)}
                            className={`flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 text-sm ${
                              active ? "bg-surface-2 text-foreground" : "text-muted-foreground"
                            }`}
                          >
                            {entry.kind === "product" ? (
                              <>
                                <img
                                  src={entry.imageUrl}
                                  alt=""
                                  width={36}
                                  height={36}
                                  loading="lazy"
                                  className="h-9 w-9 shrink-0 border border-border object-cover"
                                />
                                <span className="min-w-0 flex-1 truncate">
                                  <span className="font-semibold text-foreground">
                                    {entry.name}
                                  </span>{" "}
                                  · {entry.brand}
                                </span>
                                <span className="price tabular shrink-0 text-xs">
                                  ${(entry.priceMinor / 100).toFixed(2)}
                                </span>
                              </>
                            ) : (
                              <span className="min-w-0 flex-1 truncate">{entry.name}</span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                ))}
                <li role="presentation" className="border-t border-border p-1.5">
                  <button
                    type="button"
                    onClick={runFullSearch}
                    className="block w-full px-3 py-2.5 text-left text-sm font-semibold text-accent transition-colors hover:bg-surface-2"
                  >
                    Search all products for “{query.trim()}”
                  </button>
                </li>
              </ul>
            )}
          </li>
        </ul>
      )}
    </div>
  );
}

/** Category links inside the mega-menu, fetched live from the catalogue. */
function CategoryGrid({ onNavigate }: { onNavigate: () => void }) {
  const categories = useCatalogCategories();
  return (
    <ul className="grid grid-cols-2 gap-1">
      <li>
        <Link
          to="/categories"
          onClick={onNavigate}
          className="block px-3 py-2.5 text-sm font-semibold text-accent transition-colors hover:bg-surface-2"
        >
          All categories
        </Link>
      </li>
      {(categories.data ?? []).map((category) => (
        <li key={category.slug}>
          <Link
            to="/categories/$slug"
            params={{ slug: category.slug }}
            onClick={onNavigate}
            className="block px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            {category.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}
