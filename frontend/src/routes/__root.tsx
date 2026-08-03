import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { RotateCcw, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

import appCss from "../styles.css?url";
import { StoreProvider } from "@/lib/store";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ShopAssistant } from "@/components/shop-assistant";

function NotFoundComponent() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-background px-6 py-20">
      <div className="max-w-md text-center">
        <p className="tabular text-[clamp(4rem,14vw,7rem)] font-extrabold leading-none tracking-tight text-glow">
          404
        </p>
        <h1 className="mt-6 text-2xl font-extrabold tracking-tight">Page not found</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/" className="btn btn-primary">
            Go home
          </Link>
          <Link to="/shop" className="btn btn-quiet">
            Browse the shop
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-background px-6 py-20">
      <div className="panel max-w-md p-8 text-center" role="alert">
        <span
          className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-border bg-background text-destructive"
          aria-hidden="true"
        >
          <TriangleAlert className="h-5 w-5" />
        </span>
        <h1 className="mt-6 text-xl font-extrabold tracking-tight">This page didn't load</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="btn btn-primary"
          >
            <RotateCcw className="h-4 w-4" />
            Try again
          </button>
          <a href="/" className="btn btn-quiet">
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Bazaar — Modern Commerce, Beautifully Simple" },
      {
        name: "description",
        content:
          "Bazaar redefines the e-commerce experience with cutting-edge technology and intuitive design for a seamless shopping journey.",
      },
      { name: "author", content: "Bazaar" },
      { property: "og:title", content: "Bazaar — Modern Commerce, Beautifully Simple" },
      {
        property: "og:description",
        content:
          "Bazaar redefines the e-commerce experience with cutting-edge technology and intuitive design.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap",
      },

      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),

  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{document.documentElement.classList.toggle('dark',localStorage.getItem('bazaar.theme')==='dark')}catch(e){}`,
          }}
        />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <StoreProvider>
        <div className="flex min-h-screen flex-col">
          <SiteHeader />
          <main className="flex-1">
            {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
            <Outlet />
          </main>
          <SiteFooter />
          <ShopAssistant />
        </div>
      </StoreProvider>
    </QueryClientProvider>
  );
}
