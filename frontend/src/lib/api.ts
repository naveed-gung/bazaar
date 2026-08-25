import type {
  CartDto,
  CatalogResponse,
  ProductSummary,
  ReviewDto,
  ReviewSummaryDto,
  ShippingMethodDto,
  SuggestionDto,
} from "@bazaar/shared";
import type { Product } from "./products";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const API_BASE = import.meta.env["VITE_API_BASE_URL"] || "/api/v1";

function cookie(name: string) {
  if (typeof document === "undefined") return "";
  return (
    document.cookie
      .split("; ")
      .find((part) => part.startsWith(`${name}=`))
      ?.split("=")
      .slice(1)
      .join("=") ?? ""
  );
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(
  path: string,
  init: RequestInit = {},
  retriedGuest = false,
  retriedSession = false,
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("content-type", "application/json");
  const csrf = cookie("bazaar_csrf");
  if (csrf) headers.set("x-csrf-token", decodeURIComponent(csrf));
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers, credentials: "include" });
  if (!response.ok) {
    const problem = (await response.json().catch(() => null)) as {
      code?: string;
      detail?: string;
    } | null;
    if (problem?.code === "GUEST_SESSION_EXPIRED" && !retriedGuest) {
      return api<T>(path, init, true, retriedSession);
    }
    if (problem?.code === "SESSION_INVALID" && path !== "/auth/refresh" && !retriedSession) {
      await api("/auth/refresh", { method: "POST" }, retriedGuest, true);
      return api<T>(path, init, retriedGuest, true);
    }
    throw new ApiError(
      response.status,
      problem?.code ?? "REQUEST_FAILED",
      problem?.detail ?? "The request failed.",
    );
  }
  if (response.status === 204) return undefined as T;
  return ((await response.json()) as { data: T }).data;
}

export type CatalogProduct = ProductSummary & {
  specs?: { label: string; value: string }[];
};

export type CatalogCategory = { id: string; slug: string; name: string; imageUrl: string };

export function useCatalogProducts(params: Record<string, string | undefined> = {}) {
  const search = new URLSearchParams(
    Object.entries(params).filter((entry): entry is [string, string] => Boolean(entry[1])),
  ).toString();
  return useQuery({
    queryKey: ["catalog-products", params],
    queryFn: () =>
      api<{ items: CatalogProduct[]; total: number }>(
        `/catalog/products${search ? `?${search}` : ""}`,
      ),
  });
}

export function useCatalogCategories() {
  return useQuery({
    queryKey: ["catalog-categories"],
    queryFn: () => api<CatalogCategory[]>("/catalog/categories"),
  });
}

export type AuthStatus = {
  authenticated: boolean;
  refreshable: boolean;
  principal: { id: string; permissions: string[] } | null;
  firebaseConfigured: boolean;
};

export function useAuthStatus() {
  return useQuery({
    queryKey: ["auth-status"],
    queryFn: async () => {
      const status = await api<AuthStatus>("/auth/status");
      if (!status.authenticated && status.refreshable) {
        try {
          await api("/auth/refresh", { method: "POST" });
          return api<AuthStatus>("/auth/status");
        } catch {
          return status;
        }
      }
      return status;
    },
    staleTime: 30_000,
    retry: 1,
  });
}

export function fromApiProduct(product: ProductSummary): Product {
  const firstOption = product.options[0];
  return {
    slug: product.slug,
    name: product.name,
    brand: product.brand,
    category: product.category,
    categorySlug: product.categorySlug,
    price: product.price.amountMinor / 100,
    ...(product.compareAtPrice ? { was: product.compareAtPrice.amountMinor / 100 } : {}),
    rating: product.rating,
    reviews: product.reviewCount,
    img: product.imageUrl,
    availability: product.availability,
    ...(product.badge ? { badge: product.badge } : {}),
    blurb: product.blurb,
    specs:
      "specs" in product && Array.isArray(product.specs) ? (product.specs as Product["specs"]) : [],
    priceMin: product.priceRange.min.amountMinor / 100,
    priceMax: product.priceRange.max.amountMinor / 100,
    images: product.images.map((image) => ({
      url: image.url,
      sources: image.sources,
      alt: image.alt,
    })),
    ...(firstOption ? { swatchName: firstOption.name, swatches: firstOption.values } : {}),
  };
}

export type { CartDto };

/* ------------------------------------------------------------------ */
/* Wave 2C storefront hooks — facets, suggest, reviews, viewed, stock. */
/* ------------------------------------------------------------------ */

