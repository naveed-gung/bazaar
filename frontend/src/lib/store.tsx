import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, api, useAuthStatus, type CartDto, type CatalogProduct } from "./api";
import { CART_QTY_LIMIT, CartDrawer } from "@/components/cart-drawer";
import { showToast } from "@/components/toast";

/** One cart line with everything the page and the drawer need, resolved once. */
export type CartLineView = {
  lineId: string;
  slug: string;
  name: string;
  brand: string;
  category: string;
  img: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  /** Per-variant sellable stock when the API exposes it; null otherwise. */
  stock: number | null;
  optionValues: Record<string, string>;
};

/** A line parked by save-for-later. Snapshot lives in localStorage so the
    parked item survives reloads without a dedicated backend collection. */
export type SavedItem = {
  slug: string;
  name: string;
  brand: string;
  category: string;
  img: string;
  price: number;
  qty: number;
};

/** SSR-35 — one LOCAL guest-cart line. Snapshotted from the ProductSummary at
    add time and persisted at "bazaar.cart.v1"; the line only reaches MongoDB
    when checkout login/signup triggers the merge. No variant/option fields:
    guests pick the default sellable offer, exactly what POST /cart/lines does
    with a bare { slug, quantity }. */
export type LocalCartLine = {
  slug: string;
  name: string;
  brand: string;
  category: string;
  img: string;
  unitPriceMinor: number;
  quantity: number;
  addedAt: number;
};

type StoreValue = {
  cartCount: number;
  /** Distinct slugs + quantities derived from the SAME source as cartDetail
      (server lines while authenticated, the localStorage snapshot for guests).
      Every consumer reads `.length` only — verified across frontend/src on
      2026-08-25 (SSR-35) — so the old `{ product, qty }` shape was narrowed. */
  cartLines: { slug: string; qty: number }[];
  cartDetail: CartLineView[];
  subtotal: number;
  wishlist: string[];
  saved: SavedItem[];
  pending: boolean;
  error: string | null;
  /** SSR-35 — false until BOTH the localStorage snapshot has loaded AND the
      auth probe has settled. /checkout gates its wizard on this so a guest
      holding items never flashes the sign-in form before the gate decides. */
  cartReady: boolean;
  /** SSR-25 — resolves TRUE once the cart write has landed (locally for
      guests, in the ["cart"] cache for accounts); false (after an error toast)
      on failure. Never rejects, so fire-and-forget callers stay safe. */
  addToCart: (slug: string, qty?: number) => Promise<boolean>;
  setQty: (slug: string, qty: number) => void;
  removeFromCart: (slug: string) => void;
  clearCart: () => void;
  toggleWishlist: (slug: string) => void;
  isWishlisted: (slug: string) => boolean;
  /** Slugs currently in the backend comparison list (what /compare renders). */
  comparison: string[];
  isCompared: (slug: string) => boolean;
  toggleCompare: (slug: string) => void;
  saveForLater: (lineId: string) => void;
  moveSavedToCart: (slug: string) => void;
  removeSaved: (slug: string) => void;
  cartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
};

const StoreContext = createContext<StoreValue | null>(null);
const cartKey = ["cart"] as const;
const favoritesKey = ["favorites"] as const;
/** Slugs-only mirror of GET /comparison — what card toggles read and write. */
const comparisonKey = ["comparison-slugs"] as const;
/** The /compare matrix's own query (full CatalogProduct documents). */
const COMPARE_MATRIX_KEY = ["comparison"] as const;
const SAVED_KEY = "bazaar.saved.v1";
/** SSR-35 — the LOCAL guest cart. Owner-approved architecture: the guest cart
    lives entirely in localStorage under this versioned key and moves into
    MongoDB only when checkout login/signup merges it into the account. */
const LOCAL_CART_KEY = "bazaar.cart.v1";

function readSaved(): SavedItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SAVED_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as SavedItem[]) : [];
  } catch {
    return [];
  }
}

function writeSaved(items: SavedItem[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SAVED_KEY, JSON.stringify(items));
  } catch {
    /* storage full or blocked — save-for-later degrades to session-only */
  }
}

function readLocalCart(): LocalCartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_CART_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    // Defensive shape check: a corrupted or foreign payload degrades to an
    // empty cart instead of poisoning every derivation downstream.
    return parsed.filter(
      (entry): entry is LocalCartLine =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as LocalCartLine).slug === "string" &&
        typeof (entry as LocalCartLine).unitPriceMinor === "number" &&
        typeof (entry as LocalCartLine).quantity === "number",
    );
  } catch {
    return [];
  }
}

