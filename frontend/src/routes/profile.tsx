import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHero } from "@/components/page-hero";
import { api } from "@/lib/api";
type Profile = { email: string; displayName?: string; phone?: string };
export const Route = createFileRoute("/profile")({ component: ProfilePage });
function ProfilePage() {
  const client = useQueryClient();
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => api<Profile>("/me") });
  const [status, setStatus] = useState("");
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      await api("/me", {
        method: "PATCH",
        body: JSON.stringify({ displayName: data.get("displayName"), phone: data.get("phone") }),
      });
      setStatus("Profile saved.");
      await client.invalidateQueries({ queryKey: ["profile"] });
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : "Save failed.");
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
        {profile.error ? (
          <p role="alert" className="text-destructive">
            {profile.error.message}
          </p>
        ) : (
          <form
            onSubmit={save}
            className="space-y-5 rounded-2xl border border-border bg-surface p-8"
          >
            <label className="block text-sm">
              <span className="text-muted-foreground">Email</span>
              <input
                disabled
                value={profile.data?.email ?? ""}
                className="mt-2 min-h-11 w-full rounded-xl border border-border bg-muted px-4"
              />
            </label>
            <label className="block text-sm">
              <span className="text-muted-foreground">Display name</span>
              <input
                name="displayName"
                required
                minLength={2}
                defaultValue={profile.data?.displayName ?? ""}
                className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-4"
              />
            </label>
            <label className="block text-sm">
              <span className="text-muted-foreground">Phone</span>
              <input
                name="phone"
                defaultValue={profile.data?.phone ?? ""}
                className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-4"
              />
            </label>
            <button className="min-h-11 rounded-xl bg-signal px-6 text-sm font-semibold text-signal-foreground">
              Save profile
            </button>
            {status && (
              <p aria-live="polite" className="text-sm text-muted-foreground">
                {status}
              </p>
            )}
          </form>
        )}
      </section>
    </>
  );
}
