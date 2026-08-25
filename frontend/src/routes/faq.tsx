import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Breadcrumbs } from "@/components/breadcrumbs";

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
      {/* 01 — FAQ header */}
      <section className="shell pt-10 pb-12 lg:pt-14 lg:pb-16">
        <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: "FAQ" }]} />
        <div className="rule-strong mt-8" />
        <div className="mt-6 flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
          <div className="max-w-3xl">
            <span className="eyebrow">01 — FAQ</span>
            <h1 className="headline mt-4 text-[clamp(2.5rem,6vw,4.5rem)]">
              Frequently Asked Questions
            </h1>
          </div>
          <p className="measure max-w-md pb-2 text-sm leading-relaxed text-muted-foreground">
            The things people ask us most, answered plainly.
          </p>
        </div>
      </section>

      {/* 02 — Keyboard-operable disclosures over rules */}
      <section className="shell pb-20 lg:pb-28">
        <div className="rule-strong" />
        <span className="eyebrow mt-6">02 — Answers</span>

        <div className="mt-8 max-w-3xl border-b border-border">
          {faqs.map((item, index) => {
            const expanded = open === index;
            return (
              <div key={item.q} className="border-t border-border">
                <h2>
                  <button
                    type="button"
                    id={`faq-trigger-${index}`}
                    aria-expanded={expanded}
                    aria-controls={`faq-panel-${index}`}
                    onClick={() => setOpen(expanded ? null : index)}
                    className="flex w-full cursor-pointer items-center justify-between gap-6 px-1 py-6 text-left transition-colors hover:bg-surface-2 sm:px-4"
                  >
                    <span className="flex min-w-0 items-baseline gap-4">
                      <span className="tabular shrink-0 text-xs font-bold text-muted-foreground">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="min-w-0 font-display text-base font-bold tracking-tight sm:text-lg">
                        {item.q}
                      </span>
                    </span>
                    {/* Square plus/minus affordance — red when open. Built from
                        TWO bars: the horizontal one is always present (it IS
                        the minus); the vertical one rotates 90° while scaling
                        to nothing on open, morphing plus → minus in ~200ms
                        (reverses on close). Reduced-motion flattens both
                        transitions to an instant swap via the global block. */}
                    <span
                      aria-hidden="true"
                      className={`relative grid h-8 w-8 shrink-0 place-items-center border transition-colors ${
                        expanded
                          ? "border-accent bg-accent text-accent-foreground"
                          : "border-border bg-background text-muted-foreground"
                      }`}
                    >
                      <span className="absolute h-[2px] w-3.5 bg-current" />
                      <span
                        className={`absolute h-3.5 w-[2px] bg-current transition-transform duration-200 ease-out ${
                          expanded ? "scale-y-0 rotate-90" : ""
                        }`}
                      />
                    </span>
                  </button>
                </h2>
                {/* Grid-rows trick animates height without measuring the panel:
                    0fr → 1fr on the track, `min-h-0` so the inner box can
                    actually collapse, opacity fading the copy alongside. */}
                <div
                  id={`faq-panel-${index}`}
                  role="region"
                  aria-labelledby={`faq-trigger-${index}`}
                  aria-hidden={!expanded}
                  className={`grid transition-[grid-template-rows] duration-200 ease-out ${
                    expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                  }`}
                >
                  <div className="min-h-0 overflow-hidden">
                    <p
                      className={`px-1 pb-7 text-sm leading-relaxed text-muted-foreground transition-opacity duration-200 ease-out sm:px-4 sm:pl-9 ${
                        expanded ? "opacity-100" : "opacity-0"
                      }`}
                    >
                      {item.a}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
