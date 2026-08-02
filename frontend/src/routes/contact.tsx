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
              <Icon className="mt-1 h-6 w-6 shrink-0 text-glow" strokeWidth={1.5} />
              <div className="min-w-0">
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
          className="grid gap-6 rounded-3xl border border-border bg-surface p-9 sm:grid-cols-2"
        >
          <label className="block text-sm">
            <span className="text-muted-foreground">Name</span>
            <input
              name="name"
              required
              className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3.5 text-sm outline-none focus:border-signal"
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted-foreground">Email</span>
            <input
              name="email"
              required
              type="email"
              className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3.5 text-sm outline-none focus:border-signal"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="text-muted-foreground">Message</span>
            <textarea
              name="message"
              required
              minLength={10}
              rows={6}
              className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3.5 text-sm outline-none focus:border-signal"
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-destructive sm:col-span-2">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="rounded-xl bg-signal px-7 py-4 text-sm font-semibold text-signal-foreground disabled:opacity-50 sm:col-span-2"
          >
            {pending ? "Sending…" : sent ? "Message sent — thank you" : "Send message"}
          </button>
        </form>
      </section>
    </>
  );
}
