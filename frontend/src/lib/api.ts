import type { CartDto, ProductSummary } from "@bazaar/shared";
import type { Product } from "./products";
import { useQuery } from "@tanstack/react-query";

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
  variants?: { id: string; sku: string; name: string; availability: number }[];
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
  return {
    slug: product.slug,
    name: product.name,
    category: product.category,
    categorySlug: product.categorySlug,
    price: product.price.amountMinor / 100,
    ...(product.compareAtPrice ? { was: product.compareAtPrice.amountMinor / 100 } : {}),
    rating: product.rating,
    reviews: product.reviewCount,
    img: product.imageUrl,
    ...(product.motionUrl ? { motionUrl: product.motionUrl } : {}),
    availability: product.availability,
    ...(product.badge ? { badge: product.badge } : {}),
    blurb: product.blurb,
    specs:
      "specs" in product && Array.isArray(product.specs) ? (product.specs as Product["specs"]) : [],
  };
}

export type { CartDto };
