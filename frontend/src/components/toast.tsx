import { useSyncExternalStore } from "react";
import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Tiny external toast store. Mounted once at the root (`ToastViewport`);
 * anywhere in the tree calls `showToast(...)`. Polite live region, never
 * steals focus, auto-dismisses after 4 s. Swiss: flat ink/paper bars with a
 * 3px accent border on the leading edge, keyed by tone.
 */

export type ToastTone = "success" | "info" | "error";

export type ToastItem = {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
};

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function dismissToast(id: number) {
  items = items.filter((toast) => toast.id !== id);
  emit();
}

export function showToast(tone: ToastTone, title: string, description?: string): number {
  const id = nextId++;
  items = [...items, { id, tone, title, ...(description ? { description } : {}) }];
  emit();
  window.setTimeout(() => dismissToast(id), 4000);
  return id;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const toneIcon: Record<ToastTone, typeof Info> = {
  success: CheckCircle2,
  info: Info,
  error: TriangleAlert,
};

const toneText: Record<ToastTone, string> = {
  success: "text-positive",
  info: "text-accent",
  error: "text-destructive",
};

const toneEdge: Record<ToastTone, string> = {
  success: "border-l-positive",
  info: "border-l-accent",
  error: "border-l-destructive",
};

/** Renders every active toast. Mount once, near the end of the root layout. */
export function ToastViewport() {
  // Module-level state exists on the server too, so one getter serves both.
  const getSnapshot = () => items;
  const current = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return (
    <div
      aria-live="polite"
      aria-label="Notifications"
      className="pointer-events-none fixed right-4 bottom-4 z-[90] flex w-[min(92vw,360px)] flex-col gap-3"
    >
      {current.map((toast) => {
        const Icon = toneIcon[toast.tone];
        return (
          <div
            key={toast.id}
            className={cn(
              "pointer-events-auto flex items-start gap-3 border border-border border-l-[3px] bg-surface p-4",
              toneEdge[toast.tone],
            )}
            role="status"
          >
            <Icon
              className={cn("mt-0.5 h-4 w-4 shrink-0", toneText[toast.tone])}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{toast.title}</p>
              {toast.description && (
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {toast.description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss notification"
              className="-m-1 cursor-pointer p-1 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
