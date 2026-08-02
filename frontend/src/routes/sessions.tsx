import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { PageHero } from "@/components/page-hero";
import { api } from "@/lib/api";
type Session = {
  id: string;
  current: boolean;
  userAgent?: string;
  lastSeenAt: string;
  expiresAt: string;
};
export const Route = createFileRoute("/sessions")({ component: Sessions });
function Sessions() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["sessions"], queryFn: () => api<Session[]>("/me/sessions") });
  async function revoke(id: string) {
    await api(`/me/sessions/${id}`, { method: "DELETE" });
    await client.invalidateQueries({ queryKey: ["sessions"] });
  }
  async function revokeOthers() {
    await api("/me/sessions", { method: "DELETE" });
    await client.invalidateQueries({ queryKey: ["sessions"] });
  }
  return (
    <>
      <PageHero
        eyebrow="Security"
        title="Active sessions"
        copy="Review and revoke devices authenticated with your Bazaar account."
      />
      <section className="mx-auto max-w-3xl space-y-4 px-6 py-16">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => void revokeOthers()}
            className="min-h-11 rounded-xl border border-border px-5 text-sm font-semibold hover:border-signal"
          >
            Sign out other devices
          </button>
        </div>
        {query.error && (
          <p role="alert" className="text-destructive">
            {query.error.message}
          </p>
        )}
        {query.data?.map((session) => (
          <article key={session.id} className="rounded-2xl border border-border bg-surface p-6">
            <div className="flex justify-between gap-4">
              <div>
                <h2 className="font-bold">
                  {session.current ? "Current session" : "Other session"}
                </h2>
                <p className="mt-2 break-all text-sm text-muted-foreground">
                  {session.userAgent ?? "Unknown device"}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Last used {new Date(session.lastSeenAt).toLocaleString()}
                </p>
              </div>
              <button
                disabled={session.current}
                onClick={() => void revoke(session.id)}
                className="min-h-11 shrink-0 text-sm text-destructive underline disabled:opacity-40"
              >
                Revoke
              </button>
            </div>
          </article>
        ))}
      </section>
    </>
  );
}
