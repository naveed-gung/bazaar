import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHero } from "@/components/page-hero";
import { Skeleton } from "@/components/ui";
import { api } from "@/lib/api";
type Profile = { email: string; displayName?: string; phone?: string };
export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — Bazaar" },
      {
        name: "description",
        content: "Update the personal details attached to your Bazaar account.",
      },
    ],
  }),
  component: ProfilePage,
});

/** `.field` is the shared input recipe from styles.css; mt-2 is local spacing. */
const FIELD = "field mt-2";

function ProfilePage() {
  const client = useQueryClient();
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => api<Profile>("/me") });
  const [status, setStatus] = useState("");
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState(false);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setStatus("");
    const data = new FormData(event.currentTarget);
    try {
      await api("/me", {
        method: "PATCH",
        body: JSON.stringify({ displayName: data.get("displayName"), phone: data.get("phone") }),
      });
      setFailed(false);
      setStatus("Profile saved.");
      await client.invalidateQueries({ queryKey: ["profile"] });
    } catch (caught) {
      setFailed(true);
      setStatus(caught instanceof Error ? caught.message : "Save failed.");
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <PageHero
        eyebrow="Account"
        title="Profile"
        copy="Update the personal details attached to your authenticated account."
      />
      <section className="mx-auto max-w-xl px-6 py-16">
        {profile.isPending ? (
          <Skeleton className="h-96 w-full rounded-2xl" />
        ) : profile.error ? (
          <p role="alert" className="text-sm text-destructive">
            {profile.error.message}
          </p>
        ) : (
          <form onSubmit={save} className="panel space-y-5 p-7 lg:p-9">
            <label className="block text-sm">
              <span className="font-medium text-muted-foreground">Email</span>
              <input
                disabled
                value={profile.data?.email ?? ""}
                aria-describedby="email-help"
                className={FIELD}
              />
              <span id="email-help" className="field-help">
                Managed by your sign-in provider and cannot be edited here.
              </span>
            </label>
            <label className="block text-sm">
              <span className="font-medium">
                Display name
                <span className="ml-1 text-destructive" aria-hidden="true">
                  *
                </span>
              </span>
              <input
                name="displayName"
                required
                minLength={2}
                autoComplete="name"
                defaultValue={profile.data?.displayName ?? ""}
                className={FIELD}
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium">Phone</span>
              <input
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                defaultValue={profile.data?.phone ?? ""}
                className={FIELD}
              />
            </label>
            <div className="flex flex-wrap items-center gap-4 border-t border-border pt-6">
              <button disabled={pending} className="btn btn-primary">
                {pending ? "Saving…" : "Save profile"}
              </button>
              {status && (
                <p
                  aria-live="polite"
                  className={`text-sm font-semibold ${failed ? "text-destructive" : "text-positive"}`}
                >
                  {status}
                </p>
              )}
            </div>
          </form>
        )}
      </section>
    </>
  );
}
