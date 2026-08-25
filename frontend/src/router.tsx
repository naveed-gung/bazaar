import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    /* SSR-56 root cause — component-level useQuery calls executed during SSR,
       so the server streamed DATA rows while the client's fresh cache started
       PENDING (skeletons). When dehydrated payloads landed mid-hydration the
       skeleton→rows swap aborted hydration with React #418 and froze the page.
       Queries are now CLIENT-ONLY: SSR and the first client render agree on
       skeletons everywhere, data arrives strictly post-hydration, and the
       four-branch async convention still governs what users see. Mutations are
       unaffected. */
    defaultOptions: {
      queries: {
        enabled: typeof document !== "undefined",
        staleTime: 30_000,
        retry: 2,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
