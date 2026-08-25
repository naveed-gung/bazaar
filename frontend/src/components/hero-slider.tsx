import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Pause, Play, RotateCcw, ShieldCheck, Truck } from "lucide-react";
import hero1 from "@/assets/hero-1.jpg";
import hero2 from "@/assets/hero-2.jpg";
import hero3 from "@/assets/hero-3.jpg";

const slides = [
  {
    img: hero1,
    eyebrow: "New Collection 2026",
    title: ["Redefining", "Everyday Commerce"],
    copy: "Cutting-edge technology meets intuitive design — a seamless shopping journey built for the modern digital age.",
    to: "/shop",
    cta: "Shop the Collection",
  },
  {
    img: hero2,
    eyebrow: "Creator Studio",
    title: ["Built for", "Precision Work"],
    copy: "Cameras, keyboards and tools engineered for people who make things — curated, tested and ready to ship.",
    to: "/categories/computing",
    cta: "Explore Computing",
  },
  {
    img: hero3,
    eyebrow: "Connected Living",
    title: ["A Smarter", "Kind of Home"],
    copy: "Lighting, audio and ambient intelligence that fades into the background until the moment you need it.",
    to: "/categories/smart-home",
    cta: "Discover Smart Home",
  },
];

const perks = [
  { icon: Truck, title: "Free Shipping", sub: "On orders over $50" },
  { icon: RotateCcw, title: "Easy Returns", sub: "30 days return policy" },
  { icon: ShieldCheck, title: "Simulated Payments", sub: "No card details, ever" },
];

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Swiss hero carousel (SF-12). Flat opacity crossfade — no Ken-Burns zoom, no
 * parallax. Auto-advances unless the visitor prefers reduced motion (in which
 * case nothing moves at all); pauses on hover and focus; ArrowLeft/ArrowRight
 * move slides from anywhere inside the region; every control is a real button.
 */
export function HeroSlider() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = useRef(prefersReducedMotion());

  const goTo = useCallback((index: number) => {
    setActive(((index % slides.length) + slides.length) % slides.length);
  }, []);

  // Auto-advance — suppressed entirely under prefers-reduced-motion.
  useEffect(() => {
    if (paused || reduced.current) return;
    const id = window.setInterval(() => setActive((i) => (i + 1) % slides.length), 6000);
    return () => window.clearInterval(id);
  }, [paused, active]);

  function onRegionKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      goTo(active + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      goTo(active - 1);
    }
  }

  const slide = slides[active] ?? slides[0]!;

  return (
    <section
      className="shell pt-8"
      role="region"
      aria-roledescription="carousel"
      aria-label="Featured collections"
      onKeyDown={onRegionKeyDown}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="relative min-h-[540px] overflow-hidden border border-border bg-surface lg:min-h-[660px]">
        {slides.map((entry, i) => (
          <div
            key={entry.eyebrow}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${slides.length}`}
            aria-hidden={i !== active}
            className="absolute inset-0 transition-opacity [transition-timing-function:var(--ease-enter)]"
            style={{ opacity: i === active ? 1 : 0, transitionDuration: "var(--dur-reveal)" }}
          >
            <img
              src={entry.img}
              alt={i === active ? `${entry.title.join(" ")} — Bazaar` : ""}
              width={1600}
              height={912}
              loading={i === 0 ? "eager" : "lazy"}
              className="h-full w-full object-cover"
            />
          </div>
        ))}

        {/* Paper wash — the type always sits on clean ground. */}
        <div className="absolute inset-0 bg-background/75" />

        <div className="relative flex min-h-[540px] flex-col justify-center px-6 py-14 sm:px-10 lg:min-h-[660px] lg:max-w-[62%] lg:px-14">
          <div
            key={slide.eyebrow}
            style={{ animation: "overlay-in var(--dur-reveal) var(--ease-enter) both" }}
          >
            <span className="eyebrow">{slide.eyebrow}</span>
            <h1 className="font-display mt-6 text-[clamp(2.5rem,5.5vw,4.75rem)] font-black uppercase leading-[0.95] tracking-[-0.02em] [font-stretch:125%]">
              {slide.title[0]}
              <br />
              <span className="text-accent">{slide.title[1]}</span>
            </h1>
            <p className="measure mt-6 text-base leading-relaxed text-muted-foreground lg:text-lg">
              {slide.copy}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={slide.to} className="btn btn-primary btn-lg">
                {slide.cta}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link to="/new-arrivals" className="btn btn-quiet btn-lg">
                View New Arrivals
              </Link>
            </div>
          </div>

          {/* Perks — flat ruled band, hairline column dividers. */}
          <ul className="mt-12 grid border border-border bg-surface sm:grid-cols-3 sm:divide-x sm:divide-border">
            {perks.map(({ icon: Icon, title, sub }) => (
              <li key={title} className="flex min-w-0 items-center gap-3 px-4 py-3.5">
                <Icon
                  className="h-4 w-4 shrink-0 text-accent"
                  strokeWidth={1.6}
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold uppercase tracking-[0.08em]">{title}</p>
                  <p className="truncate text-xs text-muted-foreground">{sub}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Slide controls — square index cells, tabular position counter. */}
        <div className="absolute bottom-6 right-6 z-10 flex items-center gap-2">
          <span className="tabular mr-2 text-xs font-semibold text-muted-foreground">
            {String(active + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}
          </span>
          {!reduced.current && (
            <button
              type="button"
              onClick={() => setPaused((value) => !value)}
              aria-label={paused ? "Play carousel" : "Pause carousel"}
              className="grid h-11 w-11 cursor-pointer place-items-center border border-border bg-surface text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
            >
              {paused ? (
                <Play className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Pause className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          )}
          {slides.map((entry, i) => (
            <button
              key={entry.eyebrow}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Show slide ${i + 1}: ${entry.title.join(" ")}`}
              aria-current={i === active}
              className="grid h-11 w-11 cursor-pointer place-items-center"
            >
              <span
                className={`h-2.5 w-2.5 transition-colors [transition-timing-function:var(--ease-enter)] ${
                  i === active ? "bg-accent" : "border border-border hover:border-muted-foreground"
                }`}
              />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
