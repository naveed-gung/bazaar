import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Minus } from "lucide-react";
import { PageHero } from "@/components/page-hero";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQ — Shipping, Returns & Warranty | Bazaar" },
      {
        name: "description",
        content:
          "Answers to common Bazaar questions about shipping, returns, warranty and payment.",
      },
      { property: "og:title", content: "Bazaar FAQ" },
      { property: "og:description", content: "Shipping, returns, warranty and payment answers." },
    ],
  }),
  component: Faq,
});

const faqs = [
  {
    q: "How fast is delivery?",
    a: "Metro orders arrive in about 48 hours. Everything else ships within 3–5 business days, tracked end to end.",
  },
  {
    q: "Is shipping really free?",
    a: "Free on every order over $50. Below that, standard shipping is a flat $9.",
  },
  {
    q: "What is the return window?",
    a: "30 days from delivery, unused and in original packaging. We cover the return label.",
  },
  {
    q: "Do products include a warranty?",
    a: "Every device carries a two-year warranty handled directly by our support team.",
  },
  {
    q: "Which payment methods work?",
    a: "All major cards, Apple Pay, Google Pay and PayPal. Card details are never stored on our side.",
  },
  {
    q: "Can I change an order after placing it?",
    a: "Yes, until it's marked as packed. Message support with your order reference and we'll adjust it.",
  },
];

function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <>
      <PageHero
        eyebrow="FAQ"
        title="Frequently asked questions"
        copy="The things people ask us most, answered plainly."
      />
      <section className="mx-auto max-w-3xl px-6 py-16 lg:py-24">
        <div className="divide-y divide-border rounded-3xl border border-border bg-surface">
          {faqs.map((item, i) => (
            <div key={item.q}>
              <button
                type="button"
                onClick={() => setOpen(open === i ? null : i)}
                className="flex w-full items-center justify-between gap-6 px-8 py-6 text-left"
              >
                <span className="min-w-0 font-bold">{item.q}</span>
                {open === i ? (
                  <Minus className="h-4 w-4 shrink-0 text-glow" />
                ) : (
                  <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
              </button>
              {open === i && (
                <p className="px-8 pb-7 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
              )}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