/** Full faceted listing (API-01): page + facets in one response. */
export function useCatalogFacets(params: Record<string, string | string[] | undefined> = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    for (const entry of Array.isArray(value) ? value : [value]) {
      if (entry !== "") search.append(key, entry);
    }
  }
  const qs = search.toString();
  return useQuery({
    queryKey: ["catalog-facets", qs],
    queryFn: () => api<CatalogResponse>(`/catalog/products${qs ? `?${qs}` : ""}`),
    placeholderData: (previous) => previous,
  });
}

/** GET /catalog/suggest (API-02). The caller debounces; this only queries. */
export function useSuggestions(query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: ["catalog-suggest", trimmed.toLowerCase()],
    queryFn: () => api<SuggestionDto[]>(`/catalog/suggest?q=${encodeURIComponent(trimmed)}`),
    enabled: trimmed.length >= 2,
    staleTime: 15_000,
  });
}

export type ShippingMethod = ShippingMethodDto;

export function useShippingMethods(enabled = true) {
  return useQuery({
    queryKey: ["shipping-methods"],
    queryFn: () => api<ShippingMethod[]>("/orders/shipping-methods"),
    enabled,
    staleTime: 5 * 60_000,
  });
}

export type ReviewsEnvelope = { reviews: ReviewDto[]; summary: ReviewSummaryDto };

/** Reviews carry `meta.summary` beside `data`, so this reads the raw envelope. */
export function useProductReviews(slug: string) {
  return useQuery({
    queryKey: ["product-reviews", slug],
    queryFn: async (): Promise<ReviewsEnvelope> => {
      const response = await fetch(
        `${import.meta.env["VITE_API_BASE_URL"] || "/api/v1"}/products/${encodeURIComponent(slug)}/reviews`,
        { credentials: "include" },
      );
      if (!response.ok) throw new Error("Reviews could not be loaded.");
      const body = (await response.json()) as {
        data: ReviewDto[];
        meta?: { summary?: ReviewSummaryDto };
      };
      return {
        reviews: body.data,
        summary:
          body.meta?.summary ??
          ({
            rating: 0,
            reviewCount: 0,
            distribution: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 },
          } as ReviewSummaryDto),
      };
    },
  });
}

export function useReviewVote(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ reviewId, helpful }: { reviewId: string; helpful: boolean }) =>
      api<{ helpfulCount: number; votedHelpful: boolean }>(`/reviews/${reviewId}/vote`, {
        method: "POST",
        body: JSON.stringify({ helpful }),
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["product-reviews", slug] }),
  });
}

export function useRecentlyViewed(excludeSlug?: string) {
  const search = excludeSlug ? `?exclude=${encodeURIComponent(excludeSlug)}` : "";
  return useQuery({
    queryKey: ["recently-viewed", excludeSlug ?? ""],
    queryFn: () => api<ProductSummary[]>(`/viewed${search}`),
    staleTime: 10_000,
  });
}

/** Fire-and-forget view recording — failures must never disturb the page. */
export function useRecordViewed() {
  return useMutation({
    mutationFn: (slug: string) =>
      api<void>("/viewed", { method: "POST", body: JSON.stringify({ slug }) }),
    retry: false,
  });
}

export function registerStockAlert(slug: string, body: { variantId?: string; email?: string }) {
  return api<{ id: string; state: string }>(
    `/admin/products/${encodeURIComponent(slug)}/stock-alert`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}

export type SavedAddress = {
  id: string;
  label?: string;
  fullName: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

export function useSavedAddresses(enabled: boolean) {
  return useQuery({
    queryKey: ["saved-addresses"],
    queryFn: () => api<SavedAddress[]>("/me/addresses"),
    enabled,
    staleTime: 60_000,
  });
}

/* ------------------------------------------------------------------ */
/* Account profile (SSR-21) — phone, avatar, marketing consent.        */
/* ------------------------------------------------------------------ */

export type AccountProfile = {
  email: string | null;
  displayName: string | null;
  phone: string | null;
  marketingConsent: boolean;
  photoDataUrl: string | null;
  /** Present only when the backend could reach the Firebase Admin SDK. */
  emailVerified?: boolean;
};

export function useProfile(enabled = true) {
  return useQuery({
    queryKey: ["profile"],
    queryFn: () => api<AccountProfile>("/me/profile"),
    enabled,
    staleTime: 30_000,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { phone?: string; marketingConsent?: boolean }) =>
      api<AccountProfile>("/me/profile", { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["profile"] }),
  });
}

export function useUploadAvatar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (imageBase64: string) =>
      api<{ photoDataUrl: string }>("/me/avatar", {
        method: "PUT",
        body: JSON.stringify({ imageBase64 }),
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["profile"] }),
  });
}

export function useDeleteAvatar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>("/me/avatar", { method: "DELETE" }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["profile"] }),
  });
}
