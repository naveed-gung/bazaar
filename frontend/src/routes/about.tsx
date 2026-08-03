import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHero } from "@/components/page-hero";
import { Reveal } from "@/components/motion";
import bannerComputing from "@/assets/banner-computing.jpg";

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

function About() {
  return (
    <>
      <PageHero
        eyebrow="About"
        title="Commerce, rebuilt around the customer"
        copy="Bazaar is redefining the e-commerce experience for the modern digital age. Our platform combines cutting-edge technology with intuitive design to create a seamless shopping journey."
      />
      <section className="mx-auto grid max-w-[1600px] gap-12 px-6 py-16 lg:grid-cols-2 lg:items-center lg:px-10 lg:py-24">
        <Reveal>
          <div className="overflow-hidden rounded-3xl border border-border">
            <img
              src={bannerComputing}
              alt="Modern devices on a dark studio surface"
              className="w-full object-cover"
            />
          </div>
        </Reveal>
        <Reveal delay={120}>
          <div className="space-y-6 text-base leading-relaxed text-muted-foreground">
            <p>
              We started Bazaar because buying technology online had become slower and noisier than
              it needed to be. Endless listings, unclear specifications, and checkouts that fought
              you.
            </p>
            <p>
              So we built the opposite: a tight catalogue, honest specifications, and an interface
              that gets out of the way. Every product is reviewed by our team before it appears
              here.
            </p>
            <p>
              The result is a storefront that feels fast on any device, reads clearly at any screen
              size, and treats attention as something worth protecting.
            </p>
            <Link to="/shop" className="btn btn-primary btn-lg">
              Explore the catalogue
            </Link>
          </div>
        </Reveal>
      </section>
    </>
  );
}
