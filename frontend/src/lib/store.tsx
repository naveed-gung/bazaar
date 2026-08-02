import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, fromApiProduct, type CartDto } from "./api";
import type { Product } from "./products";

type StoreValue = {
  cartCount: number;
  cartLines: { product: Product; qty: number }[];
  subtotal: number;
  wishlist: string[];
  pending: boolean;
  error: string | null;
  addToCart: (slug: string, qty?: number) => void;
  setQty: (slug: string, qty: number) => void;
  removeFromCart: (slug: string) => void;
  clearCart: () => void;
  toggleWishlist: (slug: string) => void;
  isWishlisted: (slug: string) => boolean;
};

const StoreContext = createContext<StoreValue | null>(null);
const cartKey = ["cart"] as const;
const favoritesKey = ["favorites"] as const;

export function StoreProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const cart = useQuery({ queryKey: cartKey, queryFn: () => api<CartDto>("/cart"), retry: 2 });
  const favorites = useQuery({
    queryKey: favoritesKey,
    queryFn: () => api<{ slug: string }[]>("/favorites"),
    retry: 2,
  });
  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: cartKey });
  }, [queryClient]);
  const cartMutation = useMutation({
    mutationFn: ({ path, method, body }: { path: string; method: string; body?: unknown }) =>
      api<CartDto | void>(path, { method, ...(body ? { body: JSON.stringify(body) } : {}) }),
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

  const apiLines = useMemo(() => cart.data?.lines ?? [], [cart.data?.lines]);
  const cartLines = useMemo(
    () =>
      apiLines.map((line) => ({
        product: fromApiProduct(line.product),
        qty: line.quantity,
      })),
    [apiLines],
  );
  const wishlist = useMemo(() => (favorites.data ?? []).map((item) => item.slug), [favorites.data]);
  const value = useMemo<StoreValue>(() => {
    const lineForSlug = (slug: string) => apiLines.find((line) => line.product.slug === slug);
    return {
      cartCount: cart.data?.itemCount ?? 0,
      cartLines,
      subtotal: (cart.data?.subtotal.amountMinor ?? 0) / 100,
      wishlist,
      pending: cart.isPending || cartMutation.isPending || favoriteMutation.isPending,
      error:
        cart.error?.message ??
        cartMutation.error?.message ??
        favorites.error?.message ??
        favoriteMutation.error?.message ??
        null,
      addToCart: (slug, quantity = 1) =>
        cartMutation.mutate({ path: "/cart/lines", method: "POST", body: { slug, quantity } }),
      setQty: (slug, quantity) => {
        const line = lineForSlug(slug);
        if (!line) return;
        cartMutation.mutate({
          path: `/cart/lines/${line.lineId}`,
          method: quantity <= 0 ? "DELETE" : "PATCH",
          ...(quantity > 0 ? { body: { quantity } } : {}),
        });
      },
      removeFromCart: (slug) => {
        const line = lineForSlug(slug);
        if (line) cartMutation.mutate({ path: `/cart/lines/${line.lineId}`, method: "DELETE" });
      },
      clearCart: () => cartMutation.mutate({ path: "/cart", method: "DELETE" }),
      toggleWishlist: (slug) => favoriteMutation.mutate({ slug, wished: wishlist.includes(slug) }),
      isWishlisted: (slug) => wishlist.includes(slug),
    };
  }, [
    cart.data,
    cart.error,
    cart.isPending,
    apiLines,
    cartLines,
    cartMutation,
    favoriteMutation,
    favorites.error,
    wishlist,
  ]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used inside StoreProvider");
  return context;
}
