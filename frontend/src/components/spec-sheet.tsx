import type { LucideIcon } from "lucide-react";
import {
  AudioLines,
  BatteryCharging,
  Cable,
  Camera,
  Cpu,
  Fingerprint,
  Gauge,
  HardDrive,
  Keyboard,
  Monitor,
  PenTool,
  Ruler,
  ShieldCheck,
  Sun,
  Thermometer,
  Wifi,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type Spec = { label: string; value: string };

/**
 * Ordered label→icon rules. First match wins, so put narrow patterns above
 * broad ones. Catalog spec labels are free text, hence regex instead of a map.
 */
const SPEC_ICONS: [RegExp, LucideIcon][] = [
  [/refresh|polling|latency|rate|speed|airtime|timer/i, Gauge],
  [/display|panel|screen|resolution|image|optics|cover/i, Monitor],
  [/battery|power|output|charge|capacity/i, BatteryCharging],
  [/storage|memory|bays|drives|nodes/i, HardDrive],
  [/sensor|camera|video|stabilis|mount|tracking/i, Camera],
  [/driver|audio|voice|speaker|sound|mic/i, AudioLines],
  [/connect|bluetooth|standard|mesh|network|ports|protocol|vpn|range|coverage|signal/i, Wifi],
  [/switch|layout|keyboard|control|pen/i, Keyboard],
  [/weight|chassis|finish|hinge|build|size|dimension|thickness/i, Ruler],
  [/water|protection|encryption|rating|secure/i, ShieldCheck],
  [/temperature|thermal|cooling/i, Thermometer],
  [/light|brightness|colour|color/i, Sun],
  [/cable|cord/i, Cable],
  [/print|ink|stylus/i, PenTool],
  [/biometric|fingerprint|face/i, Fingerprint],
];

export function specIcon(label: string): LucideIcon {
  return SPEC_ICONS.find(([pattern]) => pattern.test(label))?.[1] ?? Cpu;
}

/** Headline specs as scannable tiles: icon, micro-label, oversized value. */
export function SpecTiles({ specs, className }: { specs: Spec[]; className?: string }) {
  if (!specs.length) return null;
  return (
    <dl className={cn("grid grid-cols-2 gap-4 lg:grid-cols-4", className)}>
      {specs.map((spec) => {
        const Icon = specIcon(spec.label);
        return (
          <div key={spec.label} className="panel flex flex-col p-5">
            <span
              className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-background text-glow"
              aria-hidden="true"
            >
              <Icon className="h-4 w-4" />
            </span>
            <dt className="mt-4 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              {spec.label}
            </dt>
            <dd className="tabular mt-1.5 text-lg font-bold leading-snug">{spec.value}</dd>
          </div>
        );
      })}
    </dl>
  );
}

/**
 * Remaining specs as hairline rows. A fixed label column keeps the value next
 * to its label instead of stranding the two at opposite page edges.
 */
export function SpecTable({ specs, className }: { specs: Spec[]; className?: string }) {
  if (!specs.length) return null;
  return (
    <dl className={cn("overflow-hidden rounded-2xl border border-border", className)}>
      {specs.map((spec, index) => {
        const Icon = specIcon(spec.label);
        return (
          <div
            key={spec.label}
            className={cn(
              "grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-baseline gap-6 px-5 py-3.5 text-sm sm:grid-cols-[minmax(9rem,15rem)_1fr] sm:px-6",
              index > 0 && "border-t border-border",
              index % 2 === 1 ? "bg-tint" : "bg-surface",
            )}
          >
            <dt className="flex items-baseline gap-2.5 text-muted-foreground">
              <Icon className="h-3.5 w-3.5 shrink-0 translate-y-0.5 text-muted-foreground/70" />
              {spec.label}
            </dt>
            <dd className="tabular font-semibold">{spec.value}</dd>
          </div>
        );
      })}
    </dl>
  );
}

/**
 * Full specification block. Short sheets stay as tiles only — no value is ever
 * printed twice. Longer sheets promote the first four and list the remainder.
 */
export function SpecSheet({ specs, className }: { specs: Spec[]; className?: string }) {
  if (!specs.length) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        No published specifications for this product yet.
      </p>
    );
  }
  const tiled = specs.length > 6 ? specs.slice(0, 4) : specs;
  const listed = specs.length > 6 ? specs.slice(4) : [];
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <SpecTiles specs={tiled} />
      <SpecTable specs={listed} />
    </div>
  );
}
