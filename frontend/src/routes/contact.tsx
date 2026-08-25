import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Mail, MessageSquare, MapPin } from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Reveal } from "@/components/motion";
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
      {/* 01 — Contact header */}
      <section className="shell pt-10 pb-12 lg:pt-14 lg:pb-16">
        <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: "Contact" }]} />
        <div className="rule-strong mt-8" />
        <div className="mt-6 flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
          <div className="max-w-3xl">
            <span className="eyebrow">01 — Contact</span>
            <h1 className="headline mt-4 text-[clamp(2.5rem,6vw,4.5rem)]">Talk to Us</h1>
          </div>
          <p className="measure max-w-md pb-2 text-sm leading-relaxed text-muted-foreground">
            Support answers within one business day, usually much faster.
          </p>
        </div>
      </section>

      {/* 02 Details · 03 Message — asymmetric 4/8 split */}
      <section className="shell pb-20 lg:pb-28">
        <div className="rule-strong" />
        <div className="mt-10 grid items-start gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-4">
            <span className="eyebrow">02 — Details</span>
            <ul className="mt-6 border-t border-border">
              {[
                { icon: Mail, title: "Email", value: "support@bazaar.store" },
                { icon: MessageSquare, title: "Live chat", value: "Available 24/7 in-app" },
                { icon: MapPin, title: "Studio", value: "14 Harbour Lane, Lisbon" },
              ].map(({ icon: Icon, title, value }, index) => (
                <li key={title} className="border-b border-border py-6">
                  {/* SSR-18 — same scroll-entry treatment as home's featured
                      section; rules stay static, each row fades up staggered.
                      The message form keeps its async states outside wrappers. */}
                  <Reveal delay={index * 70} className="flex items-start gap-5">
                    <span
                      className="grid h-11 w-11 shrink-0 place-items-center border border-border bg-surface text-foreground"
                      aria-hidden="true"
                    >
                      <Icon className="h-5 w-5" strokeWidth={1.6} />
                    </span>
                    <div className="min-w-0 pt-1.5">
                      <p className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">
                        {title}
                      </p>
                      <p className="mt-1 text-sm font-semibold">{value}</p>
                    </div>
                  </Reveal>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-8">
            <span className="eyebrow">03 — Message</span>
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
              className="panel mt-6 grid gap-6 p-7 sm:grid-cols-2 lg:p-9"
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
                  At least 10 characters. Include an order reference if the question is about an
                  order.
                </span>
              </label>
              {error && (
                <p
                  role="alert"
                  className="border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive sm:col-span-2"
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
          </div>
        </div>
      </section>
    </>
  );
}
