import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Mail, MessageSquare, MapPin } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { api } from "@/lib/api";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact Bazaar — Support & Enquiries" },
      {
        name: "description",
        content: "Reach the Bazaar support team about orders, returns, or partnership enquiries.",
      },
      { property: "og:title", content: "Contact Bazaar" },
      { property: "og:description", content: "Get in touch with the Bazaar team." },
    ],
  }),
  component: Contact,
});

/** `.field` is the shared input recipe from styles.css; mt-2 is local spacing. */
const FIELD = "field mt-2";

function Contact() {
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="Talk to us"
        copy="Support answers within one business day, usually much faster."
      />
      <section className="mx-auto grid max-w-[1600px] gap-12 px-6 py-16 lg:grid-cols-[1fr_1.3fr] lg:px-10 lg:py-24">
        <div className="space-y-8">
          {[
            { icon: Mail, title: "Email", value: "support@bazaar.store" },
            { icon: MessageSquare, title: "Live chat", value: "Available 24/7 in-app" },
            { icon: MapPin, title: "Studio", value: "14 Harbour Lane, Lisbon" },
          ].map(({ icon: Icon, title, value }) => (
            <div key={title} className="flex items-start gap-5">
              <span
                className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-border bg-surface text-glow"
                aria-hidden="true"
              >
                <Icon className="h-5 w-5" strokeWidth={1.6} />
              </span>
              <div className="min-w-0 pt-1.5">
                <p className="font-bold">{title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{value}</p>
              </div>
            </div>
          ))}
        </div>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setPending(true);
            setError("");
            const data = new FormData(e.currentTarget);
            try {
              await api("/contact", {
                method: "POST",
                body: JSON.stringify({
                  name: data.get("name"),
                  email: data.get("email"),
                  subject: "Website support request",
                  message: data.get("message"),
                }),
              });
              setSent(true);
              e.currentTarget.reset();
            } catch (caught) {
              setError(caught instanceof Error ? caught.message : "Message could not be sent.");
            } finally {
              setPending(false);
            }
          }}
          className="panel grid gap-6 p-7 sm:grid-cols-2 lg:p-9"
        >
          <label className="block text-sm">
            <span className="font-medium">
              Name
              <span className="ml-1 text-destructive" aria-hidden="true">
                *
              </span>
            </span>
            <input name="name" required autoComplete="name" className={FIELD} />
          </label>
          <label className="block text-sm">
            <span className="font-medium">
              Email
              <span className="ml-1 text-destructive" aria-hidden="true">
                *
              </span>
            </span>
            <input name="email" required type="email" autoComplete="email" className={FIELD} />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium">
              Message
              <span className="ml-1 text-destructive" aria-hidden="true">
                *
              </span>
            </span>
            <textarea
              name="message"
              required
              minLength={10}
              rows={6}
              aria-describedby="message-help"
              className={`${FIELD} min-h-32 py-3.5`}
            />
            <span id="message-help" className="field-help">
              At least 10 characters. Include an order reference if the question is about an order.
            </span>
          </label>
          {error && (
            <p
              role="alert"
              className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive sm:col-span-2"
            >
              {error}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
            <button type="submit" disabled={pending} className="btn btn-primary btn-lg">
              {pending ? "Sending…" : "Send message"}
            </button>
            {sent && !pending && (
              <p className="text-sm font-semibold text-positive" aria-live="polite">
                Message sent — we'll reply within one business day.
              </p>
            )}
          </div>
        </form>
      </section>
    </>
  );
}
