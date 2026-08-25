import { useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useFocusTrap } from "@/components/focus-trap";

/**
 * Side drawer (cart drawer, mobile filters). Portals to <body>, traps focus,
 * locks body scroll, closes on Escape / backdrop click and restores focus.
 * Swiss: a flat surface sliding off a plain ink-alpha overlay, with a 3px ink
 * rule on the leading edge — no blur, no shadow.
 */
export function Drawer({
  open,
  onClose,
  title,
  side = "right",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  side?: "left" | "right";
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, open, onClose);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70]">
      <div
        className="absolute inset-0 bg-foreground/50"
        style={{ animation: "overlay-in 200ms var(--ease-enter) both" }}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`absolute top-0 bottom-0 flex w-[min(92vw,400px)] flex-col bg-surface ${
          side === "left" ? "border-r-[3px] border-r-rule" : "border-l-[3px] border-l-rule"
        }`}
        style={{
          [side === "left" ? "left" : "right"]: 0,
          ["--drawer-from" as string]: side === "left" ? "-100%" : "100%",
          animation: "drawer-in 320ms var(--ease-enter) both",
        }}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-display text-base font-semibold uppercase tracking-tight">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="grid h-10 w-10 cursor-pointer place-items-center text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
