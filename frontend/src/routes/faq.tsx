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
    a: "Free on every order of $50 or more. Below that, standard shipping is a flat $7.99, calculated server-side at checkout.",
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
    a: "Checkout currently runs a clearly labeled payment simulator: no card numbers are collected and no real charge is made. Live card, wallet and PayPal support arrives with the production payment provider.",
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
        <div className="divide-y divide-border overflow-hidden rounded-3xl border border-border bg-surface">
          {faqs.map((item, index) => {
            const expanded = open === index;
            return (
              <div key={item.q}>
                <h2>
                  <button
                    type="button"
                    id={`faq-trigger-${index}`}
                    aria-expanded={expanded}
                    aria-controls={`faq-panel-${index}`}
                    onClick={() => setOpen(expanded ? null : index)}
                    className="flex w-full cursor-pointer items-center justify-between gap-6 px-6 py-6 text-left transition-colors hover:bg-surface-2 sm:px-8"
                  >
                    <span className="min-w-0 font-bold">{item.q}</span>
                    <span
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border bg-background"
                      aria-hidden="true"
                    >
                      {expanded ? (
                        <Minus className="h-4 w-4 text-glow" />
                      ) : (
                        <Plus className="h-4 w-4 text-muted-foreground" />
                      )}
                    </span>
                  </button>
                </h2>
                {/* Grid-rows trick animates height without measuring the panel. */}
                <div
                  id={`faq-panel-${index}`}
                  role="region"
                  aria-labelledby={`faq-trigger-${index}`}
                  aria-hidden={!expanded}
                  className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                    expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                  }`}
                >
                  <p className="overflow-hidden px-6 text-sm leading-relaxed text-muted-foreground sm:px-8">
                    <span className="block pb-7">{item.a}</span>
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
