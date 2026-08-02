import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { PageHero } from "@/components/page-hero";
import { api } from "@/lib/api";
type Address = {
  id: string;
  label: string;
  fullName: string;
  address1: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};
export const Route = createFileRoute("/addresses")({ component: Addresses });
function Addresses() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["addresses"],
    queryFn: () => api<Address[]>("/me/addresses"),
  });
  async function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.currentTarget));
    await api("/me/addresses", { method: "POST", body: JSON.stringify(body) });
    event.currentTarget.reset();
    await client.invalidateQueries({ queryKey: ["addresses"] });
  }
  async function remove(id: string) {
    await api(`/me/addresses/${id}`, { method: "DELETE" });
    await client.invalidateQueries({ queryKey: ["addresses"] });
  }
  return (
    <>
      <PageHero
        eyebrow="Account"
        title="Addresses"
        copy="Manage saved delivery addresses for your signed-in account."
      />
      <section className="mx-auto grid max-w-[1100px] gap-8 px-6 py-16 lg:grid-cols-2">
        <div className="space-y-4">
          {query.error && (
            <p role="alert" className="text-destructive">
              {query.error.message}
            </p>
          )}
          {query.data?.map((address) => (
            <article key={address.id} className="rounded-2xl border border-border bg-surface p-6">
              <h2 className="font-bold">{address.label}</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {address.fullName}
                <br />
                {address.address1}
                <br />
                {address.city}, {address.state} {address.postalCode}
                <br />
                {address.country}
              </p>
              <button
                onClick={() => void remove(address.id)}
                className="mt-4 min-h-11 text-sm text-destructive underline"
              >
                Remove
              </button>
            </article>
          ))}
        </div>
        <form
          onSubmit={add}
          className="grid h-fit gap-4 rounded-2xl border border-border bg-surface p-7 sm:grid-cols-2"
        >
          {["label", "fullName", "address1", "city", "state", "postalCode", "country"].map(
            (name) => (
              <label key={name} className="text-sm">
                <span className="capitalize text-muted-foreground">
                  {name.replace(/([A-Z])/g, " $1")}
                </span>
                <input
                  name={name}
                  required
                  className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3"
                />
              </label>
            ),
          )}
          <button className="min-h-11 rounded-xl bg-signal px-5 text-sm font-semibold text-signal-foreground sm:col-span-2">
            Add address
          </button>
        </form>
      </section>
    </>
  );
}
