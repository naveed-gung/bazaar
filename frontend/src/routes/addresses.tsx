import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { MapPin, Trash2 } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { EmptyState, Skeleton } from "@/components/ui";
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
export const Route = createFileRoute("/addresses")({
  head: () => ({
    meta: [
      { title: "Addresses — Bazaar" },
      { name: "description", content: "Manage saved delivery addresses for your Bazaar account." },
    ],
  }),
  component: Addresses,
});

/** `.field` is the shared input recipe from styles.css; mt-2 is local spacing. */
const FIELD = "field mt-2";

/* Explicit labels + autocomplete tokens: the browser can fill the whole form and
   the labels read like words instead of camelCase field names. */
const FIELDS = [
  { name: "label", label: "Label", autoComplete: "off", wide: false },
  { name: "fullName", label: "Full name", autoComplete: "name", wide: false },
  { name: "address1", label: "Street address", autoComplete: "address-line1", wide: true },
  { name: "city", label: "City", autoComplete: "address-level2", wide: false },
  { name: "state", label: "State / region", autoComplete: "address-level1", wide: false },
  { name: "postalCode", label: "Postal code", autoComplete: "postal-code", wide: false },
  { name: "country", label: "Country", autoComplete: "country-name", wide: false },
] as const;

function Addresses() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["addresses"],
    queryFn: () => api<Address[]>("/me/addresses"),
  });
  async function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = Object.fromEntries(new FormData(form));
    await api("/me/addresses", { method: "POST", body: JSON.stringify(body) });
    form.reset();
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
      <section className="mx-auto grid max-w-275 gap-8 px-6 py-16 lg:grid-cols-2">
        <div className="space-y-4">
          {query.isPending ? (
            <div className="space-y-4" aria-busy="true">
              {Array.from({ length: 2 }).map((_, index) => (
                <Skeleton key={index} className="h-48 w-full rounded-2xl" />
              ))}
            </div>
          ) : query.error ? (
            <p role="alert" className="text-sm text-destructive">
              {query.error.message}
            </p>
          ) : !query.data?.length ? (
            <EmptyState
              icon={<MapPin className="h-6 w-6" />}
              title="No saved addresses"
              copy="Add one on the right and checkout can reuse it on every future order."
            />
          ) : (
            query.data.map((address) => (
              <article key={address.id} className="panel p-6">
                <div className="flex items-start justify-between gap-4">
                  <h2 className="font-bold">{address.label}</h2>
                  <button
                    type="button"
                    onClick={() => void remove(address.id)}
                    className="btn btn-ghost btn-sm text-destructive"
                    aria-label={`Remove address ${address.label}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Remove
                  </button>
                </div>
                <address className="mt-3 text-sm not-italic leading-6 text-muted-foreground">
                  {address.fullName}
                  <br />
                  {address.address1}
                  <br />
                  {address.city}, {address.state} {address.postalCode}
                  <br />
                  {address.country}
                </address>
              </article>
            ))
          )}
        </div>
        <form onSubmit={add} className="panel grid h-fit gap-5 p-7 sm:grid-cols-2 lg:p-9">
          <h2 className="text-lg font-bold tracking-tight sm:col-span-2">Add an address</h2>
          {FIELDS.map((field) => (
            <label
              key={field.name}
              className={`block text-sm ${field.wide ? "sm:col-span-2" : ""}`}
            >
              <span className="font-medium">
                {field.label}
                <span className="ml-1 text-destructive" aria-hidden="true">
                  *
                </span>
              </span>
              <input
                name={field.name}
                required
                autoComplete={field.autoComplete}
                inputMode={field.name === "postalCode" ? "numeric" : undefined}
                className={FIELD}
              />
            </label>
          ))}
          <div className="border-t border-border pt-6 sm:col-span-2">
            <button className="btn btn-primary">Add address</button>
          </div>
        </form>
      </section>
    </>
  );
}
