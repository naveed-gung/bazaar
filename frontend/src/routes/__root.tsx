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
import { ToastViewport } from "@/components/toast";
import { ConfirmDialogHost } from "@/components/confirm-dialog";
import { RouteTransitionCover, WelcomeScreen } from "@/components/welcome-screen";

function NotFoundComponent() {
  return (
    <div className="shell flex min-h-[70vh] flex-col justify-center py-20">
      {/* Oversized numeral — the one signal-red element on the page. */}
      <p className="price font-display text-display leading-none tracking-tight text-accent">404</p>
      <hr className="rule-strong mt-8" />
      <h1 className="font-display mt-8 text-2xl font-bold uppercase tracking-tight">
        Page not found
      </h1>
      <p className="measure mt-3 text-sm leading-relaxed text-muted-foreground">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link to="/" className="btn btn-primary">
          Go home
        </Link>
        <Link to="/shop" className="btn btn-quiet">
          Browse the shop
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="shell flex min-h-[70vh] items-center py-20">
      <div className="panel w-full max-w-xl p-8 lg:p-10" role="alert">
        <span
          className="grid h-12 w-12 place-items-center border border-destructive text-destructive"
          aria-hidden="true"
        >
          <TriangleAlert className="h-5 w-5" />
        </span>
        <h1 className="font-display mt-6 text-xl font-bold uppercase tracking-tight">
          This page didn't load
        </h1>
        <p className="measure mt-3 text-sm leading-relaxed text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
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
      // Self-hosted fonts — zero third-party requests. ONLY the display face is
      // preloaded (SSR-34 hygiene): Archivo renders every above-the-fold
      // headline/wordmark, so its preload is always consumed. The Instrument
      // Sans preload warned "preloaded but not used" whenever no body copy sat
      // above the fold; the @font-face declaration still loads it on first use,
      // so dropping the preload removes the warning and trims the critical
      // path without changing any rendered glyph.
      {
        rel: "preload",
        href: "/fonts/archivo-latin-var.woff2",
        as: "font",
        type: "font/woff2",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
      // SSR-27/E1 — Swiss mark: ink square, paper "B." (no .ico exists).
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
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
        {/* Inline, parser-blocking, PRE-hydration: (1) the theme flip and
            (2) SSR-56 rev2 — Netlify injects THREE foreign artifacts into
            <head> at serve time: the ai-legible HTML comment ("This site is
            hosted on Netlify…"), <meta name="hosting-provider">, and
            <meta name="netlify-deploy">. React 19 hydrates the React-managed
            head strictly; any unexpected element or comment sitting before
            its own head children aborts hydration with #418 and strips every
            event handler (the tree is regenerated client-side and hangs).
            The rev1 hotfix removed only netlify-deploy and #418 persisted —
            the live-HTML inventory plus an owner incognito test (extensions
            disabled, still failing) isolated the surviving hosting-provider
            meta and the leading comment as the remaining mismatch surface.
            All three are stripped here, before the hydration bundle executes.
            The splash itself is client-only (welcome-screen.tsx) and ships no
            markup in this payload. */}
        <script
          dangerouslySetInnerHTML={{
            __html: [
              "try{document.documentElement.classList.toggle('dark',localStorage.getItem('bazaar.theme')==='dark')}catch(e){}",
              'try{document.head.querySelectorAll(\'meta[name="netlify-deploy"],meta[name="hosting-provider"]\').forEach(function(m){m.remove()})}catch(e){}',
              "try{var h=document.head,i,n;for(i=h.childNodes.length-1;i>=0;i--){n=h.childNodes[i];if(n.nodeType===8&&/hosted on Netlify|netlify\\.new/i.test(n.textContent||''))n.remove()}}catch(e){}",
            ].join(""),
          }}
        />
        <HeadContent />
      </head>
      {/* E2 — extensions (e.g. ColorZilla) mutate <body> attributes before
          React hydrates; suppress the documented extension-only warning. */}
      <body suppressHydrationWarning>
        {/* SSR-32 — NO imperative splash scripts remain in <body>. The old
            body-start injection executed while the parser was still INSIDE
            <body> (body's only child at that moment was this very script), so
            its appendChild placed #bw-host BETWEEN the script and the app root
            div — inside React's hydration path — and hydration failed on every
            cold load. The splash is now the static SSR'd <WelcomeScreen />
            mounted in RootComponent below; see welcome-screen.tsx. */}
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
        <div className="flex min-h-dvh flex-col">
          {/* WCAG 2.4.1 — first focusable element on every page. */}
          <a href="#main" className="skip-link">
            Skip to content
          </a>
          <SiteHeader />
          {/* The one main landmark; routes render <section> inside it. */}
          <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
            {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
            <Outlet />
          </main>
          <SiteFooter />
          <ShopAssistant />
          {/* SSR-47 — full splash on document load; short cover on every
              page-to-page navigation (owner directive). */}
          <WelcomeScreen />
          <RouteTransitionCover />
          <ToastViewport />
          <ConfirmDialogHost />
        </div>
      </StoreProvider>
    </QueryClientProvider>
  );
}
