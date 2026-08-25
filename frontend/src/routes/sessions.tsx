import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Laptop, ShieldCheck } from "lucide-react";
import { AccountLayout } from "@/routes/account";
import { EmptyState, Pill, Skeleton } from "@/components/ui";
import { api } from "@/lib/api";

type Session = {
  id: string;
  current: boolean;
  userAgent?: string;
  lastSeenAt: string;
  expiresAt: string;
};

export const Route = createFileRoute("/sessions")({
  head: () => ({
    meta: [
      { title: "Active sessions — Bazaar" },
      {
        name: "description",
        content: "Review and revoke devices authenticated with your account.",
      },
    ],
  }),
  component: Sessions,
});

function Sessions() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["sessions"], queryFn: () => api<Session[]>("/me/sessions") });
  /* Two-step confirm instead of a native dialog: revoking every other device is
     destructive, so the second click is the one that acts. */
  const [confirming, setConfirming] = useState(false);
  async function revoke(id: string) {
    await api(`/me/sessions/${id}`, { method: "DELETE" });
    await client.invalidateQueries({ queryKey: ["sessions"] });
  }
  async function revokeOthers() {
    await api("/me/sessions", { method: "DELETE" });
    setConfirming(false);
    await client.invalidateQueries({ queryKey: ["sessions"] });
  }
  const others = query.data?.filter((session) => !session.current).length ?? 0;
  return (
    <AccountLayout
      active="/sessions"
      title="Active Sessions"
      copy="Review and revoke devices authenticated with your Bazaar account."
    >
      <div className="space-y-8">
        <div className="panel flex flex-wrap items-center justify-between gap-4 p-5">
          <p className="flex items-center gap-2.5 text-sm text-muted-foreground">
            <ShieldCheck className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
            {others === 0
              ? "This is the only signed-in device."
              : `${others} other ${others === 1 ? "device is" : "devices are"} signed in.`}
          </p>
          {others > 0 &&
            (confirming ? (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => void revokeOthers()}
                  className="btn btn-danger btn-sm"
                >
                  Confirm sign out
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="btn btn-ghost btn-sm"
                >
                  Keep them
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="btn btn-quiet btn-sm"
              >
                Sign out other devices
              </button>
            ))}
        </div>

        {query.isPending ? (
          <div className="space-y-4" aria-busy="true">
            {Array.from({ length: 2 }).map((_, index) => (
              <Skeleton key={index} className="h-32 w-full" />
            ))}
          </div>
        ) : query.error ? (
          <p role="alert" className="text-sm text-destructive">
            {query.error.message}
          </p>
        ) : !query.data?.length ? (
          <EmptyState
            icon={<Laptop className="h-6 w-6" />}
            title="No active sessions"
            copy="Sign in to see the devices holding a Bazaar session."
          />
        ) : (
          /* Session rows — hairline-divided, last-seen + expiry tabular, revoke
             disabled on the current device (sign-out lives in the header). */
          <ul className="divide-y divide-border border-y border-border">
            {query.data.map((session) => (
              <li key={session.id} className="py-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-sm font-bold">
                        {session.current ? "This device" : "Other device"}
                      </h2>
                      {session.current && <Pill tone="positive">Active now</Pill>}
                    </div>
                    <p className="mt-2 break-all text-sm text-muted-foreground">
                      {session.userAgent ?? "Unknown device"}
                    </p>
                    <p className="tabular mt-1.5 text-xs text-muted-foreground">
                      Last used {new Date(session.lastSeenAt).toLocaleString("en-US")} · expires{" "}
                      {new Date(session.expiresAt).toLocaleDateString("en-US")}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={session.current}
                    onClick={() => void revoke(session.id)}
                    className="btn btn-ghost btn-sm shrink-0 text-destructive"
                  >
                    Revoke
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AccountLayout>
  );
}
