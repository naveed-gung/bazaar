import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Truck, RotateCcw, ShieldCheck } from "lucide-react";
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
  { icon: ShieldCheck, title: "Secure Payment", sub: "100% secure checkout" },
];

export function HeroSlider() {
  const [active, setActive] = useState(0);
  const [scroll, setScroll] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const id = window.setInterval(() => setActive((i) => (i + 1) % slides.length), 6000);
    return () => window.clearInterval(id);
  }, [active]);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const node = sectionRef.current;
      if (!node) return;
      setScroll(Math.max(0, -node.getBoundingClientRect().top));
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <section ref={sectionRef} className="mx-auto max-w-[1600px] px-6 pt-8 lg:px-10">
      <div className="relative min-h-[560px] overflow-hidden rounded-[2rem] border border-border bg-surface shadow-lift lg:min-h-[720px] 2xl:min-h-[800px]">
        {/* Parallax image layers, cross-fading */}
        {slides.map((slide, i) => (
          <div
            key={slide.eyebrow}
            aria-hidden={i !== active}
            className="absolute inset-0 transition-opacity duration-[1400ms] ease-out"
            style={{ opacity: i === active ? 1 : 0 }}
          >
            <img
              src={slide.img}
              alt={i === active ? `${slide.title.join(" ")} — Bazaar` : ""}
              width={1600}
              height={912}
              loading={i === 0 ? "eager" : "lazy"}
              className="h-full w-full object-cover"
              style={{
                transform: `translate3d(0, ${scroll * 0.18}px, 0) scale(${
                  1.08 + scroll * 0.00006
                })`,
              }}
            />
          </div>
        ))}

        <div className="absolute inset-0 bg-background/55" />
        <div className="absolute inset-0 grid-noise opacity-40" />

        <div className="relative flex min-h-[560px] flex-col justify-center px-8 py-16 sm:px-14 lg:min-h-[720px] lg:max-w-[64%] lg:px-20 2xl:min-h-[800px]">
          {slides.map((slide, i) =>
            i === active ? (
              <div key={slide.eyebrow} style={{ animation: "slide-fade 1100ms both" }}>
                <span className="inline-flex items-center gap-2 rounded-full border border-signal/40 bg-signal/10 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-glow">
                  <span className="h-1.5 w-1.5 rounded-full bg-signal" />
                  {slide.eyebrow}
                </span>
                <h1 className="mt-8 text-[2.9rem] font-extrabold leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl 2xl:text-[5.25rem]">
                  {slide.title[0]}
                  <br />
                  <span className="text-signal">{slide.title[1]}</span>
                </h1>
                <p className="mt-7 max-w-xl text-base leading-relaxed text-muted-foreground lg:text-lg">
                  {slide.copy}
                </p>
                <div className="mt-10 flex flex-wrap gap-4">
                  <Link to={slide.to} className="btn btn-primary btn-lg shadow-glow lg:text-base">
                    {slide.cta} <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                  <Link
                    to="/new-arrivals"
                    className="btn btn-quiet btn-lg bg-surface/70 backdrop-blur lg:text-base"
                  >
                    View New Arrivals
                  </Link>
                </div>
              </div>
            ) : null,
          )}

          <div className="mt-14 grid gap-5 rounded-2xl border border-border bg-background/70 p-6 backdrop-blur sm:grid-cols-3 sm:divide-x sm:divide-border">
            {perks.map(({ icon: Icon, title, sub }) => (
              <div key={title} className="flex min-w-0 items-center gap-4 sm:px-5">
                <Icon className="h-5 w-5 shrink-0 text-glow" strokeWidth={1.6} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{title}</p>
                  <p className="truncate text-xs text-muted-foreground">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Slide controls */}
        <div className="absolute bottom-8 right-8 z-10 flex items-center gap-3">
          {slides.map((slide, i) => (
            <button
              key={slide.eyebrow}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Show slide ${i + 1}`}
              aria-current={i === active}
              className={`h-1.5 rounded-full transition-all duration-500 ${
                i === active ? "w-12 bg-signal" : "w-6 bg-border hover:bg-muted-foreground"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
