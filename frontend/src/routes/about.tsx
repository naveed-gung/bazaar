import { createFileRoute, Link } from "@tanstack/react-router";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Reveal } from "@/components/motion";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Bazaar — Commerce for the Digital Age" },
      {
        name: "description",
        content:
          "Bazaar is redefining the e-commerce experience for the modern digital age, combining cutting-edge technology with intuitive design.",
      },
      { property: "og:title", content: "About Bazaar" },
      {
        property: "og:description",
        content: "Why we built Bazaar and how we choose what we sell.",
      },
    ],
  }),
  component: About,
});

const statements = [
  {
    label: "Why we started",
    copy: "We started Bazaar because buying technology online had become slower and noisier than it needed to be. Endless listings, unclear specifications, and checkouts that fought you.",
  },
  {
    label: "What we built",
    copy: "The opposite: a tight catalogue, honest specifications, and an interface that gets out of the way. Every product is reviewed by our team before it appears here.",
  },
  {
    label: "The result",
    copy: "A storefront that feels fast on any device, reads clearly at any screen size, and treats attention as something worth protecting.",
  },
];

function About() {
  return (
    <>
      {/* 01 — Statement header */}
      <section className="shell pt-10 pb-12 lg:pt-14 lg:pb-16">
        <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: "About" }]} />
        <div className="rule-strong mt-8" />
        <div className="mt-6 max-w-4xl">
          <span className="eyebrow">01 — About</span>
          <h1 className="headline mt-4">Commerce, rebuilt around the customer</h1>
        </div>
      </section>

      {/* 02 — Numbered statements over rules */}
      <section className="shell pb-20 lg:pb-28">
        <div className="rule-strong" />
        <span className="eyebrow mt-6">02 — The Idea</span>

        <div className="mt-12">
          {statements.map((statement, index) => (
            <Reveal key={statement.label} delay={index * 90}>
              <div className="grid gap-6 border-t border-border py-10 lg:grid-cols-12 lg:gap-12">
                <div className="lg:col-span-3">
                  <p className="tabular text-xs font-bold text-muted-foreground">
                    {String(index + 1).padStart(2, "0")}
                  </p>
                  <p className="mt-2 text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">
                    {statement.label}
                  </p>
                </div>
                <p className="measure text-xl leading-relaxed font-medium tracking-tight text-foreground lg:col-span-9 lg:text-2xl">
                  {statement.copy}
                </p>
              </div>
            </Reveal>
          ))}

          <Reveal delay={270}>
            <div className="flex flex-wrap items-center justify-between gap-6 border-t border-border pt-10">
              <p className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">
                Bazaar — Commerce for the digital age
              </p>
              <Link to="/shop" className="btn btn-primary btn-lg">
                Explore the catalogue
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