function writeLocalCart(lines: LocalCartLine[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCAL_CART_KEY, JSON.stringify(lines));
  } catch {
    /* storage full or blocked — the guest cart degrades to session-only */
  }
}

type LineSnapshot = Pick<
  LocalCartLine,
  "slug" | "name" | "brand" | "category" | "img" | "unitPriceMinor"
>;

/** SSR-35 — resolve the ProductSummary snapshot for a slug out of ANY cached
    catalogue query (grids/facets, the ["product", slug] detail, the compare
    matrix, recently-viewed). addToCart callers pass only a slug, so the store
    self-serves the display fields from whatever the app already fetched —
    every real call site (product cards, detail page, wishlist, compare) has
    the summary in cache at click time. Bounded recursive scan matching the
    ProductSummary shape exactly; null when nothing cached carries it. */
function findSummary(value: unknown, slug: string, depth: number): LineSnapshot | null {
  if (!value || depth > 4) return null;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = findSummary(entry, slug, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (
      record["slug"] === slug &&
      typeof record["name"] === "string" &&
      typeof record["brand"] === "string" &&
      typeof record["category"] === "string" &&
      typeof record["imageUrl"] === "string"
    ) {
      const price = record["price"] as { amountMinor?: unknown } | undefined;
      if (price && typeof price.amountMinor === "number") {
        return {
          slug,
          name: record["name"] as string,
          brand: record["brand"] as string,
          category: record["category"] as string,
          img: record["imageUrl"] as string,
          unitPriceMinor: price.amountMinor,
        };
      }
    }
    for (const entry of Object.values(record)) {
      const found = findSummary(entry, slug, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  // SSR-35 — the auth probe decides which cart is truth: server lines while
  // authenticated, the localStorage snapshot otherwise. useAuthStatus is
  // already mounted by the header/cart/checkout, so this shares its cache.
  const auth = useAuthStatus();
  const authenticated = auth.data?.authenticated === true;
  const cart = useQuery({
    queryKey: cartKey,
    queryFn: () => api<CartDto>("/cart"),
    retry: 2,
    // SSR-35 — guests make ZERO cart calls. The local snapshot is truth, and
    // skipping GET /cart deletes the entire guest-cookie race class at its
    // root (SSR-31's mint-on-first-request bootstrap no longer exists for
    // cart flows). The query enables the moment authentication lands.
    enabled: authenticated,
  });
  const favorites = useQuery({
    queryKey: favoritesKey,
    queryFn: () => api<{ slug: string }[]>("/favorites"),
    retry: 2,
  });
  // SSR-19: card-level compare. Slugs only, so grid pages never drag full
  // product documents through the cache just to light a toggle.
  const comparison = useQuery({
    queryKey: comparisonKey,
    queryFn: async () => {
      const products = await api<CatalogProduct[]>("/comparison");
      return products.map((product) => product.slug);
    },
    retry: 2,
  });
  // Hydration-safe (SSR-11a): the server and the first client render agree on
  // []; localStorage is only read inside an effect. `savedLoaded` keeps the
  // write-back effect idle until that one-time load has landed, so it can never
  // clobber the stored snapshot with the empty initial state.
  const [saved, setSaved] = useState<SavedItem[]>([]);
  const [savedLoaded, setSavedLoaded] = useState(false);
  // SSR-35 — identical hydration pattern for the LOCAL cart: [] on the server
  // and the first client render; the stored snapshot loads in a mount effect
  // behind `localLoaded`, so the write-back can never clobber it with [].
  const [localCart, setLocalCart] = useState<LocalCartLine[]>([]);
  const [localLoaded, setLocalLoaded] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  // SSR-25 — the quick-add write currently in flight (null when idle). The
  // mini-cart drawer must never open over a cart that hasn't received the new
  // line yet, so openCart defers on this promise. Guest adds resolve almost
  // synchronously, so the deferral is simply transparent there.
  const addInFlight = useRef<Promise<boolean> | null>(null);

  useEffect(() => {
    setSaved(readSaved());
    setSavedLoaded(true);
  }, []);

  useEffect(() => {
    if (!savedLoaded) return;
    writeSaved(saved);
  }, [savedLoaded, saved]);

  useEffect(() => {
    setLocalCart(readLocalCart());
    setLocalLoaded(true);
  }, []);

  useEffect(() => {
    if (!localLoaded) return;
    writeLocalCart(localCart);
  }, [localLoaded, localCart]);

  // Latest local snapshot without listing localCart in the merge effect's
  // dependencies (a mid-merge local edit must not restart the push loop).
  const localCartRef = useRef<LocalCartLine[]>([]);
  useEffect(() => {
    localCartRef.current = localCart;
  }, [localCart]);

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: cartKey });
  }, [queryClient]);
  const cartMutation = useMutation({
    mutationFn: ({ path, method, body }: { path: string; method: string; body?: unknown }) =>
      api<CartDto | void>(path, { method, ...(body ? { body: JSON.stringify(body) } : {}) }),
    // SSR-28 ROOT CAUSE (guest quick-add badge): the derivation chain was
    // verified byte-correct end to end — onSuccess already wrote the returned
    // CartDto into the SAME ["cart"] key the badge reads, the shared CartDto's
    // lines/itemCount match backend serializeCart exactly (no items-vs-lines
    // mismatch), and the badge renders >0 with aria-label. The defect was
    // ASYMMETRY: the wishlist heart mutated OPTIMISTICALLY while the cart badge
    // waited on the POST round-trip — under guest conditions (cold serverless
    // functions plus the first-load burst of cookie-less API calls that mint a
    // fresh guest identity per request in request-context.ts) that round-trip
    // lagged or interleaved with refetches, so the count appeared late or got
    // clobbered while the heart looked instant. Fix: give quick-add the same
    // optimistic treatment (itemCount bump only — lines stay authoritative so
    // the drawer is never fed fabricated rows); the server response remains
    // the source of truth and rolls the bump back on failure. SSR-35 note:
    // guests no longer reach this mutation at all (local ops are instant),
    // so the asymmetry class is retired rather than patched again.
    onMutate: async ({ path, method, body }) => {
      if (path !== "/cart/lines" || method !== "POST") return undefined;
      await queryClient.cancelQueries({ queryKey: cartKey });
      const previous = queryClient.getQueryData<CartDto>(cartKey);
      const parsed = body as { quantity?: unknown } | undefined;
      const quantity = typeof parsed?.quantity === "number" ? parsed.quantity : 1;
      if (previous) {
        queryClient.setQueryData<CartDto>(cartKey, {
          ...previous,
          itemCount: previous.itemCount + quantity,
        });
      }
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(cartKey, context.previous);
    },
    onSuccess: (next) => {
      if (next) queryClient.setQueryData(cartKey, next);
      else void refresh();
    },
  });
  const favoriteMutation = useMutation({
    mutationFn: ({ slug, wished }: { slug: string; wished: boolean }) =>
      api<void | { slug: string; favorite: boolean }>(`/favorites/${encodeURIComponent(slug)}`, {
        method: wished ? "DELETE" : "PUT",
      }),
    onMutate: async ({ slug, wished }) => {
      await queryClient.cancelQueries({ queryKey: favoritesKey });
      const previous = queryClient.getQueryData<{ slug: string }[]>(favoritesKey) ?? [];
      queryClient.setQueryData(
        favoritesKey,
        wished ? previous.filter((item) => item.slug !== slug) : [...previous, { slug }],
      );
      return { previous };
    },
    onError: (_error, _variables, context) =>
      queryClient.setQueryData(favoritesKey, context?.previous),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: favoritesKey }),
  });
  const comparisonMutation = useMutation({
    mutationFn: ({ slug, compared }: { slug: string; compared: boolean }) =>
      api<unknown>(`/comparison/${encodeURIComponent(slug)}`, {
        method: compared ? "DELETE" : "PUT",
      }),
    onMutate: async ({ slug, compared }) => {
      await queryClient.cancelQueries({ queryKey: comparisonKey });
      const previous = queryClient.getQueryData<string[]>(comparisonKey) ?? [];
      queryClient.setQueryData<string[]>(
        comparisonKey,
        compared ? previous.filter((item) => item !== slug) : [...previous, slug],
      );
      return { previous };
    },
    onError: (error, _variables, context) => {
      queryClient.setQueryData(comparisonKey, context?.previous);
      // The limit failure must never look like a dead button (SSR-19).
      if (error instanceof ApiError && error.code === "COMPARISON_LIMIT") {
        showToast(
          "info",
          "Compare list is full",
          "Up to four products — remove one at /compare to add another.",
        );
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: comparisonKey });
      // Keep the /compare matrix in sync with card toggles from any route.
      void queryClient.invalidateQueries({ queryKey: COMPARE_MATRIX_KEY });
    },
  });

  // SSR-35 — MERGE ON AUTHENTICATION. Watch the auth status; on the
  // false→true transition with a non-empty local cart, push each line through
  // the existing POST /cart/lines sequentially (each success writes the full
  // serialized CartDto into the ["cart"] cache via the mutation's onSuccess).
  // Lines whose push fails STAY in localStorage with retry guidance; merged
  // lines are cleared. Server responses remain truth afterwards.
  const mergeInFlight = useRef(false);
  const wasAuthenticated = useRef(false);
  useEffect(() => {
    if (!authenticated || !localLoaded) {
      wasAuthenticated.current = authenticated;
      return;
    }
    const transitioned = !wasAuthenticated.current;
    wasAuthenticated.current = true;
    if (!transitioned || mergeInFlight.current) return;
    const pendingLines = localCartRef.current;
    if (!pendingLines.length) return;
    mergeInFlight.current = true;
    void (async () => {
      const stuck: LocalCartLine[] = [];
      for (const line of pendingLines) {
        try {
          await cartMutation.mutateAsync({
            path: "/cart/lines",
            method: "POST",
            body: { slug: line.slug, quantity: line.quantity },
          });
        } catch {
          stuck.push(line);
        }
      }
      setLocalCart(stuck);
      mergeInFlight.current = false;
      if (stuck.length === 0) {
        showToast(
          "success",
          "Your cart moved into your account",
          "Every item you picked as a guest is now in your account cart.",
        );
      } else {
        showToast(
          "error",
          "Some items stayed in this browser",
          `${stuck.length} ${stuck.length === 1 ? "item" : "items"} couldn't move just now — ` +
            "they're still saved locally. Retry from the cart page.",
        );
      }
    })();
  }, [authenticated, localLoaded, cartMutation]);

  const apiLines = useMemo(
    () => (authenticated ? (cart.data?.lines ?? []) : []),
    [authenticated, cart.data],
  );
  const serverDetail = useMemo<CartLineView[]>(
    () =>
      apiLines.map((line) => {
        const summary = line.product;
        // The public catalogue currently serialises `variants` as a single legacy
        // stub, so per-line option values light up only when the matrix lands.
        const variant = summary.variants.find((entry) => entry.id === line.variantId);
        return {
          lineId: line.lineId,
          slug: summary.slug,
          name: summary.name,
          brand: summary.brand,
          category: summary.category,
          img: summary.imageUrl,
          qty: line.quantity,
          unitPrice: line.unitPrice.amountMinor / 100,
          lineTotal: line.lineTotal.amountMinor / 100,
          stock: variant ? variant.quantityAvailable : null,
          optionValues: variant?.optionValues ?? {},
        };
      }),
    [apiLines],
  );
  // SSR-35 — the guest mirror of serverDetail. lineId IS the slug (no variant
  // matrix locally), stock is unknown offline, options are empty.
  const localDetail = useMemo<CartLineView[]>(
    () =>
      localCart.map((item) => ({
        lineId: item.slug,
        slug: item.slug,
        name: item.name,
        brand: item.brand,
        category: item.category,
        img: item.img,
        qty: item.quantity,
        unitPrice: item.unitPriceMinor / 100,
        lineTotal: (item.unitPriceMinor * item.quantity) / 100,
        stock: null,
        optionValues: {},
      })),
    [localCart],
  );
  const cartDetail = authenticated ? serverDetail : localDetail;
  const cartLines = useMemo(
    () => cartDetail.map((line) => ({ slug: line.slug, qty: line.qty })),
    [cartDetail],
  );
  const subtotal = authenticated
    ? (cart.data?.subtotal.amountMinor ?? 0) / 100
    : localDetail.reduce((sum, line) => sum + line.lineTotal, 0);
  const cartCount = authenticated
    ? (cart.data?.itemCount ?? 0)
    : localDetail.reduce((sum, line) => sum + line.qty, 0);
  const wishlist = useMemo(() => (favorites.data ?? []).map((item) => item.slug), [favorites.data]);

  // Slug-based actions shared by the store value AND the mini-cart drawer, so
  // both carts dispatch through exactly one code path (SSR-35).
  const changeQty = useCallback(
    (slug: string, quantity: number) => {
      if (!authenticated) {
        setLocalCart((current) =>
          quantity <= 0
            ? current.filter((line) => line.slug !== slug)
            : current.map((line) =>
                line.slug === slug
                  ? { ...line, quantity: Math.min(quantity, CART_QTY_LIMIT) }
                  : line,
              ),
        );
        return;
      }
      const line = apiLines.find((entry) => entry.product.slug === slug);
      if (!line) return;
      cartMutation.mutate({
        path: `/cart/lines/${line.lineId}`,
        method: quantity <= 0 ? "DELETE" : "PATCH",
        ...(quantity > 0 ? { body: { quantity } } : {}),
      });
    },
    [authenticated, apiLines, cartMutation],
  );
  const removeLine = useCallback(
    (slug: string) => {
      if (!authenticated) {
        setLocalCart((current) => current.filter((line) => line.slug !== slug));
        return;
      }
      const line = apiLines.find((entry) => entry.product.slug === slug);
      if (line) cartMutation.mutate({ path: `/cart/lines/${line.lineId}`, method: "DELETE" });
    },
    [authenticated, apiLines, cartMutation],
  );
  const emptyCart = useCallback(() => {
    if (!authenticated) {
      setLocalCart([]);
      return;
    }
    cartMutation.mutate({ path: "/cart", method: "DELETE" });
  }, [authenticated, cartMutation]);

  const value = useMemo<StoreValue>(() => {
    return {
      cartCount,
      cartLines,
      cartDetail,
      subtotal,
      wishlist,
      saved,
      cartReady: !auth.isPending && localLoaded,
      pending:
        (authenticated && cart.isLoading) || cartMutation.isPending || favoriteMutation.isPending,
      error:
        cart.error?.message ??
        cartMutation.error?.message ??
        favorites.error?.message ??
        favoriteMutation.error?.message ??
        null,
      addToCart: async (slug, quantity = 1) => {
        // SSR-35 — GUESTS: purely local, instant, zero network. The display
        // snapshot comes from whatever catalogue data the app already fetched
        // (see findSummary); the line persists at bazaar.cart.v1 and rides to
        // the server only at the next authentication (merge effect above).
        if (!authenticated) {
          const summary = findSummary(
            queryClient
              .getQueryCache()
              .getAll()
              .map((query) => query.state.data),
            slug,
            0,
          );
          if (!summary) {
            showToast(
              "error",
              "Couldn't add to cart",
              "The product details weren't available for your cart. Please try again.",
            );
            return false;
          }
          setLocalCart((current) => {
            const existing = current.find((line) => line.slug === slug);
            if (existing) {
              return current.map((line) =>
                line.slug === slug
                  ? { ...line, quantity: Math.min(line.quantity + quantity, CART_QTY_LIMIT) }
                  : line,
              );
            }
            return [...current, { ...summary, quantity, addedAt: Date.now() }];
          });
          return true;
        }
        const attempt = (async () => {
          try {
            // SSR-31's bootstrap-await is retired: the ["cart"] query only
            // enables once authenticated, the session cookie is already
            // stored by then, and guests never reach this branch — so there
            // is no identity race left to guard against.
            await cartMutation.mutateAsync({
              path: "/cart/lines",
              method: "POST",
              body: { slug, quantity },
            });
            return true;
          } catch (error) {
            // SSR-34 — TEMPORARY diagnostics (remove at the next QA pass):
            // surface the backend problem-details code + HTTP status so the
            // real failure mode (origin 403 vs db 503 vs validation 422 …)
            // is identifiable from the toast and the console alone.
            const status = error instanceof ApiError ? error.status : undefined;
            const code = error instanceof ApiError ? error.code : "UNKNOWN";
            const message = error instanceof Error ? error.message : String(error);
            console.warn("[SSR-34] cart add failed", { status, code, message });
            const detail =
              error instanceof ApiError
                ? `${error.message} — Error ${error.code} (HTTP ${error.status})`
                : error instanceof Error
                  ? error.message
                  : "Please try again.";
            showToast("error", "Couldn't add to cart", detail);
            return false;
          }
        })();
        addInFlight.current = attempt;
        try {
          return await attempt;
        } finally {
          if (addInFlight.current === attempt) addInFlight.current = null;
        }
      },
      setQty: changeQty,
      removeFromCart: removeLine,
      clearCart: emptyCart,
      toggleWishlist: (slug) => favoriteMutation.mutate({ slug, wished: wishlist.includes(slug) }),
      isWishlisted: (slug) => wishlist.includes(slug),
      comparison: comparison.data ?? [],
      isCompared: (slug) => (comparison.data ?? []).includes(slug),
      toggleCompare: (slug) =>
        comparisonMutation.mutate({
          slug,
          compared: (comparison.data ?? []).includes(slug),
        }),
      saveForLater: (lineId) => {
        const line = cartDetail.find((entry) => entry.lineId === lineId);
        if (!line) return;
        setSaved((current) =>
          current.some((item) => item.slug === line.slug)
            ? current
            : [
                ...current,
                {
                  slug: line.slug,
                  name: line.name,
                  brand: line.brand,
                  category: line.category,
                  img: line.img,
                  price: line.unitPrice,
                  qty: line.qty,
                },
              ],
        );
        // Save-for-later stays localStorage-first for guests (SSR-35): the
        // parked copy is local, so the removal from the cart is local too.
        if (!authenticated) {
          setLocalCart((current) => current.filter((entry) => entry.slug !== line.slug));
          return;
        }
        cartMutation.mutate({ path: `/cart/lines/${lineId}`, method: "DELETE" });
      },
      moveSavedToCart: (slug) => {
        const item = saved.find((entry) => entry.slug === slug);
        if (!item) return;
        if (!authenticated) {
          // Guests append locally from the parked snapshot — zero network.
          setLocalCart((current) => {
            const existing = current.find((line) => line.slug === slug);
            if (existing) {
              return current.map((line) =>
                line.slug === slug
                  ? { ...line, quantity: Math.min(line.quantity + item.qty, CART_QTY_LIMIT) }
                  : line,
              );
            }
            return [
              ...current,
              {
                slug: item.slug,
                name: item.name,
                brand: item.brand,
                category: item.category,
                img: item.img,
                unitPriceMinor: Math.round(item.price * 100),
                quantity: item.qty,
                addedAt: Date.now(),
              },
            ];
          });
          setSaved((current) => current.filter((entry) => entry.slug !== slug));
          return;
        }
        cartMutation.mutate({
          path: "/cart/lines",
          method: "POST",
          body: { slug: item.slug, quantity: item.qty },
        });
        setSaved((current) => current.filter((entry) => entry.slug !== slug));
      },
      removeSaved: (slug) => setSaved((current) => current.filter((entry) => entry.slug !== slug)),
      cartOpen,
      // SSR-25 — if a quick-add is still in flight (e.g. product-detail's
      // un-awaited `addToCart(slug); openCart()` pair), defer opening until it
      // settles and only open on success; a failure surfaces as the toast
      // instead of an empty "Your cart (0)" drawer.
      openCart: () => {
        const inflight = addInFlight.current;
        if (!inflight) {
          setCartOpen(true);
          return;
        }
        void inflight.then((added) => {
          if (added) setCartOpen(true);
        });
      },
      closeCart: () => setCartOpen(false),
    };
  }, [
    authenticated,
    auth.isPending,
    cart.error,
    cart.isLoading,
    cartCount,
    cartDetail,
    cartLines,
    cartMutation,
    cartOpen,
    changeQty,
    comparison.data,
    comparisonMutation,
    emptyCart,
    favorites.error,
    favoriteMutation,
    localLoaded,
    queryClient,
    removeLine,
    saved,
    subtotal,
    wishlist,
  ]);

  return (
    <StoreContext.Provider value={value}>
      {children}
      {/* The one mini-cart instance (SF-04) — quick-add anywhere opens it. */}
      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        lines={cartDetail}
        subtotal={subtotal}
        itemCount={cartCount}
        pending={cartMutation.isPending}
        onQty={(lineId, qty) => {
          // Local lines key by slug; server rows resolve back to their slug so
          // ONE slug-based action pair serves both carts (SSR-35).
          const slug = cartDetail.find((line) => line.lineId === lineId)?.slug ?? "";
          if (qty <= 0) removeLine(slug);
          else changeQty(slug, Math.min(qty, CART_QTY_LIMIT));
        }}
        onRemove={(lineId) =>
          removeLine(cartDetail.find((line) => line.lineId === lineId)?.slug ?? "")
        }
      />
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used inside StoreProvider");
  return context;
}
